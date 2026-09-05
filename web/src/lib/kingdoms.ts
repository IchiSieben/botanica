/**
 * Registro de REINOS (preparatorio multi-reino, paralelo a countries.ts).
 * F1 = solo Plantae (WCVP/Kew). Fungi entra después con Index Fungorum: misma
 * estructura de marts, otra fuente. El shell ya queda parametrizado por reino
 * aunque el selector no se muestre todavía.
 */
export interface Kingdom {
  /** Coincide con dim_taxon.kingdom / mart_kpis.kingdom del ETL. */
  code: string;
  name: string;
  icon: string;
  source: string;
  available: boolean;
  /** DOI de la descarga GBIF de ocurrencias de este reino (atribución CC BY). */
  gbifDoi: string;
}

export const KINGDOMS: Kingdom[] = [
  { code: 'Plantae', name: 'Plantas', icon: '🌿', source: 'WCVP (Kew)', available: true, gbifDoi: '10.15468/dl.x4m2bc' },
  { code: 'Fungi', name: 'Hongos', icon: '🍄', source: 'Index Fungorum (vía GBIF)', available: true, gbifDoi: '10.15468/dl.uh7bd4' },
];

export const DEFAULT_KINGDOM = 'Plantae';

export const getKingdom = (code: string = DEFAULT_KINGDOM): Kingdom =>
  KINGDOMS.find((k) => k.code === code) ?? KINGDOMS[0];

/** Slug de URL para un reino (Plantae = raíz, resto = /{slug}/). */
export const kingdomSlug = (code: string): string => code.toLowerCase();
export const kingdomHref = (code: string): string =>
  code === DEFAULT_KINGDOM ? '/' : `/${kingdomSlug(code)}/`;
