"""Construye el indice de especies que consume /especies/ en la web.

Es un paso de EXPORT, no del pipeline: abre la DuckDB en modo READ-ONLY y no
toca nada aguas arriba. Se corre a mano cuando cambian los datos:

    uv run python -m etl.build_species_index

Formato: columnar y posicional, no una lista de objetos. Con 25k especies, un
JSON de `{"name": ..., "family": ...}` repite las claves 25.000 veces y triplica
el peso. Aca las familias, ordenes y departamentos van a tablas de lookup y cada
especie guarda indices enteros.

Se emite un archivo POR REINO. Plantae y Fungi tienen dos ordenes de magnitud de
diferencia (21.5k vs 1.8k especies): quien mira hongos no deberia bajar el
indice de plantas.
"""

from __future__ import annotations

import json
from pathlib import Path

import duckdb

from . import config as C

OUT = C.EXPORTS.parent.parent / "web" / "public" / "data"

# Bits de estado: cabe en un entero y evita tres booleanos por especie.
NATIVE, INTRODUCED, ENDEMIC = 1, 2, 4


def build(con: duckdb.DuckDBPyConnection, kingdom: str) -> dict:
    taxa = con.execute(
        """
        SELECT taxon_name, family, order_apg, genus, lifeform, climate,
               COALESCE(native, FALSE), COALESCE(introduced, FALSE), COALESCE(endemic, FALSE)
        FROM dim_taxon
        WHERE kingdom = ? AND is_species
        ORDER BY taxon_name
        """,
        [kingdom],
    ).fetchall()

    # Ocurrencias y departamentos por especie, en una sola pasada.
    occ = con.execute(
        """
        SELECT species, department, COUNT(*) AS n
        FROM fact_occurrence
        WHERE kingdom = ? AND species IS NOT NULL AND department IS NOT NULL
        GROUP BY species, department
        """,
        [kingdom],
    ).fetchall()

    by_species: dict[str, list[tuple[str, int]]] = {}
    for sp, dep, n in occ:
        by_species.setdefault(sp, []).append((dep, n))

    families: list[str] = []
    orders: list[str] = []
    depts: list[str] = []
    lifeforms: list[str] = []

    def idx(pool: list[str], value: str | None) -> int:
        """Indice en la tabla de lookup; -1 para ausente (JSON mas corto que null)."""
        if not value:
            return -1
        try:
            return pool.index(value)
        except ValueError:
            pool.append(value)
            return len(pool) - 1

    rows = []
    for name, fam, order, genus, lifeform, climate, nat, intro, endem in taxa:
        deps = sorted(by_species.get(name, []), key=lambda x: -x[1])
        total = sum(n for _, n in deps)
        flags = (NATIVE if nat else 0) | (INTRODUCED if intro else 0) | (ENDEMIC if endem else 0)
        rows.append([
            name,
            idx(families, fam),
            idx(orders, order),
            total,
            # Solo los 6 departamentos con mas registros: la ficha no muestra mas
            # y guardar los 25 duplicaria el archivo.
            [[idx(depts, d), n] for d, n in deps[:6]],
            flags,
            idx(lifeforms, lifeform),
        ])

    return {
        "meta": {
            "kingdom": kingdom,
            "species": len(rows),
            "schema": ["name", "familyIdx", "orderIdx", "occurrences", "depts[[idx,n]]", "flags", "lifeformIdx"],
            "flags": {"native": NATIVE, "introduced": INTRODUCED, "endemic": ENDEMIC},
        },
        "families": families,
        "orders": orders,
        "depts": depts,
        "lifeforms": lifeforms,
        "rows": rows,
    }


def run() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(C.DUCKDB_PATH), read_only=True)
    try:
        written = []
        for kingdom in ("Plantae", "Fungi"):
            data = build(con, kingdom)
            path = OUT / f"species-{kingdom.lower()}.json"
            # separators sin espacios: ~15% menos peso, y nadie lee esto a mano.
            path.write_text(
                json.dumps(data, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            mb = path.stat().st_size / 1048576
            written.append(f"{path.name} ({data['meta']['species']:,} especies, {mb:.2f} MB)")
        print("[species-index] ->", " · ".join(written))
    finally:
        con.close()


if __name__ == "__main__":
    run()
