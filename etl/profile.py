"""F0.5 — PERFILAMIENTO: introspecciona cada tabla y genera el diccionario.

Salidas:
- docs/data_dictionary.md : por cada tabla, todas las columnas con tipo,
  % no nulos (cobertura) y cardinalidad (distintos).
- docs/perfilamiento.md   : conteos base de Peru + cruces viables y su cobertura.

Esto es el entregable bloqueante antes de F1 (dashboards).
"""

from __future__ import annotations

from datetime import datetime, timezone

import duckdb

from . import config as C


def _tables(con) -> list[str]:
    return [r[0] for r in con.sql("SHOW TABLES").fetchall()]


def _profile_table(con, table: str) -> list[dict]:
    total = con.sql(f"SELECT count(*) FROM {table}").fetchone()[0]
    info = con.sql(f"PRAGMA table_info('{table}')").fetchall()
    rows = []
    for col in info:
        name, dtype = col[1], col[2]
        if total:
            nn = con.sql(
                f'SELECT count("{name}") FROM {table}'
            ).fetchone()[0]
            card = con.sql(
                f'SELECT count(DISTINCT "{name}") FROM {table}'
            ).fetchone()[0]
            cov = round(100.0 * nn / total, 1)
        else:
            card, cov = 0, 0.0
        rows.append({"column": name, "type": dtype, "coverage_pct": cov,
                     "distinct": card})
    return rows


def _data_dictionary(con) -> str:
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    out = ["# Diccionario de datos (auto-generado)\n",
           f"> Generado: {stamp} · pais L3 = `{C.COUNTRY_L3}`\n",
           "> Una fila por columna: tipo, cobertura (% no nulos) y cardinalidad.\n"]
    tables = _tables(con)
    if not tables:
        out.append("\n_(No hay tablas cargadas todavia. Corre `atlas load`.)_\n")
        return "\n".join(out)
    for t in tables:
        total = con.sql(f"SELECT count(*) FROM {t}").fetchone()[0]
        out.append(f"\n## `{t}` — {total} filas\n")
        out.append("| columna | tipo | cobertura % | distintos |")
        out.append("|---|---|---:|---:|")
        for r in _profile_table(con, t):
            out.append(f"| `{r['column']}` | {r['type']} | {r['coverage_pct']} | {r['distinct']} |")
        out.append("")
    return "\n".join(out)


def _perfilamiento(con) -> str:
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    tables = set(_tables(con))
    out = ["# Perfilamiento — conteos base y cruces viables (auto-generado)\n",
           f"> Generado: {stamp}\n"]

    out.append("\n## Conteos base de Peru\n")
    out.append("> Titular = **especies (rango Species)**. Los infraespecificos "
               "(subespecie/variedad/forma) y los rangos superiores (genero/familia) "
               "se cuentan aparte para no inflar el conteo.\n")
    if "peru_species" in tables:
        r = con.sql(
            """
            SELECT
                count(*) FILTER (WHERE is_species)               AS species,
                count(*) FILTER (WHERE NOT is_species)           AS infra,
                count(*) FILTER (WHERE is_species AND native)    AS native,
                count(*) FILTER (WHERE is_species AND introduced) AS introduced,
                count(*) FILTER (WHERE is_species AND endemic)   AS endemic,
                count(DISTINCT family) FILTER (WHERE is_species)  AS families,
                count(DISTINCT genus)  FILTER (WHERE is_species)  AS genera,
                round(100.0*count(*) FILTER (WHERE is_species AND
                      coalesce(trim(lifeform_description),'')<>'')
                      / nullif(count(*) FILTER (WHERE is_species),0), 1) AS lifeform_cov
            FROM peru_species
            """
        ).fetchone()
        sp, infra, nat, intro, end, nf, ng, lf = r
        rate = round(100.0*end/sp, 1) if sp else 0.0
        out += [
            f"- **Especies (rango Species): {sp}** · + **{infra}** taxones infraespecificos",
            f"- Nativas: **{nat}** · Introducidas: **{intro}** (separadas; "
            "el titular de flora nativa son las nativas)",
            f"- Endemicas (especies nativas con unico area = `{C.COUNTRY_L3}`): "
            f"**{end}** ({rate}% de las especies)",
            f"- Familias: **{nf}** · Generos: **{ng}** (a nivel especie)",
            f"- Cobertura de `lifeform_description` (especies): **{lf}%**",
        ]
    else:
        out.append("_peru_species ausente — corre el pipeline con `--full` (WCVP)._")

    out.append("\n## Reino Fungi (hongos) — conteos base de Peru\n")
    out.append("> Caveat fuerte: la micobiota peruana esta MUCHISIMO menos inventariada que "
               "la flora. Backbone = Index Fungorum (via GBIF Backbone); la presencia en "
               "Peru es EVIDENCIA de ocurrencias GBIF (no hay checklist de distribucion "
               "curado como WCVP). Sinonimia resuelta a `speciesKey` aceptado antes de contar.\n")
    if "peru_fungi" in tables:
        r = con.sql(
            "SELECT count(*), count(DISTINCT family), count(DISTINCT genus) FROM peru_fungi"
        ).fetchone()
        occ = occ_as = 0
        if "fact_occurrence" in tables:
            occ = con.sql("SELECT count(*) FROM fact_occurrence WHERE kingdom='Fungi'").fetchone()[0]
            occ_as = con.sql("SELECT count(*) FROM fact_occurrence WHERE kingdom='Fungi' "
                             "AND department<>'unassigned'").fetchone()[0]
        pct_as = round(100.0*occ_as/occ, 1) if occ else 0.0
        out += [
            f"- **Especies aceptadas (rango Species): {r[0]}**",
            f"- Familias: **{r[1]}** · Generos: **{r[2]}**",
            f"- Registros GBIF (reino Fungi): **{occ}** · asignados a departamento: "
            f"**{occ_as}** ({pct_as}%)",
            "- Origen (nativa/introducida/endemica) y modo nutricional: **sin dato** "
            "(no hay backbone curado; futuro: FungalTraits).",
            "- Comparacion honesta: ~21,585 especies de plantas vs este puñado de hongos "
            "= micobiota fuertemente subinventariada, no menor diversidad real.",
        ]
    else:
        out.append("_peru_fungi ausente — corre `atlas match_fungi`._")

    out.append("\n## Muestra global de referencia\n")
    if "wcvp_accepted" in tables:
        g = con.sql("SELECT count(*) FROM wcvp_accepted").fetchone()[0]
        gs = con.sql(
            "SELECT count(*) FROM wcvp_accepted WHERE taxon_rank='Species'"
        ).fetchone()[0]
        out += [
            f"- Nombres aceptados WCVP, **todos los rangos** (global): **{g}**",
            f"- De esos, **especies (rango Species)**: **{gs}** "
            f"(la diferencia son infraespecificos y rangos superiores).",
        ]
    else:
        out.append("_wcvp_accepted ausente — corre `--full`._")

    out.append("\n## Mapeo familia -> orden (APG IV, derivado de datos)\n")
    if "family_order_apg" in tables:
        nf = con.sql("SELECT count(*) FROM family_order_apg").fetchone()[0]
        scope_tbl = "peru_species" if "peru_species" in tables else (
            "gbif_clean" if "gbif_clean" in tables else None)
        if scope_tbl:
            # En WCVP-Peru el scope son las familias a nivel especie (rango Species).
            where = "family IS NOT NULL"
            if scope_tbl == "peru_species":
                where += " AND is_species"
            where_s = where.replace("family IS NOT NULL", "s.family IS NOT NULL")
            fams = con.sql(
                f"SELECT count(DISTINCT family) FROM {scope_tbl} WHERE {where}"
            ).fetchone()[0]
            mapped = con.sql(
                f"SELECT count(DISTINCT s.family) FROM {scope_tbl} s "
                f"JOIN family_order_apg a ON a.family = s.family WHERE {where_s}"
            ).fetchone()[0]
            pct = round(100.0 * mapped / fams, 1) if fams else 0.0
            scope = "WCVP-Peru" if scope_tbl == "peru_species" else "GBIF-muestra"
            out += [f"- Tabla `family_order_apg`: **{nf}** familias mapeadas (global).",
                    f"- Cobertura sobre familias en scope ({scope}, rango especie): "
                    f"**{pct}%** ({mapped}/{fams}).",
                    "- Familias sin orden se listan en el log de `atlas build_apg`."]
    else:
        out.append("_family_order_apg ausente — corre `atlas build_apg`._")

    out.append("\n## Cruces viables y cobertura\n")
    out.append("| cruce | llave | estado |")
    out.append("|---|---|---|")
    out.append(f"| WCVP ⨝ GBIF | nombre aceptado / acceptedTaxonKey | "
               f"{'datos presentes' if {'peru_species','gbif_clean'}<=tables else 'pendiente datos'} |")
    out.append("| WCVP ⨝ Tree of Life | genero | pendiente (cargar Newick) |")
    out.append("| WCVP/IPNI published | año de publicacion | pendiente (IPNI on-demand) |")
    out.append("\n> Caveats: sesgo de muestreo GBIF; WCVP a nivel pais-botanico; "
               "filogenia a nivel genero; sinonimia resuelta antes de contar; "
               "cobertura incompleta de lifeform/climate.\n")
    return "\n".join(out)


def run() -> None:
    con = duckdb.connect(str(C.DUCKDB_PATH))
    try:
        C.DOCS.mkdir(parents=True, exist_ok=True)
        (C.DOCS / "data_dictionary.md").write_text(_data_dictionary(con), encoding="utf-8")
        (C.DOCS / "perfilamiento.md").write_text(_perfilamiento(con), encoding="utf-8")
        print(f"[profile] -> {C.DOCS/'data_dictionary.md'}")
        print(f"[profile] -> {C.DOCS/'perfilamiento.md'}")
    finally:
        con.close()
