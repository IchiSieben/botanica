"""Paso de MARTS: agregados pre-calculados, uno por dashboard previsto.

MULTI-REINO: cada mart lleva columna `kingdom` (Plantae / Fungi) y agrupa por
reino, asi el sitio carga el mismo mart filtrando por el reino activo. Leen del
esquema estrella (dim_*/fact_*), NO de tablas crudas (principio 1).

Marts:
- mart_kpis                   : titulares por reino (especies, familias, ... + calidad GBIF)
- mart_richness_by_department : registros Y especies POR SEPARADO (principio 3)
- mart_family_composition     : especies por familia (+ orden APG)
- mart_lifeform_spectrum      : especies por forma de vida (plantas) / modo nutricional (hongos)
- mart_status                 : nativas / introducidas / endemicas (hongos: sin dato)
- mart_clade_by_department    : presencia clado x departamento (insumo arbol<->mapa, F2)
- mart_described_per_year     : especies descritas por año (IPNI; pendiente de datos)
"""

from __future__ import annotations

import duckdb

from . import config as C


def _has(con, t: str) -> bool:
    return t in {r[0] for r in con.sql("SHOW TABLES").fetchall()}


def run() -> None:
    con = duckdb.connect(str(C.DUCKDB_PATH))
    try:
        _mart_kpis(con)
        _mart_richness_by_department(con)
        _mart_clade_by_department(con)
        _mart_family_composition(con)
        _mart_lifeform_spectrum(con)
        _mart_status(con)
        _mart_described_per_year(con)
    finally:
        con.close()


def _mart_kpis(con) -> None:
    """Titulares por reino (una fila por reino). Taxonomia a nivel ESPECIE
    (is_species) + calidad/cobertura del join GBIF. El sitio lee de aca."""
    if not _has(con, "dim_taxon"):
        return
    kingdoms = [r[0] for r in con.sql(
        "SELECT DISTINCT kingdom FROM dim_taxon ORDER BY kingdom"
    ).fetchall()]
    raw_occ = {
        "Plantae": "raw_gbif_occurrences",
        "Fungi": "raw_gbif_fungi",
    }
    rows = []
    for kg in kingdoms:
        tax = con.sql(
            """
            SELECT
                count(*) FILTER (WHERE is_species)                AS species,
                count(*) FILTER (WHERE is_species AND native)     AS native,
                count(*) FILTER (WHERE is_species AND introduced) AS introduced,
                count(*) FILTER (WHERE is_species AND endemic)    AS endemic,
                count(DISTINCT family) FILTER (WHERE is_species)   AS families,
                count(DISTINCT genus)  FILTER (WHERE is_species)   AS genera
            FROM dim_taxon WHERE kingdom = ?
            """, params=[kg]
        ).fetchone()
        species, native, introduced, endemic, families, genera = tax
        endemic_rate = round(100.0 * endemic / species, 1) if species else 0.0

        if _has(con, "fact_occurrence"):
            occ = con.sql("SELECT count(*) FROM fact_occurrence WHERE kingdom = ?",
                          params=[kg]).fetchone()[0]
            assigned = con.sql(
                "SELECT count(*) FROM fact_occurrence WHERE kingdom = ? "
                "AND department <> 'unassigned'", params=[kg]
            ).fetchone()[0]
        else:
            occ, assigned = 0, 0
        rt = raw_occ.get(kg)
        occ_raw = con.sql(f"SELECT count(*) FROM {rt}").fetchone()[0] if rt and _has(con, rt) else 0
        unassigned = occ - assigned
        assigned_pct = round(100.0 * assigned / occ, 2) if occ else 0.0
        unassigned_pct = round(100.0 * unassigned / occ, 2) if occ else 0.0
        rows.append((kg, species, native, introduced, endemic, endemic_rate, families,
                     genera, occ, occ_raw, assigned, unassigned, assigned_pct, unassigned_pct))
        print(f"[mart] mart_kpis[{kg}]: {species} especies · {families} fam · {genera} gen · "
              f"{occ} occ ({assigned_pct}% asignadas)")

    con.execute(
        """
        CREATE OR REPLACE TABLE mart_kpis (
            kingdom VARCHAR, species BIGINT, native BIGINT, introduced BIGINT,
            endemic BIGINT, endemic_rate DOUBLE, families BIGINT, genera BIGINT,
            occurrences BIGINT, occurrences_raw BIGINT, assigned BIGINT,
            unassigned BIGINT, assigned_pct DOUBLE, unassigned_pct DOUBLE)
        """
    )
    con.executemany(
        "INSERT INTO mart_kpis VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows
    )


def _mart_richness_by_department(con) -> None:
    if not _has(con, "fact_occurrence"):
        return
    # Registros y especies SEPARADOS: esfuerzo != riqueza. Por reino.
    con.execute(
        """
        CREATE OR REPLACE TABLE mart_richness_by_department AS
        SELECT
            kingdom,
            coalesce(department, '(sin depto)') AS department,
            count(*)                            AS records,
            count(DISTINCT species)             AS species
        FROM fact_occurrence
        GROUP BY 1, 2 ORDER BY kingdom, records DESC
        """
    )
    print("[mart] mart_richness_by_department listo (por reino; registros y especies separados)")


def _mart_clade_by_department(con) -> None:
    if not (_has(con, "fact_occurrence") and _has(con, "dim_clade")):
        return
    con.execute(
        """
        CREATE OR REPLACE TABLE mart_clade_by_department AS
        SELECT
            f.kingdom, c.clade, c.color,
            coalesce(f.department, '(sin depto)') AS department,
            count(*)                  AS records,
            count(DISTINCT f.species) AS species
        FROM fact_occurrence f
        JOIN dim_clade c ON c.clade = f.order_apg
        GROUP BY 1,2,3,4 ORDER BY f.kingdom, records DESC
        """
    )
    n = con.sql("SELECT count(*) FROM mart_clade_by_department").fetchone()[0]
    print(f"[mart] mart_clade_by_department: {n} filas reino x clado x depto")


def _mart_family_composition(con) -> None:
    if not _has(con, "dim_taxon"):
        return
    con.execute(
        """
        CREATE OR REPLACE TABLE mart_family_composition AS
        SELECT kingdom, family,
               any_value(order_apg)   AS order_apg,
               count(*)               AS species,
               count(DISTINCT genus)  AS genera
        FROM dim_taxon WHERE family IS NOT NULL AND is_species
        GROUP BY kingdom, family ORDER BY kingdom, species DESC
        """
    )
    n = con.sql("SELECT count(*) FROM mart_family_composition").fetchone()[0]
    print(f"[mart] mart_family_composition: {n} filas reino x familia")


def _mart_lifeform_spectrum(con) -> None:
    if not _has(con, "dim_taxon"):
        return
    con.execute(
        """
        CREATE OR REPLACE TABLE mart_lifeform_spectrum AS
        SELECT kingdom,
               coalesce(nullif(trim(lifeform), ''), '(sin dato)') AS lifeform,
               count(*) AS species
        FROM dim_taxon WHERE is_species GROUP BY 1, 2 ORDER BY kingdom, species DESC
        """
    )
    print("[mart] mart_lifeform_spectrum listo (por reino)")


def _mart_status(con) -> None:
    if not _has(con, "dim_taxon"):
        return
    # Hongos: sin backbone de distribucion curado -> origen desconocido (sin dato).
    con.execute(
        """
        CREATE OR REPLACE TABLE mart_status AS
        SELECT kingdom,
               CASE WHEN endemic THEN 'endemica'
                    WHEN introduced THEN 'introducida'
                    WHEN native THEN 'nativa'
                    ELSE '(sin dato)' END AS status,
               count(*) AS species
        FROM dim_taxon WHERE is_species GROUP BY 1, 2 ORDER BY kingdom, species DESC
        """
    )
    print("[mart] mart_status listo (por reino; hongos = sin dato de origen)")


def _mart_described_per_year(con) -> None:
    # IPNI `published` aun no integrado (on-demand). Schema vacio con kingdom.
    con.execute(
        "CREATE OR REPLACE TABLE mart_described_per_year "
        "(kingdom VARCHAR, year INTEGER, species BIGINT)"
    )
    print("[mart] mart_described_per_year: schema listo (pendiente IPNI published)")
