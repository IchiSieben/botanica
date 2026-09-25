# Roadmap

Copiado tal cual de `docs/RESEARCH-PERU.md` §5 ("Roadmap de expansión"), el dossier de
investigación del propietario consultado el 24-09-2026. Añadido al repo el 2026-09-25
(v3.1, ítem 0). Nota de verificación de enlaces: `conosur.floraargentina.edu.ar` (fila v6)
solo resuelve por `http://`; en `https://` la conexión falla.

---

**Principio:** primero llevar el Perú al nivel "pro"; después se suma **un país por versión**, siempre sobre la misma arquitectura.

| Versión | Alcance | Datos nuevos |
|---|---|---|
| v2 (desplegada) | Perú: vistas coordinadas, EN/ES, mobile | WCVP + GBIF |
| **v3** | Perú "pro": infografía introductoria, fotos, amenaza, altitud, ecorregiones, bibliografía y árbol a pantalla completa | Fotos, DS 043, DEM, RESOLVE, IPNI, GBIF literature, manifest |
| v3.x | Perú: capas de clima y cobertura del suelo, nombres comunes | CHELSA, MapBiomas, Wikidata |
| v4 | **Colombia** (su checklist trae departamentos y endemismo, CC BY 4.0) | https://ipt.biodiversidad.co/sib/resource?r=catalogo_plantas_liquenes |
| v5 | **Bolivia y Ecuador** | WCVP + GBIF. ⚠️ Los catálogos de Tropicos no tienen licencia verificada. |
| v6 | **Chile y Argentina** (Flora del Cono Sur, por provincia) | http://conosur.floraargentina.edu.ar/ ⚠️ (solo resuelve por http) |
| v7 | **Brasil** (12,9 M registros: pide una rejilla H3 y marts por estado) | Flora e Funga do Brasil, CC BY 4.0, DwC-A semanal |
| v8+ | Sudamérica completa, vista comparativa entre países; luego Centroamérica y el resto del mundo | — |

**Reglas técnicas para crecer sin romper lo estático:**

- **Un mart por país y por vista:** `/data/{iso}/index.json`, `/data/{iso}/sp/{id}.json` y `/data/{iso}/grid/{res}.json`.
- **Nunca servir puntos crudos:** pre-agregar a especie × ADM1 × banda de altitud, más una rejilla H3.
- **Backbone común:** WCVP para plantas (presencia por país con TDWG L3) y COL XR para hongos. La distribución por ADM1 sale de GBIF y de los checklists nacionales.
- **Límites ADM1:** geoBoundaries gbOpen, leyendo el `boundaryLicense` de cada país; la licencia varía, por ejemplo Brasil es CC BY 2.5.
- **`data/manifest.json` por build:** DOI de cada descarga de GBIF, checklist de GBIF, versión de WCVP, versión de OpenTree, licencia de cada capa y fechas.
- **Página `/cambios`:** bitácora pública generada desde el manifest y desde git, con especies nuevas o eliminadas y conteos. **La misma plantilla sirve para todas las apps del landing.**
- **Gate de licencias:** el build falla si una capa restringida (IUCN, WDPA, TimeTree, BIEN, WorldClim) termina en `/dist`.
