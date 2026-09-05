/**
 * Carga de datos en BUILD TIME (principio 1: estatico-first).
 *
 * Unica fuente de verdad = los marts exportados por el ETL en `data/exports`.
 * MULTI-REINO: cada mart trae columna `kingdom`; los loaders filtran por el
 * reino activo (Plantae / Fungi). El sitio NO consulta crudos ni APIs en vivo.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXPORTS = new URL('../../../data/exports/', import.meta.url);

function loadMart<T>(name: string): T {
  const path = fileURLToPath(new URL(`${name}.json`, EXPORTS));
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

// --- Formas de cada mart (espejo del esquema del ETL) --------------------
export interface Kpis {
  kingdom: string;
  species: number;
  native: number;
  introduced: number;
  endemic: number;
  endemic_rate: number;
  families: number;
  genera: number;
  occurrences: number;
  occurrences_raw: number;
  assigned: number;
  unassigned: number;
  assigned_pct: number;
  unassigned_pct: number;
}

export interface FamilyRow {
  kingdom: string;
  family: string;
  order_apg: string | null;
  species: number;
  genera: number;
}

export interface LifeformRow {
  kingdom: string;
  lifeform: string;
  species: number;
}

export interface StatusRow {
  kingdom: string;
  status: 'nativa' | 'endemica' | 'introducida' | '(sin dato)';
  species: number;
}

export interface RichnessRow {
  kingdom: string;
  department: string;
  records: number;
  species: number;
}

export interface CladeDeptRow {
  kingdom: string;
  clade: string;
  color: string;
  department: string;
  records: number;
  species: number;
}

export interface DescribedRow {
  kingdom: string;
  year: number;
  species: number;
}

const byKingdom = <T extends { kingdom: string }>(rows: T[], kingdom: string): T[] =>
  rows.filter((r) => r.kingdom === kingdom);

// --- Loaders tipados (por reino) -----------------------------------------
export const getKpis = (kingdom: string): Kpis | undefined =>
  loadMart<Kpis[]>('mart_kpis').find((r) => r.kingdom === kingdom);
export const getFamilies = (kingdom: string) => byKingdom(loadMart<FamilyRow[]>('mart_family_composition'), kingdom);
export const getLifeforms = (kingdom: string) => byKingdom(loadMart<LifeformRow[]>('mart_lifeform_spectrum'), kingdom);
export const getStatus = (kingdom: string) => byKingdom(loadMart<StatusRow[]>('mart_status'), kingdom);
export const getRichness = (kingdom: string) => byKingdom(loadMart<RichnessRow[]>('mart_richness_by_department'), kingdom);
export const getCladeByDept = (kingdom: string) => byKingdom(loadMart<CladeDeptRow[]>('mart_clade_by_department'), kingdom);
export const getDescribedPerYear = (kingdom: string) => byKingdom(loadMart<DescribedRow[]>('mart_described_per_year'), kingdom);

/** Todas las filas clado x depto (sin filtrar) — para el mapa de colores global. */
export const getAllClades = () => loadMart<CladeDeptRow[]>('mart_clade_by_department');

/** Reinos con datos exportados (para getStaticPaths / selector). */
export const availableKingdoms = (): string[] =>
  [...new Set(loadMart<Kpis[]>('mart_kpis').map((r) => r.kingdom))];
