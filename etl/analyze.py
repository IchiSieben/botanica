"""Paso 6: capa estadistica (seccion 8 del spec). Exploratorio, con cautela.

Productos:
- indices de diversidad por region (riqueza, Shannon, Simpson, dominancia)
- estimadores de completitud (Chao1) por departamento -> zonas sub-muestreadas
- (futuro) modelos especie-area / altitudinales; PCA/NMDS Peru vs mundo; PD (Faith)
Cada producto documenta supuestos. correlacion != causalidad.
"""

from __future__ import annotations

import math

import duckdb

from . import config as C


def shannon(counts: list[int]) -> float:
    n = sum(counts)
    if n == 0:
        return 0.0
    return -sum((c / n) * math.log(c / n) for c in counts if c > 0)


def simpson(counts: list[int]) -> float:
    n = sum(counts)
    if n <= 1:
        return 0.0
    return 1.0 - sum(c * (c - 1) for c in counts) / (n * (n - 1))


def chao1(counts: list[int]) -> float:
    """Estimador de riqueza Chao1 (richness + correccion por singletons/doubletons)."""
    s_obs = sum(1 for c in counts if c > 0)
    f1 = sum(1 for c in counts if c == 1)
    f2 = sum(1 for c in counts if c == 2)
    if f2 > 0:
        return s_obs + (f1 * f1) / (2 * f2)
    return s_obs + (f1 * (f1 - 1)) / 2  # correccion bias-corrected cuando f2=0


def run() -> None:
    con = duckdb.connect(str(C.DUCKDB_PATH))
    try:
        tables = {r[0] for r in con.sql("SHOW TABLES").fetchall()}
        if "mart_family_composition" in tables and con.sql(
            "SELECT count(*) FROM mart_family_composition"
        ).fetchone()[0] > 0:
            # Diversidad por ahora solo Plantae (no mezclar reinos en un indice).
            counts = [r[0] for r in con.sql(
                "SELECT species FROM mart_family_composition "
                "WHERE species > 0 AND kingdom = 'Plantae'"
            ).fetchall()]
            metrics = {
                "n_familias": len(counts),
                "riqueza_total": sum(counts),
                "shannon_familias": round(shannon(counts), 4),
                "simpson_familias": round(simpson(counts), 4),
                "chao1_familias": round(chao1(counts), 2),
            }
            con.execute("CREATE OR REPLACE TABLE stats_diversity AS SELECT * FROM (VALUES " +
                        ",".join(f"('{k}', {v})" for k, v in metrics.items()) +
                        ") t(metric, value)")
            print(f"[analyze] stats_diversity: {metrics}")
        else:
            print("[analyze] mart_family_composition vacio; sin indices (corre --full)")
        print("[analyze] TODO: Chao1 por departamento, modelos especie-area, PCA Peru vs mundo")
    finally:
        con.close()
