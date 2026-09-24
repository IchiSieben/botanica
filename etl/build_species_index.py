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
        # Desempate por nombre: GROUP BY no garantiza orden y, sin esto, los empates
        # cambian de lugar (y de top-6) en cada corrida.
        deps = sorted(by_species.get(name, []), key=lambda x: (-x[1], x[0]))
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


def departments(con: duckdb.DuckDBPyConnection) -> list[str]:
    """Los 25 departamentos en orden alfabetico: el bit i de `mask` es depts[i].
    Sale de dim_geo (los mismos nombres que NOMBDEP del GeoJSON)."""
    return [r[0] for r in con.execute("SELECT department FROM dim_geo ORDER BY department").fetchall()]


def build_facets(con: duckdb.DuckDBPyConnection, kingdom: str, index: dict) -> dict:
    """Facetas por especie para el explorador: una columna por atributo, alineada
    fila a fila con `index["rows"]` (mismo ORDER BY taxon_name).

    Sin nombres a proposito: el explorador cruza filtros sobre enteros y solo baja
    los nombres (species-*.json) cuando alguien abre el buscador.

    Los conteos de especies salen del checklist (dim_taxon), no de todos los
    nombres de GBIF: asi el mapa filtrado y el KPI "especies" cuentan el mismo
    universo. Ver docs/AUDIT-v2.md, "Reconciliacion".
    """
    depts = departments(con)
    bit = {d: 1 << i for i, d in enumerate(depts)}

    masks: dict[str, int] = {}
    for sp, dep in con.execute(
        """
        SELECT DISTINCT species, department FROM fact_occurrence
        WHERE kingdom = ? AND species IS NOT NULL AND department IS NOT NULL
        """,
        [kingdom],
    ).fetchall():
        if dep in bit:  # 'unassigned' no es un poligono
            masks[sp] = masks.get(sp, 0) | bit[dep]

    # Año de descripcion: WCVP `first_published` ("(1753)") del basionimo cuando
    # existe (la descripcion original), si no del nombre aceptado. Sin el basionimo,
    # un tercio de las especies transferidas de genero caia en el año del nombre nuevo.
    # Solo plantas; hongos no tienen una fuente equivalente en el atlas.
    years: dict[str, int] = {}
    if kingdom == "Plantae":
        for name, y in con.execute(
            r"""
            WITH y AS (
                SELECT a.taxon_name,
                       try_cast(regexp_extract(w.first_published, '\((\d{4})\)', 1) AS INTEGER) AS cur,
                       try_cast(regexp_extract(b.first_published, '\((\d{4})\)', 1) AS INTEGER) AS bas
                FROM wcvp_accepted a
                JOIN raw_wcvp_names w ON w.plant_name_id = a.plant_name_id
                LEFT JOIN raw_wcvp_names b ON b.plant_name_id = w.basionym_plant_name_id
                WHERE a.taxon_rank = 'Species'
            )
            SELECT taxon_name, min(coalesce(least(cur, bas), cur, bas))
            FROM y
            GROUP BY 1
            """
        ).fetchall():
            if y:
                years[name] = y

    rows = index["rows"]
    return {
        "meta": {
            "kingdom": kingdom,
            "species": len(rows),
            "flags": index["meta"]["flags"],
            "yearSource": "WCVP first_published (basionym if any)" if years else None,
        },
        "depts": depts,
        "families": index["families"],
        "orders": index["orders"],
        "lifeforms": index["lifeforms"],
        # Columnas. -1 = sin dato; year 0 = sin dato; mask 0 = sin ocurrencias.
        "fam": [r[1] for r in rows],
        "ord": [r[2] for r in rows],
        "life": [r[6] for r in rows],
        "flags": [r[5] for r in rows],
        "mask": [masks.get(r[0], 0) for r in rows],
        "year": [years.get(r[0], 0) for r in rows] if years else None,
    }


def _write(path: Path, data: dict) -> float:
    # separators sin espacios: ~15% menos peso, y nadie lee esto a mano.
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return path.stat().st_size / 1048576


def run() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(C.DUCKDB_PATH), read_only=True)
    try:
        written = []
        for kingdom in ("Plantae", "Fungi"):
            data = build(con, kingdom)
            mb = _write(OUT / f"species-{kingdom.lower()}.json", data)
            written.append(f"species-{kingdom.lower()}.json ({data['meta']['species']:,} especies, {mb:.2f} MB)")
            mb = _write(OUT / f"facets-{kingdom.lower()}.json", build_facets(con, kingdom, data))
            written.append(f"facets-{kingdom.lower()}.json ({mb:.2f} MB)")
        print("[species-index] ->", " · ".join(written))
    finally:
        con.close()


if __name__ == "__main__":
    run()
