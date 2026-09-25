"""Genera etl/mappings/growth_form_groups_v1.csv: WCVP lifeform_description -> grupo.

Se corre UNA vez para sembrar el CSV; desde ahi el CSV es la fuente de verdad (versionado,
revisable a mano). El export (build_species_index) lee el CSV, no estas reglas.

    uv run python -m etl.build_growth_form_map

Reglas, en orden (la primera que aplica gana):
1. parasit*                          -> parasite
2. epiphyt* | lithophyt*             -> epiphyte   (el habito domina al porte: "epiphytic subshrub")
3. climb* | liana | scrambl* | vine | twin*  -> climber
4. hydro* | helophyt* | aquatic      -> aquatic
5. succulent                         -> succulent
6. geophyte                          -> geophyte
7. primer termino de "A or B":  tree -> tree; shrub | subshrub | bamboo -> shrub;
   annual | biennial | perennial | herb -> herb.  (WCVP lista primero el porte principal)
8. resto                             -> other
"""
from __future__ import annotations

import csv
import re

import duckdb

from . import config as C

OUT = C.EXPORTS.parent.parent / "etl" / "mappings" / "growth_form_groups_v1.csv"
GROUPS = ["tree", "shrub", "herb", "geophyte", "climber", "epiphyte", "succulent", "aquatic", "parasite", "other"]


def group(raw: str) -> tuple[str, str]:
    s = raw.lower()
    for pat, g, why in [
        (r"parasit", "parasite", "rule 1 parasite"),
        (r"epiphyt|lithophyt", "epiphyte", "rule 2 epiphyte/lithophyte"),
        (r"climb|liana|scrambl|\bvine|twin", "climber", "rule 3 climbing habit"),
        (r"hydro|helophyt|aquatic", "aquatic", "rule 4 aquatic"),
        (r"succulent", "succulent", "rule 5 succulent"),
        (r"geophyte", "geophyte", "rule 6 geophyte"),
    ]:
        if re.search(pat, s):
            return g, why
    first = re.split(r"\s+or\s+|,", s)[0].strip().split()[-1] if s.strip() else ""
    if first == "tree":
        return "tree", "rule 7 first term tree"
    if first in {"shrub", "subshrub", "bamboo"}:
        return "shrub", f"rule 7 first term {first}"
    if first in {"annual", "biennial", "perennial", "herb", "monocarpic"}:
        return "herb", f"rule 7 first term {first}"
    return "other", "rule 8 unmatched"


def run() -> None:
    con = duckdb.connect(str(C.DUCKDB_PATH), read_only=True)
    rows = con.execute(
        "SELECT lifeform, count(*) FROM dim_taxon WHERE kingdom='Plantae' AND is_species AND lifeform IS NOT NULL "
        "GROUP BY 1 ORDER BY 2 DESC, 1"
    ).fetchall()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["raw_wcvp", "group", "n_species_peru", "rule"])
        for raw, n in rows:
            g, why = group(raw)
            w.writerow([raw, g, n, why])
    print(f"[growth-form] {len(rows)} strings -> {OUT}")


if __name__ == "__main__":
    run()
