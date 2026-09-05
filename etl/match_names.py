"""Paso 4: normalizacion a nombres ACEPTADOS de WCVP (principio 2).

Toda metrica taxonomica se cuenta sobre nombres aceptados. Aca construimos:
- `wcvp_accepted`: nombres con taxon_status='Accepted' resueltos (TODOS los rangos:
  especie, infraespecificos y genero). El conteo titular usa SOLO rango especie.
- `peru_species`: taxones aceptados presentes en Peru (area_code_l3=PER) a nivel
  especie o infraespecifico (se excluyen Genus/Family). Lleva `taxon_rank`,
  `is_species` (rango Species), y los flags native/introduced/endemic.
  Endemismo = especie NATIVA cuyo unico area_code_l3 = PER.
- `family_order_apg`: mapa familia->orden (APG IV); WCVP solo llega a familia.

OJO con la inflacion: "nombres aceptados" incluye infraespecificos; "especies"
(rango Species) es el titular. Se reportan por separado (ver profile).

GBIF se reconcilia por acceptedTaxonKey / nombre aceptado en aggregate.
"""

from __future__ import annotations

import duckdb

from . import config as C

# Rangos infraespecificos aceptados en WCVP (subordinados a una especie).
INFRA_RANKS = (
    "Subspecies", "Variety", "Form", "Subvariety",
    "nothosubsp.", "nothovar.", "nothof.",
)


def _has(con, table: str) -> bool:
    return table in {r[0] for r in con.sql("SHOW TABLES").fetchall()}


def run() -> None:
    con = duckdb.connect(str(C.DUCKDB_PATH))
    try:
        if not _has(con, "raw_wcvp_names"):
            print("[match] raw_wcvp_names ausente; salteando (corre download --full)")
            return

        # Nombres aceptados (resolviendo via accepted_plant_name_id).
        con.execute(
            """
            CREATE OR REPLACE TABLE wcvp_accepted AS
            SELECT
                plant_name_id,
                accepted_plant_name_id,
                taxon_status,
                taxon_rank,
                family,
                genus,
                species,
                taxon_name,
                taxon_authors,
                lifeform_description,
                climate_description
            FROM raw_wcvp_names
            WHERE taxon_status = 'Accepted'
            """
        )
        n_acc = con.sql("SELECT count(*) FROM wcvp_accepted").fetchone()[0]
        n_sp = con.sql(
            "SELECT count(*) FROM wcvp_accepted WHERE taxon_rank='Species'"
        ).fetchone()[0]
        n_infra = con.sql(
            f"SELECT count(*) FROM wcvp_accepted WHERE taxon_rank IN {INFRA_RANKS}"
        ).fetchone()[0]
        print(f"[match] wcvp_accepted (global): {n_acc} nombres aceptados (todos los rangos) "
              f"= {n_sp} especies (rango Species) + {n_infra} infraespecificos + "
              f"{n_acc - n_sp - n_infra} otros (Genus/Family)")

        if _has(con, "raw_wcvp_distributions"):
            # peru_species: rango especie + infraespecificos (se excluyen Genus/Family).
            #   native     = no introducida en Peru (introduced=0 en area PER).
            #   introduced = introducida en Peru (introduced=1 en area PER).
            #   endemic    = NATIVA cuyo unico area_code_l3 es el pais objetivo.
            con.execute(
                f"""
                CREATE OR REPLACE TABLE peru_species AS
                WITH dist AS (
                    SELECT plant_name_id, area_code_l3,
                           coalesce(try_cast(introduced AS INT), 0) AS introduced
                    FROM raw_wcvp_distributions
                    WHERE coalesce(try_cast(location_doubtful AS INT),0)=0
                ),
                in_country AS (
                    SELECT plant_name_id,
                           max(introduced) AS introduced
                    FROM dist WHERE area_code_l3 = '{C.COUNTRY_L3}'
                    GROUP BY plant_name_id
                ),
                ranges AS (
                    SELECT plant_name_id, count(DISTINCT area_code_l3) AS n_areas
                    FROM dist GROUP BY plant_name_id
                )
                SELECT a.*,
                       (a.taxon_rank = 'Species')              AS is_species,
                       ic.introduced,
                       (ic.introduced = 0)                     AS native,
                       (ic.introduced = 0 AND r.n_areas = 1)   AS endemic
                FROM wcvp_accepted a
                JOIN in_country ic USING (plant_name_id)
                JOIN ranges r USING (plant_name_id)
                WHERE a.taxon_rank = 'Species' OR a.taxon_rank IN {INFRA_RANKS}
                """
            )
            r = con.sql(
                """
                SELECT
                    count(*) FILTER (WHERE is_species)                       AS species,
                    count(*) FILTER (WHERE NOT is_species)                   AS infra,
                    count(*) FILTER (WHERE is_species AND native)            AS native,
                    count(*) FILTER (WHERE is_species AND introduced)        AS introduced,
                    count(*) FILTER (WHERE is_species AND endemic)           AS endemic
                FROM peru_species
                """
            ).fetchone()
            rate = round(100.0 * r[4] / r[0], 1) if r[0] else 0.0
            print(f"[match] peru_species ({C.COUNTRY_L3}): {r[0]} especies (rango Species) "
                  f"+ {r[1]} infraespecificos")
            print(f"[match]   nativas={r[2]} · introducidas={r[3]} · "
                  f"endemicas={r[4]} ({rate}% de las especies)")
        else:
            print("[match] raw_wcvp_distributions ausente; sin peru_species")
        # family_order_apg lo construye el paso build_apg (corre antes que match).
    finally:
        con.close()
