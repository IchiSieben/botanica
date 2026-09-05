"""Paso 7: exporta agregados/stats a data/exports (JSON chico + Parquet grande).

La viz lee SOLO de estos exports (principio 1: estatico-first). Los JSON se
versionan (livianos, ideales para Astro); los Parquet quedan gitignored.
"""

from __future__ import annotations

import json
from decimal import Decimal

import duckdb

from . import config as C


def _json_default(o):
    """Serializa tipos de DuckDB no nativos (Decimal -> float)."""
    if isinstance(o, Decimal):
        return float(o)
    raise TypeError(f"no serializable: {type(o)}")


def order_clause(cols: list[str]) -> str:
    """Clausula ORDER BY que hace el export REPRODUCIBLE.

    Sin ella, `SELECT * FROM tbl` deja el orden de filas a criterio de DuckDB:
    dos corridas sobre los mismos datos producen JSON distintos y cada corrida
    del ETL ensucia el repo con un diff de miles de lineas que no significa
    nada. El principio 1 del atlas es un pipeline reproducible; un export que
    no es estable byte a byte no lo cumple.

    Ordena por TODAS las columnas de izquierda a derecha: aunque las primeras
    empaten, el desempate llega siempre. Filas completamente duplicadas quedan
    en orden arbitrario entre si, pero son identicas, asi que el archivo sigue
    siendo estable.

    NULLS LAST fija tambien la posicion de los nulos, que de otro modo depende
    de la version del motor.
    """
    if not cols:
        return ""
    quoted = ", ".join(f'"{c}" NULLS LAST' for c in cols)
    return f" ORDER BY {quoted}"


def run() -> None:
    con = duckdb.connect(str(C.DUCKDB_PATH))
    try:
        tables = {r[0] for r in con.sql("SHOW TABLES").fetchall()}
        # La web consume marts (mart_*) + tablas de stats (stats_*).
        exportable = sorted(t for t in tables
                            if t.startswith("mart_") or t.startswith("stats_"))
        exported = []
        for tbl in exportable:
            # Las columnas se leen primero para construir el ORDER BY; LIMIT 0
            # trae el esquema sin materializar filas.
            cols = [d[0] for d in con.sql(f"SELECT * FROM {tbl} LIMIT 0").description]
            order = order_clause(cols)
            # Fetch directo (NULL -> None) en vez de pandas (NULL -> NaN, que
            # json.dumps escribe como `NaN`, JSON invalido para la web).
            res = con.sql(f"SELECT * FROM {tbl}{order}")
            rows = [dict(zip(cols, r)) for r in res.fetchall()]
            json_path = C.EXPORTS / f"{tbl}.json"
            json_path.write_text(
                json.dumps(rows, ensure_ascii=False, indent=2, default=_json_default),
                encoding="utf-8",
            )
            # Parquet para datasets grandes / re-analisis. Mismo orden que el
            # JSON: si difieren, dejan de ser dos vistas del mismo export.
            con.execute(
                f"COPY (SELECT * FROM {tbl}{order}) "
                f"TO '{(C.EXPORTS / (tbl + '.parquet')).as_posix()}' "
                "(FORMAT PARQUET)"
            )
            exported.append(f"{tbl} ({len(rows)} filas)")

        # Manifiesto de exports para que la web sepa que hay.
        (C.EXPORTS / "index.json").write_text(
            json.dumps({"country_l3": C.COUNTRY_L3, "exports": exported},
                       ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"[export] -> {C.EXPORTS}: {exported or '(nada; corre el pipeline completo)'}")
    finally:
        con.close()
