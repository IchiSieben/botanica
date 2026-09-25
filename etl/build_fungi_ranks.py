"""Fungal order -> (phylum, class), derived from the GBIF records themselves.

The taxonomy tree (web, /filogenia/?k=fungi) places each fungal order under its
phylum and class. GBIF's backbone (Index Fungorum for fungi) gives every record a
phylum, class and order; one order can in principle carry more than one class
across records (backbone changes, misapplied names), so each order takes the
MAJORITY (phylum, class) by occurrence count and the minority classes are
written out with their counts instead of being dropped silently.

Input : `gbif_fungi_clean` in data/atlas.duckdb, opened READ ONLY.
Output: etl/mappings/fungi_order_ranks_v1.csv
        columns order, phylum, class, n_occurrences, conflicts
        (conflicts = "Class:n; Class:n" for minority classes, empty when none).

Run from the repo root:
    uv run python -m etl.build_fungi_ranks [--db PATH]
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter, defaultdict
from pathlib import Path

import duckdb

from . import config as C

OUT = C.ROOT / "etl" / "mappings" / "fungi_order_ranks_v1.csv"

QUERY = """
    SELECT "order" AS ord, phylum, class, count(*) AS n
    FROM gbif_fungi_clean
    WHERE "order" IS NOT NULL
    GROUP BY ALL
"""


def build(db: Path) -> list[dict]:
    con = duckdb.connect(str(db), read_only=True)
    try:
        rows = con.sql(QUERY).fetchall()
    finally:
        con.close()

    per_order: dict[str, Counter] = defaultdict(Counter)
    for ord_, phylum, klass, n in rows:
        per_order[ord_][(phylum or "", klass or "")] += int(n)

    out = []
    for ord_ in sorted(per_order):
        counts = per_order[ord_]
        # Majority by occurrences; ties broken by name so the file is stable.
        ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        (phylum, klass), _ = ranked[0]
        minority = "; ".join(f"{c or '(none)'}:{n}" for (_, c), n in ranked[1:])
        out.append({
            "order": ord_,
            "phylum": phylum,
            "class": klass,
            "n_occurrences": sum(counts.values()),
            "conflicts": minority,
        })
    return out


def run(db: Path = C.DUCKDB_PATH, out: Path = OUT) -> dict:
    rows = build(db)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["order", "phylum", "class", "n_occurrences", "conflicts"],
                           lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    conflicts = sum(1 for r in rows if r["conflicts"])
    missing = sum(1 for r in rows if not r["phylum"] or not r["class"])
    print(f"[fungi-ranks] -> {out} ({len(rows)} orders, {conflicts} with minority classes, "
          f"{missing} without phylum/class)")
    return {"orders": len(rows), "conflicts": conflicts, "missing": missing}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--db", type=Path, default=C.DUCKDB_PATH, help="atlas.duckdb (opened read-only)")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    run(args.db, args.out)


if __name__ == "__main__":
    main()
