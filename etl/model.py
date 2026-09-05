"""Modelo analitico = esquema ESTRELLA en DuckDB (ADR 0002).

Dimensiones: dim_taxon, dim_geo, dim_time, dim_clade.
Hechos (dos granos): fact_occurrence (registro GBIF), fact_distribution (WCVP area L3).

Resiliente / sample-first: cada tabla se construye con lo que exista; si falta
el insumo (p.ej. WCVP en modo muestra) la tabla queda vacia pero con su schema,
asi el modelo es inspeccionable y los marts no rompen.
"""

from __future__ import annotations

import duckdb

from . import config as C
from . import geo

# Paleta estable para colorear clados (orden) en F2 (sin depender de random).
_PALETTE = [
    "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948",
    "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC", "#86BCB6", "#D37295",
]


def _has(con, t: str) -> bool:
    return t in {r[0] for r in con.sql("SHOW TABLES").fetchall()}


def _cols(con, t: str) -> set[str]:
    return {r[1] for r in con.sql(f"PRAGMA table_info('{t}')").fetchall()}


def run() -> None:
    con = duckdb.connect(str(C.DUCKDB_PATH))
    try:
        geo.ensure_spatial(con)
        has_geo = geo.load_departments_temp(con)  # TEMP table; vive en esta conexion
        _dim_taxon(con)
        _dim_clade(con)
        _dim_geo(con, has_geo)
        _dim_time(con)
        _fact_occurrence(con, has_geo)
        _fact_distribution(con)
        model = [t for t in (r[0] for r in con.sql("SHOW TABLES").fetchall())
                 if t.startswith(("dim_", "fact_"))]
        print(f"[model] esquema estrella: {sorted(model)}")
    finally:
        con.close()


def _dim_taxon(con) -> None:
    """Un taxon aceptado de Peru por fila, MULTI-REINO (kingdom), enriquecido con
    orden APG y flags de estatus.

    - Plantae (peru_species): especie + infraespecificos; native/introduced/
      endemic desde WCVP. `is_species` separa el titular de los infraespecificos.
    - Fungi (peru_fungi): especies aceptadas evidenciadas por ocurrencias GBIF;
      origen y modo nutricional desconocidos (NULL honesto, sin backbone curado).

    Los marts de "especies" filtran is_species para NO inflar el conteo.
    """
    order_join = ("LEFT JOIN family_order_apg fo ON fo.family = t.family"
                  if _has(con, "family_order_apg") else "")
    order_expr = 'fo."order"' if _has(con, "family_order_apg") else "CAST(NULL AS VARCHAR)"

    parts: list[str] = []
    if _has(con, "peru_species"):
        parts.append(f"""
            SELECT
                t.plant_name_id            AS taxon_id,
                'Plantae'                  AS kingdom,
                t.taxon_name,
                t.taxon_rank,
                (t.taxon_rank = 'Species') AS is_species,
                t.genus, t.family,
                {order_expr}               AS order_apg,
                t.lifeform_description     AS lifeform,
                t.climate_description      AS climate,
                t.native                                       AS native,
                (coalesce(t.introduced,0)=1)                   AS introduced,
                t.endemic                                      AS endemic
            FROM peru_species t {order_join}
        """)
    if _has(con, "peru_fungi"):
        parts.append(f"""
            SELECT
                t.taxon_id,
                'Fungi'                    AS kingdom,
                t.taxon_name,
                t.taxon_rank,
                t.is_species,
                t.genus, t.family,
                {order_expr}               AS order_apg,
                t.lifeform_description     AS lifeform,
                t.climate_description      AS climate,
                t.native, t.introduced, t.endemic
            FROM peru_fungi t {order_join}
        """)

    if parts:
        con.execute("CREATE OR REPLACE TABLE dim_taxon AS "
                    + " UNION ALL ".join(parts))
    else:
        con.execute(
            """
            CREATE OR REPLACE TABLE dim_taxon (
                taxon_id VARCHAR, kingdom VARCHAR, taxon_name VARCHAR, taxon_rank VARCHAR,
                is_species BOOLEAN, genus VARCHAR, family VARCHAR,
                order_apg VARCHAR, lifeform VARCHAR, climate VARCHAR,
                native BOOLEAN, introduced BOOLEAN, endemic BOOLEAN
            )
            """
        )
    by = dict(con.sql(
        "SELECT kingdom, count(*) FROM dim_taxon WHERE is_species GROUP BY 1"
    ).fetchall()) if parts else {}
    n = con.sql("SELECT count(*) FROM dim_taxon").fetchone()[0]
    print(f"[model] dim_taxon: {n} taxones · especies por reino={by}")


def _dim_clade(con) -> None:
    """Clado coloreado = orden APG (unidad de color para F2). Color estable por nombre."""
    palette_values = ",".join(
        f"({i}, '{c}')" for i, c in enumerate(_PALETTE)
    )
    # Ordenes desde dim_taxon (full) y/o GBIF (muestra), asi hay clados aun sin WCVP.
    src_orders = []
    if _has(con, "dim_taxon"):
        src_orders.append('SELECT DISTINCT order_apg AS o FROM dim_taxon WHERE order_apg IS NOT NULL')
    if _has(con, "family_order_apg"):
        src_orders.append('SELECT DISTINCT "order" AS o FROM family_order_apg')
    if not src_orders:
        con.execute('CREATE OR REPLACE TABLE dim_clade (clade_id INTEGER, clade VARCHAR, color VARCHAR)')
        print("[model] dim_clade: 0 (sin ordenes)")
        return
    union = " UNION ".join(src_orders)
    con.execute(
        f"""
        CREATE OR REPLACE TABLE dim_clade AS
        WITH orders AS (
            SELECT o, row_number() OVER (ORDER BY o) - 1 AS rn
            FROM ({union}) WHERE o IS NOT NULL
        ), pal(idx, color) AS (VALUES {palette_values})
        SELECT row_number() OVER (ORDER BY o) AS clade_id,
               o AS clade,
               pal.color
        FROM orders
        JOIN pal ON pal.idx = orders.rn % {len(_PALETTE)}
        """
    )
    n = con.sql("SELECT count(*) FROM dim_clade").fetchone()[0]
    print(f"[model] dim_clade: {n} clados (orden) coloreados")


def _dim_geo(con, has_geo: bool) -> None:
    """Los 25 departamentos oficiales (NOMBDEP del GeoJSON) + el area WGSRPD L3."""
    if has_geo:
        con.execute(
            f"""
            CREATE OR REPLACE TABLE dim_geo AS
            SELECT row_number() OVER (ORDER BY department) AS geo_id,
                   department, '{C.COUNTRY_L3}' AS area_l3
            FROM (SELECT DISTINCT department FROM {geo.TEMP_TABLE})
            ORDER BY department
            """
        )
    else:
        # Fallback (sin GeoJSON): departamentos crudos de stateProvince.
        con.execute(
            f"""
            CREATE OR REPLACE TABLE dim_geo AS
            SELECT row_number() OVER (ORDER BY dept) AS geo_id, dept AS department,
                   '{C.COUNTRY_L3}' AS area_l3
            FROM (SELECT DISTINCT nullif(trim(stateProvince), '') AS dept
                  FROM gbif_clean WHERE stateProvince IS NOT NULL) WHERE dept IS NOT NULL
            """
            if _has(con, "gbif_clean") and "stateProvince" in _cols(con, "gbif_clean")
            else f"SELECT 1 AS geo_id, CAST(NULL AS VARCHAR) AS department, "
                 f"'{C.COUNTRY_L3}' AS area_l3 WHERE false"
        )
    n = con.sql("SELECT count(*) FROM dim_geo").fetchone()[0]
    print(f"[model] dim_geo: {n} departamentos ({'GeoJSON' if has_geo else 'fallback stateProvince'})")


def _dim_time(con) -> None:
    """Anios (colecta GBIF; luego tambien IPNI published)."""
    years = []
    if _has(con, "gbif_occ_norm"):
        years.append("SELECT DISTINCT try_cast(year AS INT) AS y FROM gbif_occ_norm")
    elif _has(con, "gbif_clean") and "year" in _cols(con, "gbif_clean"):
        years.append("SELECT DISTINCT try_cast(year AS INT) AS y FROM gbif_clean")
    if years:
        con.execute(
            f"CREATE OR REPLACE TABLE dim_time AS "
            f"SELECT y AS year FROM ({' UNION '.join(years)}) "
            f"WHERE y IS NOT NULL AND y BETWEEN 1700 AND 2100 ORDER BY y"
        )
    else:
        con.execute("CREATE OR REPLACE TABLE dim_time (year INTEGER)")
    n = con.sql("SELECT count(*) FROM dim_time").fetchone()[0]
    print(f"[model] dim_time: {n} anios")


def _fact_occurrence(con, has_geo: bool) -> None:
    """Grano registro GBIF MULTI-REINO: taxon x departamento x elevacion x anio.

    Lee de `gbif_occ_norm` (union normalizada Plantae+Fungi, con `kingdom`), asi
    el spatial join punto->departamento corre UNA vez para ambos reinos. Las
    claves GBIF son globalmente unicas, no colisionan entre reinos.

    Asignacion punto->departamento en 3 niveles (col `assign_method`):
      1. 'contencion' : el punto cae DENTRO del poligono (ST_Contains).
      2. 'snap'       : depto mas cercano con borde a <= SNAP_TOL_M (islas/costa).
      3. 'unassigned' : mas lejos -> offshore / coords malas. No se fuerza.
    """
    schema = (
        "gbif_key VARCHAR, kingdom VARCHAR, species VARCHAR, family VARCHAR, "
        "order_apg VARCHAR, department VARCHAR, assign_method VARCHAR, "
        "elevation DOUBLE, year INTEGER, basis_of_record VARCHAR"
    )
    if not _has(con, "gbif_occ_norm"):
        con.execute(f"CREATE OR REPLACE TABLE fact_occurrence ({schema})")
        print("[model] fact_occurrence: 0 (sin GBIF)")
        return
    apg_join = ("LEFT JOIN family_order_apg fo ON fo.family = g.family"
                if _has(con, "family_order_apg") else "")
    order_expr = 'fo."order"' if _has(con, "family_order_apg") else "CAST(NULL AS VARCHAR)"

    base = f"""
        SELECT
            g.gbif_key, g.kingdom, g.species, g.family,
            {order_expr}            AS order_apg,
            g.lon, g.lat,
            g.elevation, g.year, g.basis_of_record
        FROM gbif_occ_norm g
        {apg_join}
    """

    if not has_geo:
        con.execute(
            f"""
            CREATE OR REPLACE TABLE fact_occurrence AS
            WITH base AS ({base})
            SELECT gbif_key, kingdom, species, family, order_apg,
                   'unassigned' AS department, 'unassigned' AS assign_method,
                   elevation, year, basis_of_record
            FROM base
            """
        )
        n = con.sql("SELECT count(*) FROM fact_occurrence").fetchone()[0]
        print(f"[model] fact_occurrence: {n} registros (sin GeoJSON, todo unassigned)")
        return

    t = geo.TEMP_TABLE
    con.execute(
        f"""
        CREATE OR REPLACE TABLE fact_occurrence AS
        WITH base AS ({base}),
        contained AS (
            SELECT b.gbif_key, d.department,
                   row_number() OVER (PARTITION BY b.gbif_key ORDER BY d.department) AS rn
            FROM base b
            JOIN {t} d ON ST_Contains(d.geom, ST_Point(b.lon, b.lat))
        ),
        contained1 AS (SELECT gbif_key, department FROM contained WHERE rn = 1),
        uncontained AS (
            SELECT * FROM base
            WHERE gbif_key NOT IN (SELECT gbif_key FROM contained1)
        ),
        snap_cand AS (
            SELECT gbif_key, department, dist_m(lon, lat, ST_X(cp), ST_Y(cp)) AS m
            FROM (
                SELECT u.gbif_key, u.lon, u.lat, d.department,
                       ST_ClosestPoint(d.geom, ST_Point(u.lon, u.lat)) AS cp
                FROM uncontained u CROSS JOIN {t} d
            )
        ),
        snap_best AS (
            SELECT gbif_key, department, m,
                   row_number() OVER (PARTITION BY gbif_key ORDER BY m) AS rn
            FROM snap_cand
        ),
        snap1 AS (
            SELECT gbif_key, department FROM snap_best
            WHERE rn = 1 AND m <= {geo.SNAP_TOL_M}
        ),
        assign AS (
            SELECT gbif_key, department, 'contencion' AS assign_method FROM contained1
            UNION ALL
            SELECT gbif_key, department, 'snap' AS assign_method FROM snap1
        )
        SELECT
            b.gbif_key, b.kingdom, b.species, b.family, b.order_apg,
            coalesce(a.department, 'unassigned')    AS department,
            coalesce(a.assign_method, 'unassigned') AS assign_method,
            b.elevation, b.year, b.basis_of_record
        FROM base b
        LEFT JOIN assign a ON a.gbif_key = b.gbif_key
        """
    )
    by = dict(con.sql(
        "SELECT kingdom, count(*) FROM fact_occurrence GROUP BY 1"
    ).fetchall())
    am = dict(con.sql(
        "SELECT assign_method, count(*) FROM fact_occurrence GROUP BY 1"
    ).fetchall())
    print(f"[model] fact_occurrence: {sum(by.values())} registros · por reino={by} · "
          f"(contencion={am.get('contencion',0)}, snap={am.get('snap',0)}, "
          f"unassigned={am.get('unassigned',0)})")


def _fact_distribution(con) -> None:
    """Grano WCVP: taxon x area L3, con native/introduced/endemic/extinct."""
    if not (_has(con, "raw_wcvp_distributions") and _has(con, "wcvp_accepted")):
        con.execute(
            "CREATE OR REPLACE TABLE fact_distribution ("
            "taxon_id VARCHAR, area_l3 VARCHAR, introduced BOOLEAN, "
            "extinct BOOLEAN, location_doubtful BOOLEAN)"
        )
        print("[model] fact_distribution: 0 (sin WCVP)")
        return
    con.execute(
        """
        CREATE OR REPLACE TABLE fact_distribution AS
        SELECT
            d.plant_name_id                          AS taxon_id,
            d.area_code_l3                           AS area_l3,
            coalesce(try_cast(d.introduced AS INT),0)=1        AS introduced,
            coalesce(try_cast(d.extinct AS INT),0)=1           AS extinct,
            coalesce(try_cast(d.location_doubtful AS INT),0)=1 AS location_doubtful
        FROM raw_wcvp_distributions d
        JOIN wcvp_accepted a ON a.plant_name_id = d.plant_name_id
        """
    )
    n = con.sql("SELECT count(*) FROM fact_distribution").fetchone()[0]
    print(f"[model] fact_distribution: {n} filas taxon x area")
