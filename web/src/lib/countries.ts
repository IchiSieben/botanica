/**
 * Registro de paises. F1 = solo Peru (default), pero el selector y las rutas
 * quedan parametrizados para sumar paises en fases siguientes (F4 comparativo)
 * sin tocar componentes: cada pais apunta a su propio set de marts.
 */
export interface Country {
  /** Codigo WGSRPD nivel 3 (mismo que ATLAS_COUNTRY_L3 del ETL). */
  code: string;
  name: string;
  flag: string;
  /** Si hay datos exportados para este pais (F1: solo PER). */
  available: boolean;
}

export const COUNTRIES: Country[] = [
  { code: 'PER', name: 'Perú', flag: '🇵🇪', available: true },
  { code: 'COL', name: 'Colombia', flag: '🇨🇴', available: false },
  { code: 'ECU', name: 'Ecuador', flag: '🇪🇨', available: false },
  { code: 'BOL', name: 'Bolivia', flag: '🇧🇴', available: false },
];

export const DEFAULT_COUNTRY = 'PER';

export const getCountry = (code: string = DEFAULT_COUNTRY): Country =>
  COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
