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
} satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;

export const sourceHref = (s: Source): string => (s.doi ? `https://doi.org/${s.doi}` : s.url ?? '#');
