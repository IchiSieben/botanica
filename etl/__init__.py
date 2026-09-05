"""Atlas Botanico del Peru — paquete ETL.

Pipeline reproducible: download -> load_duckdb -> clean -> match_names
-> aggregate -> analyze -> export. Orquestado por etl.cli (reemplaza make).
"""

__version__ = "0.1.0"
