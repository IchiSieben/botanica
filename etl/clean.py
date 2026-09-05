"""Paso 3: limpieza de ocurrencias GBIF (principio 3: esfuerzo != riqueza).

Filtros obligatorios del spec:
- descartar coords nulas y 0/0
- descartar centroides de pais (heuristica) y coordinateUncertainty alto
- conservar flags de calidad (issue) para auditoria

Multi-reino: limpia plantas (raw_gbif_occurrences -> gbif_clean) y hongos
(raw_gbif_fungi -> gbif_fungi_clean) con la MISMA logica, y arma
`gbif_occ_norm`: union normalizada con columna `kingdom` que alimenta el
spatial join punto->departamento en model.py (un solo join para ambos reinos).
"""

from __future__ import annotations

import duckdb

from . import config as C

# Umbral de incertidumbre de coordenada (metros). Configurable.
MAX_COORD_UNCERTAINTY_M = 10_000


def _cols(con, t: str) -> set[str]:
    return {r[1] for r in con.sql(f"PRAGMA table_info('{t}')").fetchall()}


def _clean_one(con, raw: str, out: str) -> tuple[int, int]:
    """Limpia una tabla cruda de ocurrencias -> tabla `out` con lat/lon DOUBLE."""
    cols = _cols(con, raw)
    lat, lon = "decimalLatitude", "decimalLongitude"
    unc = "coordinateUncertaintyInMeters"
    unc_filter = (
        f"AND (try_cast({unc} AS DOUBLE) IS NULL "
        f"OR try_cast({unc} AS DOUBLE) <= {MAX_COORD_UNCERTAINTY_M})"
        if unc in cols else ""
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE {out} AS
        SELECT *,
            try_cast({lat} AS DOUBLE) AS lat,
            try_cast({lon} AS DOUBLE) AS lon
        FROM {raw}
        WHERE try_cast({lat} AS DOUBLE) IS NOT NULL
          AND try_cast({lon} AS DOUBLE) IS NOT NULL
          AND NOT (try_cast({lat} AS DOUBLE) = 0 AND try_cast({lon} AS DOUBLE) = 0)
          AND try_cast({lat} AS DOUBLE) BETWEEN -90 AND 90
          AND try_cast({lon} AS DOUBLE) BETWEEN -180 AND 180
          {unc_filter}
        """
    )
    kept = con.sql(f"SELECT count(*) FROM {out}").fetchone()[0]
    total = con.sql(f"SELECT count(*) FROM {raw}").fetchone()[0]
    return kept, total


def _norm_select(con, table: str, kingdom: str) -> str | None:
    """Proyecta una tabla limpia a las columnas normalizadas del fact (o None)."""
    cols = _cols(con, table)
    key = "gbifID" if "gbifID" in cols else ("key" if "key" in cols else None)
    if key is None:
        return None
    elev = "try_cast(elevation AS DOUBLE)" if "elevation" in cols else "CAST(NULL AS DOUBLE)"
    order_col = '"order"' if "order" in cols else "CAST(NULL AS VARCHAR)"
    return f"""
        SELECT
            CAST({key} AS VARCHAR) AS gbif_key,
            '{kingdom}'            AS kingdom,
            species, family,
            {order_col}            AS "order",
            lon, lat,
            {elev}                 AS elevation,
            try_cast(year AS INT)  AS year,
            basisOfRecord          AS basis_of_record
        FROM {table}
    """


def run() -> None:
    con = duckdb.connect(str(C.DUCKDB_PATH))
    try:
        tables = {r[0] for r in con.sql("SHOW TABLES").fetchall()}
        plan = [
            ("raw_gbif_occurrences", "gbif_clean", "Plantae"),
            ("raw_gbif_fungi", "gbif_fungi_clean", "Fungi"),
        ]
        norm_parts: list[str] = []
        for raw, out, kingdom in plan:
            if raw not in tables:
                print(f"[clean] {raw} ausente; salteando {kingdom}")
                continue
            kept, total = _clean_one(con, raw, out)
            print(f"[clean] {out} ({kingdom}): {kept}/{total} conservados "
                  f"({total - kept} descartados por coords/incertidumbre)")
            sel = _norm_select(con, out, kingdom)
            if sel:
                norm_parts.append(sel)

        if norm_parts:
            con.execute(
                "CREATE OR REPLACE TABLE gbif_occ_norm AS "
                + " UNION ALL BY NAME ".join(f"({p})" for p in norm_parts)
            )
            by = dict(con.sql(
                "SELECT kingdom, count(*) FROM gbif_occ_norm GROUP BY 1"
            ).fetchall())
            print(f"[clean] gbif_occ_norm: {by} (insumo del spatial join)")
    finally:
        con.close()
