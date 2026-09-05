"""Paso 4 (reino Fungi): checklist de hongos aceptados presentes en Peru.

A diferencia de las plantas (WCVP da distribucion por pais-botanico), para
hongos NO existe un checklist de distribucion curado equivalente: la presencia
en Peru se EVIDENCIA por ocurrencias GBIF. La sinonimia se resuelve via el
backbone GBIF (cuyo componente Fungi proviene de Index Fungorum, Kew): cada
ocurrencia trae su `speciesKey` = especie ACEPTADA, colapsando sinonimos.

`peru_fungi` = una fila por especie aceptada (speciesKey) con >=1 ocurrencia
georreferenciada en Peru, con familia/genero del backbone. Caveat fuerte: la
micobiota peruana esta MUCHO menos inventariada que la flora (esto es
evidencia de ocurrencias, no un inventario).
"""

from __future__ import annotations

import duckdb

from . import config as C


def _has(con, table: str) -> bool:
    return table in {r[0] for r in con.sql("SHOW TABLES").fetchall()}


def run() -> None:
    con = duckdb.connect(str(C.DUCKDB_PATH))
    try:
        if not _has(con, "gbif_fungi_clean"):
            print("[match:fungi] gbif_fungi_clean ausente; salteando")
            return

        # Especie ACEPTADA = speciesKey (el backbone GBIF/Index Fungorum colapsa
        # sinonimos a ese key). Agregamos por speciesKey -> una fila por especie.
        con.execute(
            """
            CREATE OR REPLACE TABLE peru_fungi AS
            WITH acc AS (
                SELECT
                    CAST(speciesKey AS VARCHAR)        AS taxon_id,
                    any_value(species)                 AS taxon_name,
                    any_value(family)                  AS family,
                    any_value(genus)                   AS genus,
                    count(*)                           AS n_records
                FROM gbif_fungi_clean
                WHERE speciesKey IS NOT NULL
                  AND nullif(trim(species), '') IS NOT NULL
                GROUP BY speciesKey
            )
            SELECT
                taxon_id,
                'Fungi'        AS kingdom,
                taxon_name,
                'Species'      AS taxon_rank,
                TRUE           AS is_species,
                genus,
                family,
                n_records,
                -- modo nutricional (saprotrofo/micorrizico/parasito/liquenizado):
                -- GBIF no lo trae -> sin dato honesto (futuro: FungalTraits).
                CAST(NULL AS VARCHAR)  AS lifeform_description,
                CAST(NULL AS VARCHAR)  AS climate_description,
                -- origen (nativa/introducida/endemica): sin backbone de
                -- distribucion curado para hongos -> desconocido (NULL honesto).
                CAST(NULL AS BOOLEAN)  AS native,
                CAST(NULL AS BOOLEAN)  AS introduced,
                CAST(NULL AS BOOLEAN)  AS endemic
            FROM acc
            """
        )
        r = con.sql(
            "SELECT count(*), count(DISTINCT family), count(DISTINCT genus) "
            "FROM peru_fungi"
        ).fetchone()
        print(f"[match:fungi] peru_fungi ({C.COUNTRY_L3}): {r[0]} especies aceptadas, "
              f"{r[1]} familias, {r[2]} generos (evidencia de ocurrencias GBIF)")
    finally:
        con.close()
