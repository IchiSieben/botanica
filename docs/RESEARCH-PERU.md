# Botánica — dossier de investigación y roadmap

Consultado el 24-09-2026. Todo lo que sigue se verificó en la fuente enlazada. Lo marcado con ⚠️ no está confirmado o las fuentes no coinciden. Este archivo va en el repo como `docs/RESEARCH-PERU.md` y es la fuente de las cifras de la infografía: **ninguna cifra de la página puede aparecer sin su cita.**

---

## 0. Crítico: GBIF cambió su taxonomía de referencia (backbone)

- **Qué cambió:** GBIF.org usa ahora por defecto el **Catalogue of Life eXtended Release (COL XR)**. El backbone de 2023 ya no se actualiza.
- **Claves nuevas:** los taxonKey pasan a ser alfanuméricos (p. ej. `Q2M4`).
- **Consultas con claves antiguas:** para que funcionen hay que pasar `checklistKey=7ddf754f-d193-4cc9-b351-99906754a03b`.
- **Tabla de correspondencias:** en download.checklistbank.org/col/gbif/.
- **Fuente:** https://data-blog.gbif.org/post/catalogue-of-life-taxonomic-backbone/
- **Qué implica para el atlas:**
  - Afecta a los hongos, que hoy se resuelven "vía el backbone de GBIF", y a cualquier `speciesKey` que tengamos guardado.
  - Hay que fijar el checklist en cada predicado de descarga y registrarlo en el manifest.
- ⚠️ La API v1 todavía respondió con `kingdomKey=6`. No se confirmó con qué taxonomía.

---

## 1. Cifras para la infografía (con fuente)

| # | Dato | Fuente |
|---|---|---|
| 1 | El Perú es uno de los **17 países megadiversos**. Criterio: ≥5.000 plantas endémicas. En conjunto albergan ~¾ de las plantas superiores del mundo. | https://www.biodiversitya-z.org/content/megadiverse-countries |
| 2 | Tiene **84 de las 117 zonas de vida** de Holdridge (mapa ONERN, 1976). El mapa SENAMHI 2019 usa otra metodología (16 zonas y 66 sub-biomas): no son comparables, y conviene decirlo. | SINIA/MINAM: https://sinia.minam.gob.pe/sites/default/files/sial-sialtrujillo/archivos/public/docs/373.pdf · SENAMHI: https://www.senamhi.gob.pe/load/file/01401SENA-87.pdf |
| 3 | El territorio va de 0 a **6.768 m** (Huascarán Sur). | MINCETUR: https://consultasenlinea.mincetur.gob.pe/fichaInventario/index.aspx?cod_Ficha=568 |
| 4 | La Amazonía cubre **~61 % del país**, la segunda porción amazónica más grande después de Brasil. ⚠️ Hay que citar al IIAP directamente, no a Wikipedia. | https://en.wikipedia.org/wiki/Peruvian_Amazonia |
| 5 | Libro Rojo (2006): **5.509 taxones endémicos, 27,9 % de la flora**. Encabezan Huánuco (954), Cajamarca (948) y Amazonas (883). | León, Pitman & Roque 2006. https://doi.org/10.15381/rpb.v13i2.1782 |
| 6 | Con el WCVP del atlas: **7.541 de 21.585 especies (~35 %)**. La diferencia con el 5 se debe a otra taxonomía y otra fecha, y hay que explicarla en la página. | datos propios |
| 7 | **775 orquídeas endémicas**. El total nacional se estima en 2.500–3.000 especies. | Roque & León 2006. https://doi.org/10.15381/rpb.v13i2.1953 · SERFOR 2019: https://repositorio.serfor.gob.pe/handle/SERFOR/743 |
| 8 | **199 cactus endémicos**, con 6 géneros que existen solo en el Perú (*Calymnanthium, Lasiocereus, Matucana, Mila, Oroya, Pygmaeocereus*). | Arakaki et al. 2006. https://doi.org/10.15381/rpb.v13i2.1821 |
| 9 | Es el **3.er país del mundo en epífitas vasculares**, con 2.462 especies (1.606 orquídeas). | Mondragón et al. 2024. https://doi.org/10.15381/rpb.v31i1.27006 |
| 10 | La flora amenazada oficial (**DS 043-2006-AG**) tiene ~776–777 especies (CR 193 · EN 73 · VU 391 · NT 119) y **no se ha actualizado en 20 años**. ⚠️ El desglose por categorías varía entre fuentes. | https://www.senace.gob.pe/wp-content/uploads/2016/10/NAT-3-3-03-DS-043-2006-AG.pdf · https://github.com/PaulESantos/peruflorads43 |
| 11 | Las áreas protegidas cubren el **18,38 % del territorio terrestre**: 78 ANP, 38 ACR y 145 ACP. | SERNANP, 19-06-2026: https://biodiversidadanp.sernanp.gob.pe/en/areas-naturales-protegidas/ |
| 12 | **~3 de cada 4 registros de GBIF sobre el Perú son aves de eBird**. Plantas: ~1,8 M registros. Hongos: ~22.500. ⚠️ Los totales del PDF no cuadran entre sí. | https://analytics-files.gbif.org/country/PE/GBIF_CountryReport_PE.pdf |
| 13 | Quince inventarios rápidos (2000–2016) encontraron **64 especies nuevas para el Perú**: lo que falta son datos, no especies. | Torres-Montenegro et al. 2019. https://doi.org/10.15381/rpb.v26i3.16780 |
| 14 | En la Amazonía faltan unas **4.000 especies de árboles** por describir. Al ritmo actual, terminar tomaría unos 300 años. | ter Steege et al. 2016. https://doi.org/10.1038/srep29549 |
| 15 | El Perú tiene **1.925 especies de aves**, 119 endémicas (23-03-2026). | Plenge/UNOP: https://sites.google.com/site/boletinunop/checklist |

**Regionalización:**

- Brack propone **11 ecorregiones** (Mar Frío … Sabana de Palmeras). ⚠️ No está confirmado el año original, que suele darse como 1986. Fuente: https://rpp.pe/lima/actualidad/las-11-ecorregiones-del-peru-propuestas-por-antonio-brack-noticia-755679
- Britto (2017, UNMSM) propone **15 ecorregiones florísticas**. https://doi.org/10.4067/s0717-66432017005000318
- No se verificó cuántas ecorregiones RESOLVE caen en el Perú: calcularlo con el shapefile.

**Advertencia sobre rankings:** los del PDF de MINAM (8.º en plantas con flor, 1.º en mariposas) no tienen fecha y son anteriores a 2015. Si se usan, rotularlos "según MINAM".

---

## 2. Historia (línea de tiempo)

| Año | Hito | Fuente |
|---|---|---|
| 1777–1788 | **Ruiz, Pavón y Dombey** (ilustradores: Brunete y Gálvez). Reunieron más de 3.000 especímenes y ~2.500 láminas, y describieron ~150 géneros y ~500 especies nuevas. En 1784 se hundió el *San Pedro de Alcántara*. Publicaron el *Prodromus* (1794) y la *Flora Peruviana et Chilensis* (1798–1802). | https://en.wikipedia.org/wiki/Botanical_Expedition_to_the_Viceroyalty_of_Peru · revisión moderna: https://doi.org/10.3390/biology12020294 |
| 1802 | **Humboldt y Bonpland** (agosto–diciembre): Ayabaca, Cajamarca, Trujillo y Lima; la corriente fría que hoy lleva su nombre. ⚠️ La fuente es institucional. | https://www.colegio-humboldt.edu.pe/sp/diversos/avh/a-v-h-en-peru.php?id=6 |
| 1850–1890 | **Antonio Raimondi**: 19 años de viajes. *El Perú* (6 volúmenes, 1874–1913). | https://www.bnp.gob.pe/bnp-recuerda-a-antonio-raimondi-al-cumplirse-200-anos-de-su-natalicio/ |
| 1901–1948 | **August Weberbauer**, padre de la fitogeografía peruana: *Die Pflanzenwelt der peruanischen Anden* (1911) y *El mundo vegetal de los Andes peruanos* (1945). | https://www.deutsche-biographie.de/sfz139422.html |
| 1993 | **Brako & Zarucchi**, primer catálogo nacional moderno (más de 17.000 plantas con semilla). | https://www.biodiversitylibrary.org/bibliography/194092 |
| 2006 | **Libro Rojo de las Plantas Endémicas del Perú**. | https://doi.org/10.15381/rpb.v13i2.1782 |
| 2017 | **Ulloa Ulloa et al.**, en *Science*: 124.993 plantas vasculares de las Américas. | https://doi.org/10.1126/science.aao0398 |
| 2026 | Este atlas: WCVP + GBIF, con la sinonimia resuelta. | — |

---

## 3. Bibliografía

### 3.1 Obras de referencia

- Brako & Zarucchi 1993. *Catálogo de las Angiospermas y Gimnospermas del Perú*. https://archive.org/details/mobot31753003155055
- León, Roque, Ulloa Ulloa, Pitman, Jørgensen & Cano (eds.) 2006. *Libro Rojo*. Rev. Peru. Biol. 13(2). https://doi.org/10.15381/rpb.v13i2.1782
- Ulloa Ulloa et al. 2017. *Science* 358: 1614–1617. https://doi.org/10.1126/science.aao0398
- Moonlight et al. 2023. *The genus Begonia in Peru*. Eur. J. Taxon. 881 (76 especies, 12 nuevas). https://doi.org/10.5852/ejt.2023.881.2175
- Ramos 2014. Líquenes del Perú, *Glalia* 6(2): 924 especies. https://archive.org/stream/2014_Glalia_6_2/2014_Glalia_6(2)_Ramos_L%C3%ADquenes_Peru_djvu.txt
- Holgado-Rojas et al. 2025. Hongos comestibles del Perú, *Lilloa* 62. https://doi.org/10.30550/j.lil/1825
- ⚠️ **No existe un checklist nacional de macrohongos ni de micorrizas.** Es un vacío real, y la sección de Hongos puede contarlo.

### 3.2 Instituciones peruanas (2015–2026)

**Ranking de referencia:** QS World 2027 → PUCP 357, UNMSM 984, UPCH 1001–1200. La UNALM salió del ranking en 2027. Fuente: https://rpp.pe/peru/actualidad/mejores-universidades-peruanas-en-el-ranking-qs-world-2027-noticia-1693671

En botánica, lo que se publica viene sobre todo de los herbarios USM (UNMSM), MOL (UNALM), CUZ (UNSAAC), HUT (UNT) y HUSA (UNSA). La PUCP no tiene producción en este tema.

- Delves et al. 2024, *Plants People Planet* — los herbarios peruanos cambian las evaluaciones de amenaza (USM, MOL, HUT). https://doi.org/10.1002/ppp3.10425
- Torres-Montenegro et al. 2019 — 64 nuevos registros para el Perú (USM, CUZ). https://doi.org/10.15381/rpb.v26i3.16780
- Mondragón, Albán-Castillo et al. 2024 — epífitas por departamento (USM). https://doi.org/10.15381/rpb.v31i1.27006
- Britto 2017 — 15 ecorregiones (UNMSM). https://doi.org/10.4067/s0717-66432017005000318
- Chancayauri Vaca et al. 2025 — Herbario HUSA, con 22.053 ejemplares (UNSA). https://doi.org/10.21829/abm132.2025.2492
- Palacios … Reynel 2025 — tipos del herbario MOLF (UNALM). https://doi.org/10.21068/2539200X.1243
- Reynel & Albán-Castillo 2024 — *Ficus ucayaliensis*, especie nueva (UNALM, USM). https://doi.org/10.15381/rpb.v31i4.28980
- Monteagudo … Huamantupa 2021 — árboles de Machu Picchu entre 1.600 y 4.200 m (UNSAAC). https://doi.org/10.51343/rq.v12i1.766
- Delgado, Trinidad, Arakaki et al. 2023 — lomas: 1.092 especies y barcodes de ADN (USM), *Sci. Data*. https://doi.org/10.1038/s41597-023-02206-y
- Tejada-Fajardo … Ochoa 2025 — palinología de lomas (UPCH, USM). https://doi.org/10.1080/01916122.2024.2396003
- Rodríguez Rodríguez 2018 — Herbarium Truxillense (UNT). https://revistas.unitru.edu.pe/index.php/REVSAGAS/article/view/3249
- Ramírez & Valencia 2020 — líquenes del Pastoruri. https://doi.org/10.15381/rpb.v27i4.19205
- Martel 2020 — inconsistencias en la categorización de amenaza de las orquídeas. https://doi.org/10.15381/rpb.v27i2.16886

### 3.3 Registros ≠ riqueza (sustento del principio 2)

- Nelson et al. 1990, *Nature* — los "centros de endemismo" coinciden con los lugares más colectados. https://doi.org/10.1038/345714a0
- Tobler, Honorio, Janovec & Reynel 2007 — caso Perú: las colectas se concentran cerca de pueblos y vías. https://doi.org/10.1007/s10531-005-3373-9
- Hopkins 2007. https://doi.org/10.1111/j.1365-2699.2007.01737.x
- Feeley & Silman 2011. https://doi.org/10.1111/j.1365-2486.2010.02239.x
- Meyer, Weigelt & Kreft 2016. https://doi.org/10.1111/ele.12624
- Daru et al. 2018. https://doi.org/10.1111/nph.14855

---

## 4. Fuentes de datos: qué se puede usar y cómo

### 4.1 Fotos (lo que más impacto visual da)

**Cobertura:** en GBIF hay **656.866 registros de plantas en el Perú con imagen**. De ellos, 295.330 tienen licencia CC BY 4.0 y 68.283 vienen de iNaturalist.

**Pipeline, todo resuelto en el build y alojado en el propio sitio:**

1. **Candidatos:** descarga DWCA de GBIF (`mediaType=StillImage`) y cruzar `multimedia.txt` con `occurrence.txt`.
2. **Licencia:** preferir en este orden CC0 > CC BY > CC BY-SA > CC BY-NC. Excluir las NC solo si algún día el sitio se monetiza.
3. **Elección:** 1 foto por especie, puntuada por fuente, calidad y proporción.
4. **Huecos:** rellenar con Wikidata P18 → Commons (`extmetadata`) → bucket S3 `inaturalist-open-data`. **Nunca** usar la API de iNat para descargas masivas: el límite es ~1 req/s y un uso excesivo puede terminar en bloqueo permanente.
5. **Formato:** WebP de 320–400 px en `/img/sp/{id}.webp`.
6. **Atribución por imagen:** `{author, license, source_url, gbif_occurrence, retrieved}`, visible bajo la foto. Además, una página global de créditos.
7. **Peso:** 23.000 × 20–40 KB ≈ **0,5–0,9 GB**, unos 46.000 archivos. ⚠️ Falta verificar los límites de disco e inodos del plan de Hostinger.

**Referencias:** https://techdocs.gbif.org/en/data-use/download-formats · https://github.com/inaturalist/inaturalist-open-data · https://www.inaturalist.org/pages/api+recommended+practices

### 4.2 Enriquecimiento

| Capa | Licencia | Uso en el atlas |
|---|---|---|
| **DS 043-2006-AG** vía `peruflorads43` | MIT | Estado de amenaza nacional. Reemplaza a IUCN. ⚠️ La capa "actualizada" tiene 179 especies frente a 776: hay que revisar la diferencia. https://paulesantos.github.io/peruflorads43/ |
| **WCVP/IPNI** (`first_published`, `place_of_publication`, `ipni_id`) | CC BY | Cita del protólogo y enlace `ipni.org/n/{id}`, con esfuerzo casi nulo. |
| **GBIF Literature API** (`countriesOfCoverage=PE`) | abierta | Hay 185 artículos sobre el Perú. Sirven para los enlaces por taxón. |
| **Copernicus DEM GLO-30/90** | libre, con atribución obligatoria | Banda altitudinal para cada punto de GBIF, calculada en el build. |
| **RESOLVE Ecoregions 2017** | CC BY 4.0 | Ecorregión de cada punto y capa del mapa. https://ecoregions.appspot.com/ |
| **CHELSA V2.1** | CC0 | Perfil climático por especie. Usar esta y no WorldClim. |
| **MapBiomas Perú** | CC BY 4.0 | Cobertura del suelo y deforestación desde 1985. https://peru.mapbiomas.org/ |
| **Wikidata** (P1843) | CC0 | Nombres comunes en español y quechua (⚠️ probablemente pocos en quechua). |
| **Open Tree of Life v16.1** | abierta ⚠️ | Topología del árbol por debajo del nivel de familia. |
| **SERNANP** (ANP, ACR, ACP) | ⚠️ sin licencia explícita | Pedir confirmación a informes@sernanp.gob.pe. |
| **TRY** (rasgos) | CC BY solo en los datasets públicos | Opcional. |

**No publicar, solo enlazar o usar para cálculos en el build:**

- **IUCN:** prohíbe redistribuir.
- **WDPA:** no se pueden publicar polígonos descargables.
- **TimeTree:** prohíbe redistribuir.
- **BIEN:** licencia NC-ND.
- **WorldClim:** licencia NC y prohíbe redistribuir.
- **MycoBank:** licencia NC-ND.
- **POWO:** no admite descargas masivas.

### 4.3 Bibliografía por taxón

En orden de costo, de menor a mayor:

1. WCVP/IPNI (protólogo).
2. GBIF literature.
3. Exporte de BHL en Figshare (CC0, ZIP de 2,8 GB).
4. Plazi, a través de GBIF.

OpenAlex solo sirve a nivel de familia o género, porque por especie da demasiados falsos positivos.

---

## 5. Roadmap de expansión

**Principio:** primero llevar el Perú al nivel "pro"; después se suma **un país por versión**, siempre sobre la misma arquitectura.

| Versión | Alcance | Datos nuevos |
|---|---|---|
| v2 (desplegada) | Perú: vistas coordinadas, EN/ES, mobile | WCVP + GBIF |
| **v3** | Perú "pro": infografía introductoria, fotos, amenaza, altitud, ecorregiones, bibliografía y árbol a pantalla completa | Fotos, DS 043, DEM, RESOLVE, IPNI, GBIF literature, manifest |
| v3.x | Perú: capas de clima y cobertura del suelo, nombres comunes | CHELSA, MapBiomas, Wikidata |
| v4 | **Colombia** (su checklist trae departamentos y endemismo, CC BY 4.0) | https://ipt.biodiversidad.co/sib/resource?r=catalogo_plantas_liquenes |
| v5 | **Bolivia y Ecuador** | WCVP + GBIF. ⚠️ Los catálogos de Tropicos no tienen licencia verificada. |
| v6 | **Chile y Argentina** (Flora del Cono Sur, por provincia) | https://conosur.floraargentina.edu.ar/ ⚠️ |
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

---

## 6. Preguntas abiertas

- Cobertura real de especies con foto: sacarla de una descarga `SPECIES_LIST` con `mediaType=StillImage`.
- Licencias de SERNANP, del mapa de Holdridge y de los catálogos de Tropicos (Ecuador y Bolivia).
- Límites de Hostinger: inodos, peticiones Range (para PMTiles) y Brotli.
- Qué parte de las 776 especies de la lista original falta en las 179 actualizadas de `peruflorads43`.
- ¿Habrá monetización algún día? Si la respuesta es sí, se excluyen las fotos con licencia NC.
