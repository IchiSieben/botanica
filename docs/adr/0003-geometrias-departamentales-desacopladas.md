# ADR 0003 — Geometrías departamentales desacopladas (render vs. join)

- Fecha: 2026-06-22
- Estado: aceptado

## Contexto

El join punto→departamento (asignar cada ocurrencia GBIF a un departamento)
usaba el mismo GeoJSON que la coropleta del frontend: el
`peru_departamental_simple.geojson` de `juaneladio/peru-geojson`. Ese archivo
está **simplificado para el navegador** (pesa poco), y al simplificar recorta
~200–400 m de línea de costa. Resultado: 4 registros costeros del Callao
(La Punta, ~227–402 m del borde recortado) caían fuera de todo polígono y
quedaban `unassigned`. La causa raíz era la simplificación, no las coordenadas.

## Decisión

**Separar las dos geometrías porque simplificar es una decisión de RENDER, no
de análisis.**

- **Backend (join espacial):** `peru_departamental_detallado.geojson`, derivado
  de **geoBoundaries gbOpen PER ADM1 (CC BY 4.0)**, alta resolución. La costa
  real está presente, así que los puntos costeros caen dentro por `ST_Contains`.
  geoBoundaries trae 26 unidades (separa Lima de su provincia metropolitana) con
  `shapeName` acentuado; en la descarga se normaliza a los **25 NOMBDEP
  canónicos** (deaccent + upper + overrides) y se **unen las dos "Lima"** en un
  solo polígono (`shapely.unary_union`). Coords a 5 decimales (~1 m).
- **Frontend (render):** `peru_departamental_simple.geojson` (juaneladio) queda
  **solo** para la coropleta web. Coords a 4 decimales.

`NOMBDEP` sigue siendo la clave canónica de `dim_geo` (25 departamentos). Ambas
geometrías se sellan por separado en `data/raw/manifest.json`
(`peru_geojson_detallado`, `peru_geojson_simple`).

## Asignación en 3 niveles (`fact_occurrence.assign_method`)

Con la geometría detallada, la mayoría resuelve por contención. Para residuos
genuinos (waterline real, islas) se agrega un snap acotado — **no** un buffer
difuso:

1. `contencion` — el punto cae dentro del polígono (`ST_Contains`).
2. `snap` — no cae en ninguno, pero el borde del más cercano está a
   ≤ `SNAP_TOL_M` (~5 km), medido con `ST_ClosestPoint` + haversine. Se asigna
   a ese departamento.
3. `unassigned` — más lejos que la tolerancia → offshore real / coords malas.
   No se fuerza.

## Consecuencias

- Callao resuelve **por contención** con la geometría detallada (el snap queda
  como red de seguridad para casos reales de borde de agua, no para Callao).
- Nueva fuente con atribución CC BY (geoBoundaries) en `docs/licencias`.
- `shapely` (ya dependencia) se usa para la preparación offline de la geometría
  (union de Lima); el join en sí corre con la extensión spatial de DuckDB.
