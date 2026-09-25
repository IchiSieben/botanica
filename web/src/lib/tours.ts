/**
 * Guided-tour steps per page and locale, for the shared tutorial library
 * (public/tutorial/, byte-identical to radar-precios'). Targets are asserted
 * by the gate script (scripts/gate.mjs): a renamed element fails the gate
 * instead of the step silently disappearing.
 */
import type { Locale } from './i18n';

export interface Step { target?: string; title: string; body: string; placement?: 'top' | 'bottom' | 'left' | 'right' }

export const TOURS: Record<'explore' | 'species' | 'tree', Record<Locale, Step[]>> = {
  explore: {
    en: [
      { title: 'An atlas you can ask', body: 'Peru’s <b>21,585 plant</b> and <b>1,802 fungus</b> species, built on open data (WCVP, GBIF, APG IV). Every view answers every other view.' },
      { target: '#map', title: 'Start with a place', body: '<b>Click a department</b>: the numbers, families, origins and decades all recompute for it. <b>Shift-click</b> a second one to compare them.', placement: 'right' },
      { target: '.ex-map .metric', title: 'Richness or effort?', body: 'Switch to <b>records</b>: Loreto has five times Ucayali’s records but fewer species. The map measures collecting as much as nature.', placement: 'bottom' },
      { target: '#families', title: 'Or start with a group', body: 'Click a family and the map shows where it lives. Origin and growth form work the same way.', placement: 'left' },
      { target: '#years', title: 'Time', body: 'Drag across decades, or press <b>Play</b> to watch Peru’s known flora grow since Linnaeus (1753). One species in eight was described in 2000 or later.', placement: 'top' },
      { target: '#search', title: 'Find one species', body: 'Type a name, genus or family. The drawer shows its taxonomy, origin and where it was recorded, and the map follows.', placement: 'bottom' },
      { target: '#chips', title: 'Every question is a link', body: 'Active filters live here and in the address bar: share the URL and the other person sees exactly this view. <b>Back</b> undoes the last step.', placement: 'bottom' },
    ],
    es: [
      { title: 'Un atlas al que se le pregunta', body: 'Las <b>21 585 especies de plantas</b> y <b>1 802 de hongos</b> del Perú, sobre datos abiertos (WCVP, GBIF, APG IV). Cada vista le responde a las demás.' },
      { target: '#map', title: 'Empieza por un lugar', body: '<b>Haz clic en un departamento</b>: las cifras, las familias, los orígenes y las décadas se recalculan para él. <b>Mayús + clic</b> en otro para compararlos.', placement: 'right' },
      { target: '.ex-map .metric', title: '¿Riqueza o esfuerzo?', body: 'Cambia a <b>registros</b>: Loreto tiene cinco veces los registros de Ucayali, pero menos especies. El mapa mide la colecta tanto como la naturaleza.', placement: 'bottom' },
      { target: '#families', title: 'O empieza por un grupo', body: 'Haz clic en una familia y el mapa muestra dónde vive. El origen y la forma de vida funcionan igual.', placement: 'left' },
      { target: '#years', title: 'El tiempo', body: 'Arrastra sobre las décadas, o pulsa <b>Reproducir</b> para ver crecer la flora conocida del Perú desde Linneo (1753). Una de cada ocho especies se describió en el año 2000 o después.', placement: 'top' },
      { target: '#search', title: 'Busca una especie', body: 'Escribe un nombre, un género o una familia. El panel muestra su taxonomía, su origen y dónde se registró, y el mapa lo sigue.', placement: 'bottom' },
      { target: '#chips', title: 'Cada pregunta es un enlace', body: 'Los filtros activos viven aquí y en la barra de direcciones: comparte la URL y la otra persona verá exactamente esta vista. <b>Atrás</b> deshace el último paso.', placement: 'bottom' },
    ],
  },
  species: {
    en: [
      { title: 'Species finder', body: 'All <b>23,387 species</b> on one page. The index downloads once and the search runs entirely in your browser: no server, no waiting.' },
      { target: '#sp-q', title: 'Search', body: 'By scientific name (<i>Cinchona officinalis</i>), genus or <b>family</b>. It filters as you type.', placement: 'bottom' },
      { target: '.sp-kingdoms', title: 'Plants or fungi', body: 'Each kingdom has its own index; only the one you look at is downloaded.', placement: 'bottom' },
      { target: '#sp-list', title: 'The list', body: 'Name, family and number of records. Pick one to see its card.', placement: 'right' },
      { target: '#sp-detail', title: 'The card', body: 'Order and family, origin, and the departments with most records. <b>Show on map</b> opens it in the explorer.', placement: 'left' },
    ],
    es: [
      { title: 'Buscador de especies', body: 'Las <b>23 387 especies</b> en una sola página. El índice se descarga una vez y la búsqueda corre entera en tu navegador: sin servidor y sin esperas.' },
      { target: '#sp-q', title: 'Busca', body: 'Por nombre científico (<i>Cinchona officinalis</i>), por género o por <b>familia</b>. Filtra mientras escribes.', placement: 'bottom' },
      { target: '.sp-kingdoms', title: 'Plantas u hongos', body: 'Cada reino tiene su propio índice; solo se descarga el que miras.', placement: 'bottom' },
      { target: '#sp-list', title: 'La lista', body: 'Nombre, familia y número de registros. Elige una para ver su ficha.', placement: 'right' },
      { target: '#sp-detail', title: 'La ficha', body: 'Orden y familia, origen y los departamentos con más registros. <b>Ver en el mapa</b> la abre en el explorador.', placement: 'left' },
    ],
  },
  tree: {
    en: [
      { title: 'How to read this tree', body: 'How Peru’s <b>21,585 plant species</b> split across the major taxonomic groups. Four steps.' },
      { target: '#phylo-plantae-chart', title: 'Each dot is a group', body: 'The centre is the kingdom; grey dots are <b>clades</b> and the coloured ones <b>orders</b>. Dot size is the number of species and colour the clade.', placement: 'right' },
      { target: '#phylo-plantae-chart', title: 'Open and select', body: '<b>Click</b> an order to expand its families and select it: the department bars and the explorer link follow. <b>Wheel</b> to zoom, <b>drag</b> to pan.', placement: 'right' },
      { target: '#phylo-plantae-side', title: 'Where it lives', body: 'Species of the selected group per department, from the same data as the explorer.', placement: 'left' },
      { target: '#phylo-plantae .phylo-tools', title: 'If you get lost', body: '<b>Reset</b> recentres the tree. <b>Linear</b> lays it out horizontally, easier for long names.', placement: 'bottom' },
    ],
    es: [
      { title: 'Cómo se lee este árbol', body: 'Cómo se reparten las <b>21 585 especies</b> de plantas del Perú entre los grandes grupos taxonómicos. Cuatro pasos.' },
      { target: '#phylo-plantae-chart', title: 'Cada punto es un grupo', body: 'El centro es el reino; los puntos grises son <b>clados</b> y los de color, <b>órdenes</b>. El tamaño del punto es el número de especies y el color, el clado.', placement: 'right' },
      { target: '#phylo-plantae-chart', title: 'Abrir y elegir', body: '<b>Clic</b> en un orden despliega sus familias y lo selecciona: las barras por departamento y el enlace al explorador lo siguen. <b>Rueda</b> para acercar, <b>arrastrar</b> para moverte.', placement: 'right' },
      { target: '#phylo-plantae-side', title: 'Dónde vive', body: 'Especies del grupo elegido por departamento, con los mismos datos que el explorador.', placement: 'left' },
      { target: '#phylo-plantae .phylo-tools', title: 'Si te pierdes', body: '<b>Reencuadrar</b> vuelve a centrar el árbol. <b>Lineal</b> lo despliega en horizontal, más cómodo para nombres largos.', placement: 'bottom' },
    ],
  },
};
