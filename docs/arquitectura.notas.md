# Arquitectura viva de Botánica: notas de investigación

Fecha: 2026-10-10. Fuente: el código del repo (etl/, web/, tests/), README, SPEC, docs/adr y docs/DECISIONES.md.
Regla: lo que no está en el código se marca "por confirmar" y no se dibuja.

## 1. Las 9 preguntas del manual

### 1. Actores
- Visitante: abre el atlas en su navegador (sin cuenta, sin backend).
- Autor (sesión de trabajo en un PC Windows): corre el ETL, el índice de especies, el build del sitio y la copia al Landing.
- Sistemas externos que el ETL llama: GBIF (ocurrencias con DOI), Kew (WCVP y Tree of Life), geoBoundaries y un GeoJSON simplificado alojado en un repo público de GitHub.

### 2. Contenedores
| Id | Qué es | Stack | Dónde corre |
|---|---|---|---|
| gbif | GBIF, descarga con DOI y search | API HTTP, pygbif | externo |
| kew | WCVP (zip) y Tree of Life (Newick) | HTTP | externo |
| geo | geoBoundaries ADM1 y GeoJSON simple | HTTP | externo |
| dev | sesión de trabajo del autor | uv, npm, git | PC Windows |
| etl | paquete `etl/`, CLI `atlas` | Python 3.11+, DuckDB, requests, shapely | PC Windows |
| raw | `data/raw/` y `manifest.json` | archivos (gitignored) | PC Windows |
| db | `data/atlas.duckdb` | DuckDB (gitignored, ~1 GB según README) | PC Windows |
| exp | `data/exports/` marts JSON versionados y Parquet | JSON, Parquet | PC Windows y git |
| pub | `web/public/data/` species, facets, protologue | JSON columnar | PC Windows y git |
| site | `web/`, build estático | Astro 5, ECharts, Three.js (chunk perezoso) | PC Windows (build) |
| gh | repo del Landing en GitHub, con `public/botanica/` | git | GitHub |
| host | build Node.js del Landing y archivos estáticos | Astro, Apache | Hostinger |
| vis | navegador del visitante | HTML, JS, localStorage | Navegador del usuario |

Escala: no hay servidor de aplicación. El costo por visita es el de servir archivos estáticos.

### 3. Llamadas reales entre contenedores
| Arista | De a | Protocolo y carga | Evidencia (archivo:función) |
|---|---|---|---|
| e1 | gbif a etl | HTTPS; zip SIMPLE (TSV) con DOI | etl/download.py:request_gbif_download_kingdom, download_gbif_full, download_gbif_get |
| e2 | kew a etl | HTTPS; zip WCVP y Newick | etl/download.py:download_wcvp, download_tol; etl/config.py:SOURCES |
| e3 | geo a etl | HTTPS; GeoJSON | etl/download.py:download_peru_geojson_detallado, download_peru_geojson_simple |
| e4 | dev a etl | línea de comandos `uv run atlas data` | etl/cli.py:main, _run_data |
| e5 | etl a raw | archivos y manifiesto (sha256, DOI, fecha) | etl/config.py:Manifest.record; etl/download.py (todas las descargas) |
| e6 | etl a db | SQL de DuckDB, un paso por tabla | etl/load_duckdb.py:run; etl/clean.py:run; etl/match_names.py:run; etl/match_fungi.py:run; etl/model.py:run; etl/aggregate.py:run; etl/analyze.py:run |
| e7 | etl a exp | JSON y Parquet con ORDER BY por todas las columnas | etl/export.py:run, order_clause |
| e8 | etl a pub | JSON columnar por reino, DuckDB en solo lectura | etl/build_species_index.py:run, build, build_facets, build_protologue |
| e9 | dev a site | `npm run build` | web/package.json (script build); web/astro.config.mjs |
| e10 | exp a site | lectura de archivos en build | web/src/lib/data.ts:loadMart (readFileSync) |
| e11 | pub a site | build copia cada JSON con hash en el nombre | web/astro.config.mjs:hashedData; web/src/lib/geo.ts (lee peru_departamentos.geojson en build) |
| e12 | site a gh | copia manual de `web/dist` a `public/botanica/` del Landing y push a main | docs/MIGRAR-SUBDOMINIO.md (tabla y pasos); historial del Landing ("Mirror Botánica v3.1.0") |
| e13 | gh a host | auto-deploy del Landing en cada push a main | CLAUDE.md del Landing (sección Deploy) |
| e14 | vis a host | HTTPS GET del HTML | web/astro.config.mjs (output static, base /botanica/) |
| e15 | vis a host | fetch de `data/<nombre>.<hash>.json` | web/src/lib/data-url.ts:fetchData; web/src/scripts/explorer.ts, tree.ts; web/src/components/SpeciesBrowser.astro |

### 4. Flujos principales
1. Ingesta de una descarga GBIF: e4, e1, e5, e6.
2. Build del atlas: e6, e7, e8, e10, e11, e12, e13.
3. Una visita: e14, e15.

### 5. Componentes internos del núcleo
No aplica. No hay API ni lógica de negocio en servidor; el ETL es una secuencia de pasos, no un núcleo hexagonal.

### 6. Datos
No hay base de datos de la aplicación. Hay un almacén analítico local (DuckDB) con esquema estrella y marts, y carpetas que hacen de contrato:
- `data/raw/`: descargas selladas (gitignored). `manifest.json` guarda DOI, sha256 y fecha por fuente.
- `data/atlas.duckdb`: tablas raw_*, gbif_clean, gbif_fungi_clean, gbif_occ_norm, wcvp_accepted, peru_species, peru_fungi, family_order_apg, dim_taxon, dim_clade, dim_geo, dim_time, fact_occurrence, fact_distribution, mart_* y stats_diversity.
- `data/exports/`: ocho marts como JSON versionado (más index.json) y Parquet ignorado por git.
- `web/public/data/`: species-plantae, species-fungi, facets-plantae, facets-fungi, protologue-plantae y peru_departamentos.geojson.
Mermaid: ER de las tablas del modelo estrella (etl/model.py) y árbol de carpetas.

### 7. Despliegue
Hoy: el sitio se construye en el PC (`npm run build` en `web/`), `web/dist/` se copia a `public/botanica/` del Landing, se hace push a main del Landing y el build de Hostinger lo publica. Se sirve en una subcarpeta (`base: '/botanica/'`).
`web/public/.htaccess` solo añade `Cache-Control: immutable` a los JSON con hash.
Hay un plan escrito para pasar a un subdominio propio (docs/MIGRAR-SUBDOMINIO.md); el código todavía tiene `base: '/botanica/'`, así que no se dibuja como hecho.

### 8. Historias de usuario
No aplica. Es un proyecto personal de datos abiertos, no nació de requisitos de terceros.

### 9. Decisiones con su razón
Ver la pestaña Decisiones. Salen de docs/adr/0001 a 0003, docs/DECISIONES.md, README y SPEC; las inferidas del código están marcadas.

## 2. Por confirmar (no dibujado)
- Si la versión 3.2.0 (JSON con hash, `.htaccess`) está ya en producción: el espejo local del Landing todavía contiene los JSON sin hash.
- Cómo se genera `web/public/data/peru_departamentos.geojson`: ningún archivo de `etl/` lo escribe; se supone derivado de `data/raw/peru_departamental_simple.geojson` pero no hay código que lo muestre.
- Si existe un script que haga la copia a `public/botanica/` del Landing: no se encontró; se trata como paso manual.
- Si `download_gbif_get` se invoca desde algún lugar: no tiene ningún llamador en el repo; se trata como paso manual tras recibir el aviso de GBIF.
- Estabilidad byte a byte de los exports: el README dice que una re-ejecución reordenó seis marts; el CHANGELOG dice que los exports quedaron idénticos tras añadir un ORDER BY determinista. Se dibuja la decisión (`order_clause`) y no se afirma el resultado.
- Número de pasos del pipeline: README dice 10, `PIPELINE` en etl/cli.py lista 11 (incluye build_apg).
- Proxy PHP para APIs en vivo (ADR 0002 lo menciona como idea de futuro): no hay código; no se dibuja.
- Ejecución de pruebas y gates en otra máquina: no hay evidencia en este repo; solo se muestran en el PC.

## 3. Privacidad: lo que vi en el repo
- `.env.example` (ignorado por git, sin seguimiento) tiene valores no vacíos en las tres variables de credenciales de GBIF. No los leí ni los copio. Conviene vaciarlos aunque el archivo no esté versionado.
- El CITATION.cff y el README nombran al autor; no se usan en la página.
- docs/handoffs/ está en .gitignore.
