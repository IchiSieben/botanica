"""Mapeo familia -> orden (APG IV), DERIVADO de datos (no a mano).

Fuentes (ambas son datos publicados ya en disco, NO memoria):
- Tree of Life (Kew): etiquetas `id_bool_Orden_Familia_Genero_especie` -> (orden, familia).
  Cubre ~todas las familias de plantas vasculares; es consistente con APG IV.
- GBIF backbone: campo `order` por `family` en las ocurrencias (respaldo/contraste).

Conflictos (una familia con >1 orden entre fuentes) se resuelven por soporte
(conteo) y se reportan. Si tras unir quedan familias de WCVP-Peru sin orden, se
listan para revision y se respaldan con `data/raw/apg_iv_published.csv` si existe.

Salida: `data/raw/apg_iv.csv` (columns: family, order). Coverage -> docs/perfilamiento.md (via profile).
"""

from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict

import duckdb

from . import config as C

APG_CSV = C.RAW / "apg_iv.csv"
PUBLISHED_FALLBACK = C.RAW / "apg_iv_published.csv"

# token de punta: digitos _ true|false _ Orden _ Familia _ Genero _ especie...
_TIP = re.compile(r"\d+_(?:true|false)_([A-Z][a-zA-Z-]+)_([A-Z][a-zA-Z-]+)_")


def _from_tol() -> Counter:
    """(family, order) -> soporte, desde las etiquetas del Newick."""
    path = C.RAW / "treeoflife.tree"
    pairs: Counter = Counter()
    if not path.exists():
        print("[apg] treeoflife.tree ausente; sin aporte ToL")
        return pairs
    txt = path.read_text(encoding="utf-8")
    for order, family in _TIP.findall(txt):
        pairs[(family, order)] += 1
    print(f"[apg] ToL: {len(pairs)} pares (familia,orden) unicos")
    return pairs


def _from_gbif(con) -> Counter:
    """(family, order) -> soporte, desde el backbone GBIF de las ocurrencias."""
    tables = {r[0] for r in con.sql("SHOW TABLES").fetchall()}
    src = "gbif_clean" if "gbif_clean" in tables else (
        "raw_gbif_occurrences" if "raw_gbif_occurrences" in tables else None)
    pairs: Counter = Counter()
    if not src:
        print("[apg] sin tabla GBIF; sin aporte GBIF")
        return pairs
    cols = {r[1] for r in con.sql(f"PRAGMA table_info('{src}')").fetchall()}
    if "order" not in cols or "family" not in cols:
        return pairs
    rows = con.sql(
        f'SELECT family, "order", count(*) n FROM {src} '
        'WHERE family IS NOT NULL AND "order" IS NOT NULL GROUP BY 1,2'
    ).fetchall()
    for family, order, n in rows:
        pairs[(family, order)] += int(n)
    print(f"[apg] GBIF: {len(pairs)} pares (familia,orden)")
    return pairs


def _from_gbif_fungi(con) -> Counter:
    """(family, order) -> soporte, desde las ocurrencias de hongos (backbone GBIF).
    Las familias de Fungi no estan en el arbol PAFTOL (plantas), asi que su orden
    sale de aca."""
    tables = {r[0] for r in con.sql("SHOW TABLES").fetchall()}
    pairs: Counter = Counter()
    if "gbif_fungi_clean" not in tables:
        return pairs
    rows = con.sql(
        'SELECT family, "order", count(*) n FROM gbif_fungi_clean '
        'WHERE family IS NOT NULL AND "order" IS NOT NULL GROUP BY 1,2'
    ).fetchall()
    for family, order, n in rows:
        pairs[(family, order)] += int(n)
    print(f"[apg] GBIF Fungi: {len(pairs)} pares (familia,orden)")
    return pairs


def _resolve(*sources: Counter) -> tuple[dict, list]:
    """Une fuentes; por familia elige el orden con mayor soporte. Reporta conflictos."""
    by_family: dict[str, Counter] = defaultdict(Counter)
    for src in sources:
        for (family, order), w in src.items():
            by_family[family][order] += w
    mapping, conflicts = {}, []
    for family, orders in by_family.items():
        best, _ = orders.most_common(1)[0]
        mapping[family] = best
        if len(orders) > 1:
            conflicts.append((family, dict(orders), best))
    return mapping, conflicts


def _load_published_fallback(mapping: dict) -> int:
    """Rellena familias faltantes desde una tabla APG IV publicada, si esta presente."""
    if not PUBLISHED_FALLBACK.exists():
        return 0
    added = 0
    with PUBLISHED_FALLBACK.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            fam, order = row.get("family"), row.get("order")
            if fam and order and fam not in mapping:
                mapping[fam] = order
                added += 1
    if added:
        print(f"[apg] respaldo publicado: +{added} familias")
    return added


def run() -> dict:
    con = duckdb.connect(str(C.DUCKDB_PATH))
    try:
        mapping, conflicts = _resolve(_from_tol(), _from_gbif(con), _from_gbif_fungi(con))
        _load_published_fallback(mapping)

        with APG_CSV.open("w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["family", "order"])
            for fam in sorted(mapping):
                w.writerow([fam, mapping[fam]])
        print(f"[apg] -> {APG_CSV} ({len(mapping)} familias)")

        # Carga la tabla en DuckDB aqui (no depende de WCVP/match, asi existe
        # tambien en modo muestra para dim_clade y fact_occurrence.order_apg).
        con.execute(
            "CREATE OR REPLACE TABLE family_order_apg AS "
            "SELECT * FROM read_csv(?, header=true, all_varchar=true)",
            [str(APG_CSV)],
        )
        if conflicts:
            print(f"[apg] {len(conflicts)} conflictos resueltos por soporte "
                  f"(ej: {conflicts[0][0]} -> {conflicts[0][2]})")

        # Cobertura contra el universo en scope (WCVP-Peru si existe, si no GBIF).
        cov = _coverage(con, mapping)
        return {"families": len(mapping), "conflicts": len(conflicts), **cov}
    finally:
        con.close()


def _coverage(con, mapping: dict) -> dict:
    tables = {r[0] for r in con.sql("SHOW TABLES").fetchall()}
    if "peru_species" in tables:
        fams = [r[0] for r in con.sql(
            "SELECT DISTINCT family FROM peru_species WHERE family IS NOT NULL"
        ).fetchall()]
        scope = "WCVP-Peru"
    elif "gbif_clean" in tables:
        fams = [r[0] for r in con.sql(
            "SELECT DISTINCT family FROM gbif_clean WHERE family IS NOT NULL"
        ).fetchall()]
        scope = "GBIF-muestra"
    else:
        return {"scope": "n/a", "pct": 0.0, "unmapped": []}
    unmapped = sorted(f for f in fams if f not in mapping)
    pct = round(100.0 * (len(fams) - len(unmapped)) / len(fams), 1) if fams else 0.0
    print(f"[apg] cobertura familia->orden ({scope}): {pct}% "
          f"({len(fams)-len(unmapped)}/{len(fams)}); sin mapear: {len(unmapped)}")
    if unmapped:
        print(f"[apg] no mapeadas: {unmapped[:15]}{' ...' if len(unmapped)>15 else ''}")
    return {"scope": scope, "pct": pct, "unmapped": unmapped}
