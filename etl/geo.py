"""Geografia: GeoJSON de departamentos + asignacion punto->poligono (DuckDB spatial).

GEOMETRIAS DESACOPLADAS (ADR 0003), porque simplificar es una decision de
RENDER, no de analisis:

  * DETALLADO  -> este modulo / join espacial backend.
    `peru_departamental_detallado.geojson` (geoBoundaries gbOpen ADM1, CC BY 4.0),
    normalizado a 25 NOMBDEP. Alta resolucion: la costa real esta presente, asi
    que los puntos costeros (p.ej. Callao/La Punta) caen DENTRO por ST_Contains.

  * SIMPLE -> SOLO render de la coropleta web (`web/`).
    `peru_departamental_simple.geojson` (juaneladio). Esta recortado para pesar
    poco en el navegador (pierde ~200-400 m de costa). Usarlo para el join
    mandaria puntos costeros legitimos a 'unassigned'. NO se usa aca.

El join usa la extension SPATIAL de DuckDB (ST_Contains + ST_Point), NO
string-matching de stateProvince. Asignacion en 3 niveles (ver model.py):
contencion (ST_Contains) -> snap al depto mas cercano dentro de SNAP_TOL_M
(waterline real / islas) -> 'unassigned' (offshore real / coords malas).

El GeoJSON se carga en una tabla TEMP con columna GEOMETRY: temp a proposito,
para no persistir geometria en atlas.duckdb (otros pasos abren conexiones sin
spatial y romperian al introspeccionar geom).
"""

from __future__ import annotations

import duckdb

from . import config as C

# Geometria del JOIN backend (detallada). El simplificado es solo para el front.
GEOJSON = C.RAW / "peru_departamental_detallado.geojson"
TEMP_TABLE = "geo_departments"

# Tolerancia de snap: un punto fuera de todo poligono se asigna al departamento
# mas cercano solo si su borde esta a <= esta distancia (waterline real / islas).
# Mas lejos => 'unassigned' (offshore real / coords malas). ~5 km.
SNAP_TOL_M = 5000.0


def ensure_spatial(con: duckdb.DuckDBPyConnection) -> None:
    """Carga spatial y registra el macro de distancia geodesica (haversine, metros).

    Se usa para el snap: ST_Distance_Spheroid solo acepta POINT_2D y no castea
    desde GEOMETRY, asi que medimos haversine sobre las coords del punto mas
    cercano del poligono (ST_X/ST_Y de ST_ClosestPoint).
    """
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute(
        """
        CREATE OR REPLACE MACRO dist_m(lon1, lat1, lon2, lat2) AS
          2 * 6371000 * asin(sqrt(
            power(sin(radians(lat2 - lat1) / 2), 2)
            + cos(radians(lat1)) * cos(radians(lat2))
              * power(sin(radians(lon2 - lon1) / 2), 2)));
        """
    )


def load_departments_temp(con: duckdb.DuckDBPyConnection) -> bool:
    """Crea TEMP TABLE geo_departments(department, geom) desde el GeoJSON detallado.

    Devuelve False si el GeoJSON no fue descargado (el modelo cae a fallback).
    """
    if not GEOJSON.exists():
        print("[geo] peru_departamental_detallado.geojson ausente; sin asignacion espacial")
        return False
    con.execute(
        f"""
        CREATE OR REPLACE TEMP TABLE {TEMP_TABLE} AS
        SELECT NOMBDEP AS department, geom
        FROM ST_Read('{GEOJSON.as_posix()}')
        """
    )
    n = con.sql(f"SELECT count(*) FROM {TEMP_TABLE}").fetchone()[0]
    print(f"[geo] {TEMP_TABLE}: {n} poligonos de departamento cargados (detallado, spatial)")
    return True
