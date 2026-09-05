"""CLI orquestador (reemplaza `make`, multiplataforma).

Uso:
    uv run atlas <comando> [--full] [--force]

Comandos:
    download   baja fuentes a data/raw (muestra por defecto; --full = WCVP+GBIF/DOI)
    load       carga data/raw -> DuckDB (tablas raw_*)
    clean      limpia ocurrencias GBIF -> gbif_clean
    match      normaliza a nombres aceptados WCVP -> peru_species, etc.
    aggregate  pre-agrega para dashboards -> agg_*
    analyze    capa estadistica -> stats_*
    export     exporta a data/exports (JSON + Parquet)
    profile    F0.5: genera docs/data_dictionary.md + perfilamiento.md
    data       pipeline completo: download->...->export->profile  (== "make data")
"""

from __future__ import annotations

import argparse
import sys

from . import (aggregate, analyze, build_apg, clean, config, download, export,
               load_duckdb, match_fungi, match_names, model, profile)

STEPS = {
    "download": lambda a: download.run(sample=not a.full, force=a.force),
    "load": lambda a: load_duckdb.run(),
    "clean": lambda a: clean.run(),
    "build_apg": lambda a: build_apg.run(),
    "match": lambda a: match_names.run(),
    "match_fungi": lambda a: match_fungi.run(),
    "model": lambda a: model.run(),
    "aggregate": lambda a: aggregate.run(),
    "analyze": lambda a: analyze.run(),
    "export": lambda a: export.run(),
    "profile": lambda a: profile.run(),
}

PIPELINE = ["download", "load", "clean", "build_apg", "match", "match_fungi",
            "model", "aggregate", "analyze", "export", "profile"]


def _run_data(a) -> None:
    print(f"== atlas data (full={a.full}) — pais L3={config.COUNTRY_L3} ==")
    for step in PIPELINE:
        print(f"\n--- {step} ---")
        STEPS[step](a)
    print("\n== pipeline completo ==")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="atlas", description="Atlas Botanico del Peru — ETL")
    p.add_argument("command", choices=[*STEPS.keys(), "data"])
    p.add_argument("--full", action="store_true",
                   help="descarga masiva real (WCVP completo + GBIF download/DOI)")
    p.add_argument("--sample", action="store_true",
                   help="modo muestra (por defecto): valida el modelo sin GBs en disco")
    p.add_argument("--force", action="store_true", help="ignora cache y rebaja")
    a = p.parse_args(argv)
    if a.sample and a.full:
        p.error("usa --sample O --full, no ambos")

    if a.command == "data":
        _run_data(a)
    else:
        STEPS[a.command](a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
