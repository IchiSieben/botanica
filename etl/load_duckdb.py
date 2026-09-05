"""Paso 2: carga de data/raw a DuckDB en tablas crudas (schema `raw`).

Resiliente: carga lo que exista. Si una fuente no fue descargada todavia,
loguea y sigue, asi el esqueleto corre de punta a punta con muestras.
Las tablas crudas se prefijan raw_* y son la entrada de clean/match.
"""

from __future__ import annotations

from pathlib import Path

import duckdb

from . import config as C


def _connect() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(C.DUCKDB_PATH))


def _load_wcvp(con: duckdb.DuckDBPyConnection) -> None:
    wcvp_dir = C.RAW / "wcvp"
    if not wcvp_dir.exists():
        print("[load] wcvp ausente; salteando (corre download --full)")
        return
    # WCVP entrega csv delimitados por '|'. Buscamos por nombre.
    def _find(stub: str) -> Path | None:
        hits = list(wcvp_dir.rglob(f"*{stub}*.csv")) + list(wcvp_dir.rglob(f"*{stub}*.txt"))
        return hits[0] if hits else None

    names = _find("names")
    dists = _find("distribution")
    if names:
        con.execute(
            "CREATE OR REPLACE TABLE raw_wcvp_names AS "
            "SELECT * FROM read_csv(?, delim='|', header=true, "
            "quote='', sample_size=-1, all_varchar=true)",
            [str(names)],
        )
        n = con.sql("SELECT count(*) FROM raw_wcvp_names").fetchone()[0]
        print(f"[load] raw_wcvp_names <- {names.name} ({n} filas)")
    if dists:
        con.execute(
            "CREATE OR REPLACE TABLE raw_wcvp_distributions AS "
            "SELECT * FROM read_csv(?, delim='|', header=true, "
            "quote='', sample_size=-1, all_varchar=true)",
            [str(dists)],
        )
        n = con.sql("SELECT count(*) FROM raw_wcvp_distributions").fetchone()[0]
        print(f"[load] raw_wcvp_distributions <- {dists.name} ({n} filas)")


def _sealed_tsv(manifest_key: str) -> Path | None:
    """TSV de la descarga reproducible (DOI) de un reino, segun el manifiesto."""
    entry = C.Manifest.load().get(manifest_key) or {}
    key = entry.get("download_key")
    if not key:
        return None
    p = C.RAW / "gbif" / f"{key}.csv"
    return p if p.exists() else None


def _read_tsv(con: duckdb.DuckDBPyConnection, table: str, path: Path) -> None:
    # GBIF formato SIMPLE = TSV sin comillas; los campos de texto pueden traer
    # " sueltas, asi que desactivamos el quoting (quote='').
    con.execute(
        f"CREATE OR REPLACE TABLE {table} AS "
        "SELECT * FROM read_csv(?, delim='\t', header=true, quote='', "
        "sample_size=-1, all_varchar=true, ignore_errors=true)",
        [str(path)],
    )


def _load_gbif(con: duckdb.DuckDBPyConnection) -> None:
    """Ocurrencias de plantas: TSV sellado por DOI (manifest 'gbif') o muestra."""
    tsv = _sealed_tsv("gbif")
    sample = C.RAW / "gbif" / "sample_occurrences.json"
    if tsv:
        _read_tsv(con, "raw_gbif_occurrences", tsv)
        src = tsv.name
    elif sample.exists():
        con.execute(
            "CREATE OR REPLACE TABLE raw_gbif_occurrences AS "
            "SELECT * FROM read_json_auto(?)",
            [str(sample)],
        )
        src = sample.name
    else:
        print("[load] gbif ausente; salteando")
        return
    n = con.sql("SELECT count(*) FROM raw_gbif_occurrences").fetchone()[0]
    print(f"[load] raw_gbif_occurrences <- {src} ({n} filas)")


def _load_gbif_fungi(con: duckdb.DuckDBPyConnection) -> None:
    """Ocurrencias de hongos (reino Fungi). Prefiere el TSV sellado por DOI
    (manifest 'gbif_fungi'); si no esta, cae al JSON del search (set completo)."""
    tsv = _sealed_tsv("gbif_fungi")
    json_path = C.RAW / "gbif" / "fungi_occurrences.json"
    if tsv:
        _read_tsv(con, "raw_gbif_fungi", tsv)
        src = tsv.name
    elif json_path.exists():
        con.execute(
            "CREATE OR REPLACE TABLE raw_gbif_fungi AS SELECT * FROM read_json_auto(?)",
            [str(json_path)],
        )
        src = json_path.name
    else:
        print("[load] gbif fungi ausente; salteando (corre download)")
        return
    n = con.sql("SELECT count(*) FROM raw_gbif_fungi").fetchone()[0]
    print(f"[load] raw_gbif_fungi <- {src} ({n} filas)")


def run() -> None:
    con = _connect()
    try:
        con.execute("CREATE SCHEMA IF NOT EXISTS raw")
        _load_wcvp(con)
        _load_gbif(con)
        _load_gbif_fungi(con)
        tables = [r[0] for r in con.sql("SHOW TABLES").fetchall()]
        print(f"[load] tablas en {C.DUCKDB_PATH.name}: {tables}")
    finally:
        con.close()
