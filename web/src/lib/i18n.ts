/**
 * EN/ES string tables. Scientific names, data values, units and source names
 * are never translated. Numbers use the landing's locale map (en-US, es-PE).
 *
 * Resolution order (see src/components/LangRedirect.astro): `?lang=` → path
 * (`/es/`) → localStorage `ic7.lang` → navigator.language → EN.
 */
export type Locale = 'en' | 'es';
export const LOCALES: Locale[] = ['en', 'es'];
export const BCP47: Record<Locale, string> = { en: 'en-US', es: 'es-PE' };
export const LANG_KEY = 'ic7.lang';

import { PARTS_EN, PARTS_ES } from './i18n-parts';

const enBase = {
  'site.title': 'Botánica — an atlas of Peru’s flora',
  'site.brand': 'Botánica',
  'site.tagline': 'Peru’s flora and fungi, from open data',
  'site.description': 'Explore 21,585 plant and 1,802 fungus species recorded in Peru: click a department, a family or a decade and every view follows. WCVP (Kew) + GBIF occurrences, open data.',
  'nav.explore': 'Explore',
  'nav.species': 'Species',
  'nav.tree': 'Taxonomy tree',
  'nav.home': 'iC7 portfolio',
  'nav.lang': 'Language',
  'theme.toggle': 'Switch light/dark theme',
  'lang.switch': 'Read in English',
  'skip': 'Skip to content',

  'k.plantae': 'Plants',
  'k.fungi': 'Fungi',
  'k.label': 'Kingdom',

  'hero.title': 'What grows where in Peru?',
  'hero.lede': 'Click a department, a family, an origin or a decade. Every view answers together, and the address bar keeps the question so you can share it.',
  'hint.map': 'Tap a department to filter everything',
  'hint.more': 'Shift-click (or “Compare”) to add a second department',

  'filters.none': 'All of Peru · no filters',
  'filters.clear': 'Clear all',
  'filters.remove': 'Remove filter',

  'kpi.species': 'species',
  'kpi.families': 'families',
  'kpi.orders': 'orders',
  'kpi.endemic': 'endemic to Peru',
  'kpi.introduced': 'introduced',
  'kpi.median': 'median year described',
  'kpi.withRecords': 'with geo-referenced records',

  'map.title': 'Where',
  'map.metric': 'Map shows',
  'map.m.species': 'species',
  'map.m.records': 'records',
  'map.m.coverage': 'species per 1,000 records',
  'map.metricLocked': 'Records are counted per occurrence, not per species, so they can’t be filtered by taxon or year. Clear those filters to see sampling effort.',
  'map.caveat': 'Counts reflect collecting effort as much as biodiversity: where more was collected, more appears.',
  'map.legend': 'Legend: click a band to highlight its departments',
  'map.noData': 'no records',
  'map.species': 'Showing where this species was recorded',

  'dep.species': 'species',
  'dep.records': 'records',
  'dep.topFamilies': 'Top families here',
  'dep.compare': 'Compare with…',
  'dep.clear': 'Deselect',
  'cmp.title': 'Comparison',
  'cmp.only': 'only in',
  'cmp.both': 'in both',
  'cmp.exclusive': 'Most exclusive families',

  'fam.title': 'Families',
  'fam.note': 'Tile size = species; colour = order (APG IV). Tap a family to filter.',
  'fam.others': 'other families',
  'fam.order': 'order',

  'life.title': 'Growth form',
  'life.note': 'From WCVP. Tap to filter.',
  'life.nodata': '(no data)',
  'life.others': 'others',
  'st.title': 'Origin',
  'st.endemica': 'Endemic',
  'st.nativa': 'Native (not endemic)',
  'st.introducida': 'Introduced',
  'st.nodata': 'No data',
  'year.title': 'When they were described',
  'year.note': 'Year the species was first described (WCVP): the original name (basionym) when it was later moved to another genus. Drag across decades to select a range.',
  'year.play': 'Play',
  'year.stop': 'Stop',
  'year.unknown': 'without a year',
  'year.range': 'Described',
  'na.fungi': 'Not available for fungi: the atlas has no curated source for this field. Nothing is hidden or estimated.',

  'search.label': 'Search a species, genus or family',
  'search.placeholder': 'Search 23,387 species…',
  'search.loading': 'loading the index…',
  'search.none': 'No matches',
  'search.hint': '↑ ↓ to move · Enter to open',

  'sp.close': 'Close',
  'sp.showMap': 'Show on map',
  'sp.filterFamily': 'Filter by this family',
  'sp.records': 'Records',
  'sp.noRecords': 'none geo-referenced',
  'sp.lifeform': 'Growth form',
  'sp.year': 'Described',
  'sp.topDepts': 'Departments with most records',
  'sp.noDepts': 'In the checklist, but with no geo-referenced record in Peru. A real gap, not an error.',
  'sp.endemic': 'endemic',
  'sp.native': 'native',
  'sp.introduced': 'introduced',

  'tut.open': 'How it works',
  'tut.next': 'Next', 'tut.prev': 'Back', 'tut.done': 'Got it', 'tut.skip': 'Skip', 'tut.of': 'of',

  'footer.data': 'Open data, CC BY 4.0 attribution:',
  'footer.caveat': 'Counts use accepted names (synonyms resolved) at species rank. Sampling effort ≠ richness.',
  'footer.code': 'Source code',

  'species.title': 'Species',
  'species.lede': 'The 21,585 plant and 1,802 fungus species recorded in Peru, with their family, order and where they have been found. Search by scientific name, genus or family.',
  'species.of': 'of',
  'species.showing': 'showing',
  'species.pick': 'Pick a species from the list.',
  'species.error': 'The index could not be loaded.',
  'species.results': 'Results',
  'tree.title': 'Taxonomy tree',
  'tree.lede': 'How the species recorded in Peru split across orders and families. Pick a group, in the tree or in the list, to see where it lives, then open it in the explorer.',
  'tree.radial': 'Radial',
  'tree.linear': 'Linear',
  'tree.reset': 'Reset',
  'tree.hint': 'Wheel to zoom · drag to pan · click to open and select',
  'tree.note': 'APG IV taxonomic hierarchy (order → family), not a phylogeny with branch lengths. Node size is proportional to species recorded in Peru.',
  'tree.orders': 'Orders',
  'tree.families': 'Families of',
  'tree.depts': 'Species per department',
  'tree.all': 'whole kingdom',
  'tree.open': 'Open in the explorer',
  'tree.unplaced': '(no APG order)',
  'tree.loading': 'loading…',
  'fungi.caveat': 'Peru’s fungi are far less inventoried than its plants. Expect small numbers and many holes: this is what has been collected and digitised, not the real diversity. Nothing is smoothed over.',
} as const;

const esBase: Record<keyof typeof enBase, string> = {
  'site.title': 'Botánica — atlas de la flora del Perú',
  'site.brand': 'Botánica',
  'site.tagline': 'Flora y hongos del Perú, con datos abiertos',
  'site.description': 'Explora 21 585 especies de plantas y 1 802 de hongos registradas en el Perú: haz clic en un departamento, una familia o una década y todas las vistas responden. WCVP (Kew) + ocurrencias GBIF, datos abiertos.',
  'nav.explore': 'Explorar',
  'nav.species': 'Especies',
  'nav.tree': 'Árbol taxonómico',
  'nav.home': 'Portafolio iC7',
  'nav.lang': 'Idioma',
  'theme.toggle': 'Cambiar tema claro/oscuro',
  'lang.switch': 'Leer en español',
  'skip': 'Ir al contenido',

  'k.plantae': 'Plantas',
  'k.fungi': 'Hongos',
  'k.label': 'Reino',

  'hero.title': '¿Qué crece dónde en el Perú?',
  'hero.lede': 'Haz clic en un departamento, una familia, un origen o una década. Todas las vistas responden juntas, y la barra de direcciones guarda la pregunta para que puedas compartirla.',
  'hint.map': 'Toca un departamento para filtrar todo',
  'hint.more': 'Mayús + clic (o «Comparar») agrega un segundo departamento',

  'filters.none': 'Todo el Perú · sin filtros',
  'filters.clear': 'Quitar todo',
  'filters.remove': 'Quitar filtro',

  'kpi.species': 'especies',
  'kpi.families': 'familias',
  'kpi.orders': 'órdenes',
  'kpi.endemic': 'endémicas del Perú',
  'kpi.introduced': 'introducidas',
  'kpi.median': 'año mediano de descripción',
  'kpi.withRecords': 'con registros georreferenciados',

  'map.title': 'Dónde',
  'map.metric': 'El mapa muestra',
  'map.m.species': 'especies',
  'map.m.records': 'registros',
  'map.m.coverage': 'especies por mil registros',
  'map.metricLocked': 'Los registros se cuentan por ocurrencia, no por especie, así que no se pueden filtrar por taxón ni por año. Quita esos filtros para ver el esfuerzo de muestreo.',
  'map.caveat': 'Los conteos reflejan el esfuerzo de colecta tanto como la biodiversidad: donde más se colectó, más aparece.',
  'map.legend': 'Leyenda: haz clic en un tramo para resaltar sus departamentos',
  'map.noData': 'sin registros',
  'map.species': 'Dónde se registró esta especie',

  'dep.species': 'especies',
  'dep.records': 'registros',
  'dep.topFamilies': 'Familias principales aquí',
  'dep.compare': 'Comparar con…',
  'dep.clear': 'Quitar selección',
  'cmp.title': 'Comparación',
  'cmp.only': 'solo en',
  'cmp.both': 'en ambos',
  'cmp.exclusive': 'Familias más exclusivas',

  'fam.title': 'Familias',
  'fam.note': 'Tamaño = especies; color = orden (APG IV). Toca una familia para filtrar.',
  'fam.others': 'otras familias',
  'fam.order': 'orden',

  'life.title': 'Forma de vida',
  'life.note': 'Según WCVP. Toca para filtrar.',
  'life.nodata': '(sin dato)',
  'life.others': 'otras',
  'st.title': 'Origen',
  'st.endemica': 'Endémica',
  'st.nativa': 'Nativa (no endémica)',
  'st.introducida': 'Introducida',
  'st.nodata': 'Sin dato',
  'year.title': 'Cuándo se describieron',
  'year.note': 'Año en que la especie se describió por primera vez (WCVP): el del nombre original (basiónimo) si luego cambió de género. Arrastra sobre las décadas para elegir un rango.',
  'year.play': 'Reproducir',
  'year.stop': 'Detener',
  'year.unknown': 'sin año',
  'year.range': 'Descritas',
  'na.fungi': 'No disponible para hongos: el atlas no tiene una fuente curada para este dato. No se oculta ni se estima nada.',

  'search.label': 'Buscar especie, género o familia',
  'search.placeholder': 'Busca entre 23 387 especies…',
  'search.loading': 'cargando el índice…',
  'search.none': 'Sin resultados',
  'search.hint': '↑ ↓ para moverte · Enter para abrir',

  'sp.close': 'Cerrar',
  'sp.showMap': 'Ver en el mapa',
  'sp.filterFamily': 'Filtrar por esta familia',
  'sp.records': 'Registros',
  'sp.noRecords': 'ninguno georreferenciado',
  'sp.lifeform': 'Forma de vida',
  'sp.year': 'Descrita',
  'sp.topDepts': 'Departamentos con más registros',
  'sp.noDepts': 'Está en el checklist, pero sin registros georreferenciados en el Perú. Es un vacío real, no un error.',
  'sp.endemic': 'endémica',
  'sp.native': 'nativa',
  'sp.introduced': 'introducida',

  'tut.open': 'Cómo se usa',
  'tut.next': 'Siguiente', 'tut.prev': 'Atrás', 'tut.done': 'Entendido', 'tut.skip': 'Saltar', 'tut.of': 'de',

  'footer.data': 'Datos abiertos, atribución CC BY 4.0:',
  'footer.caveat': 'Los conteos usan nombres aceptados (sinonimia resuelta) a rango especie. Esfuerzo de muestreo ≠ riqueza.',
  'footer.code': 'Código fuente',

  'species.title': 'Especies',
  'species.lede': 'Las 21 585 especies de plantas y 1 802 de hongos registradas en el Perú, con su familia, su orden y dónde se las ha encontrado. Busca por nombre científico, género o familia.',
  'species.of': 'de',
  'species.showing': 'mostrando',
  'species.pick': 'Elige una especie de la lista.',
  'species.error': 'No se pudo cargar el índice.',
  'species.results': 'Resultados',
  'tree.title': 'Árbol taxonómico',
  'tree.lede': 'Cómo se reparten las especies registradas en el Perú entre órdenes y familias. Elige un grupo, en el árbol o en la lista, para ver dónde vive, y ábrelo en el explorador.',
  'tree.radial': 'Radial',
  'tree.linear': 'Lineal',
  'tree.reset': 'Reencuadrar',
  'tree.hint': 'Rueda para acercar · arrastrar para moverte · clic para abrir y elegir',
  'tree.note': 'Jerarquía taxonómica APG IV (orden → familia), no una filogenia con longitudes de rama. El tamaño del nodo es proporcional a las especies registradas en el Perú.',
  'tree.orders': 'Órdenes',
  'tree.families': 'Familias de',
  'tree.depts': 'Especies por departamento',
  'tree.all': 'todo el reino',
  'tree.open': 'Abrir en el explorador',
  'tree.unplaced': '(sin orden APG)',
  'tree.loading': 'cargando…',
  'fungi.caveat': 'Los hongos del Perú están muchísimo menos inventariados que sus plantas. Espera números chicos y muchos vacíos: es lo que se ha colectado y digitalizado, no la diversidad real. No se maquilla nada.',
};

// Feature strings live in src/lib/i18n-parts/<feature>.ts so parallel work never edits this file.
const en = { ...enBase, ...PARTS_EN };
export type Key = keyof typeof en;
const es: Record<Key, string> = { ...esBase, ...PARTS_ES };

export const STRINGS: Record<Locale, Record<Key, string>> = { en, es };

export const t = (locale: Locale, key: Key): string => STRINGS[locale][key] ?? en[key];

/** Number formatter. Spanish groups thousands with a narrow no-break space
 *  (21 585), as the repo's Spanish text already does, instead of es-PE's comma,
 *  which Spanish readers elsewhere read as a decimal mark. */
export const fmt = (locale: Locale) => {
  const nf = new Intl.NumberFormat(BCP47[locale]);
  return locale === 'es' ? (v: number) => nf.format(v).replace(/,/g, ' ') : (v: number) => nf.format(v);
};

/** Path of a page in a locale, relative to the site base (EN has no prefix). */
export const localePath = (locale: Locale, page = ''): string =>
  `${import.meta.env.BASE_URL}${locale === 'en' ? '' : `${locale}/`}${page}`;
