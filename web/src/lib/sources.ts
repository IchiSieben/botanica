/**
 * Every source the page cites, with the exact version we used. Single place of truth:
 * chart source lines, intro facts and the footer read from here.
 * DOIs are checked by `npm run check:dois` (doi.org handle API, responseCode 1).
 * Versions/dates come from data/raw/manifest.json (retrieved_at) — not from memory.
 */
export interface Source {
  /** Short label shown in source lines. Proper names, never translated. */
  label: string;
  version?: string;
  /** Publication or retrieval year, for dossier sources without a `version` snapshot. */
  year?: number;
  doi?: string;
  url?: string;
  license?: string;
}

export const SOURCES = {
  wcvp: {
    label: 'WCVP, Royal Botanic Gardens, Kew',
    version: 'snapshot 2026-06-22',
    doi: '10.15468/6h8ucr',
    license: 'CC BY 4.0',
  },
  wcvpPaper: {
    label: 'Govaerts et al. 2021, Scientific Data 8: 215',
    doi: '10.1038/s41597-021-00997-6',
  },
  gbifPlantae: {
    label: 'GBIF.org occurrence download, Plantae, Peru',
    version: '22 June 2026 · 1,287,722 records',
    doi: '10.15468/dl.x4m2bc',
    license: 'CC BY / CC0 per dataset',
  },
  gbifFungi: {
    label: 'GBIF.org occurrence download, Fungi, Peru',
    version: '22 June 2026 · 14,788 records',
    doi: '10.15468/dl.uh7bd4',
    license: 'CC BY / CC0 per dataset',
  },
  gbifBackbone: {
    label: 'GBIF Backbone Taxonomy (fungi: Index Fungorum)',
    doi: '10.15468/39omei',
    license: 'CC BY 4.0',
  },
  apg4: {
    label: 'APG IV 2016, Botanical Journal of the Linnean Society 181: 1–20',
    doi: '10.1111/boj.12385',
  },
  ppg1: {
    label: 'PPG I 2016, Journal of Systematics and Evolution 54: 563–603',
    doi: '10.1111/jse.12229',
  },
  christenhusz2011: {
    label: 'Christenhusz et al. 2011, Phytotaxa 19: 55–70 (gymnosperms)',
    doi: '10.11646/phytotaxa.19.1.3',
  },
  geoBoundaries: {
    label: 'geoBoundaries gbOpen PER ADM1',
    url: 'https://www.geoboundaries.org/',
    license: 'CC BY 4.0',
  },
  ipni: {
    label: 'International Plant Names Index (IPNI)',
    url: 'https://www.ipni.org/',
    license: 'CC BY 4.0',
  },

  // --- Owner's dossier (docs/RESEARCH-PERU.md, consulted 2026-09-24) ------------------------
  megadiverse: {
    label: 'Biodiversity A-Z, megadiverse countries',
    year: 2026,
    url: 'https://www.biodiversitya-z.org/content/megadiverse-countries',
  },
  mincetur: {
    label: 'MINCETUR, Ficha de Inventario de Recursos Turísticos — Huascarán',
    year: 2026,
    url: 'https://consultasenlinea.mincetur.gob.pe/fichaInventario/index.aspx?cod_Ficha=568',
  },
  libroRojo: {
    label: 'León, Pitman & Roque (eds.) 2006, Revista Peruana de Biología 13(2): Libro Rojo de las Plantas Endémicas del Perú',
    year: 2006,
    doi: '10.15381/rpb.v13i2.1782',
  },
  sernanp: {
    label: 'SERNANP, áreas naturales protegidas del Perú',
    version: '19 June 2026',
    year: 2026,
    url: 'https://biodiversidadanp.sernanp.gob.pe/en/areas-naturales-protegidas/',
  },
  mondragon2024: {
    label: 'Mondragón et al. 2024, Revista Peruana de Biología 31(1)',
    year: 2024,
    doi: '10.15381/rpb.v31i1.27006',
  },
  terSteege2016: {
    label: 'ter Steege et al. 2016, Scientific Reports 6: 29549',
    year: 2016,
    doi: '10.1038/srep29549',
  },
  ruizPavonBiology2023: {
    label: 'Biology 12(2): 294, 2023 (modern review of the Ruiz, Pavón & Dombey expedition)',
    year: 2023,
    doi: '10.3390/biology12020294',
  },
  raimondiBNP: {
    label: 'Biblioteca Nacional del Perú, on Antonio Raimondi',
    year: 2024,
    url: 'https://www.bnp.gob.pe/bnp-recuerda-a-antonio-raimondi-al-cumplirse-200-anos-de-su-natalicio/',
  },
  weberbauerDB: {
    label: 'Deutsche Biographie, August Weberbauer',
    year: 2026,
    url: 'https://www.deutsche-biographie.de/sfz139422.html',
  },
  brakoZarucchi1993: {
    label: 'Brako & Zarucchi 1993, Catálogo de las Angiospermas y Gimnospermas del Perú',
    year: 1993,
    url: 'https://archive.org/details/mobot31753003155055',
  },
  ulloaUlloa2017: {
    label: 'Ulloa Ulloa et al. 2017, Science 358: 1614–1617',
    year: 2017,
    doi: '10.1126/science.aao0398',
  },
} satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;

export const sourceHref = (s: Source): string => (s.doi ? `https://doi.org/${s.doi}` : s.url ?? '#');
