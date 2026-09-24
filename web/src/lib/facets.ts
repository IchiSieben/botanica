/**
 * Cross-filter engine over the per-species facet columns
 * (`public/data/facets-<kingdom>.json`, built by etl/build_species_index.py).
 *
 * Species counts are distinct counts, so they don't add across departments or
 * filters; pre-aggregated marts can't answer "Loreto + Orchidaceae + endemic".
 * Here every species is a row and every view is recomputed from the rows, in
 * one pass (~21.5k rows, a few ms).
 *
 * Crossfilter convention: each view counts the species that pass every filter
 * EXCEPT its own dimension, so its bars show the alternatives you could switch
 * to, and the selected one is highlighted. Pure functions: the build uses them
 * for the first paint, the browser for every state change.
 */
import type { State, Status } from './store';

export interface Facets {
  meta: { kingdom: string; species: number; flags: { native: number; introduced: number; endemic: number }; yearSource: string | null };
  depts: string[];
  families: string[];
  orders: string[];
  lifeforms: string[];
  fam: number[];
  ord: number[];
  life: number[];
  flags: number[];
  mask: number[];
  year: number[] | null;
}

export const DECADE0 = 1750;
export const DECADES = 28; // 1750 … 2020s

export function statusOf(flags: number, F: Facets['meta']['flags']): Status {
  if (flags & F.endemic) return 'endemica';
  if (flags & F.native) return 'nativa';
  if (flags & F.introduced) return 'introducida';
  return 'nodata';
}

export interface Aggregates {
  /** Species passing ALL filters. */
  total: number;
  families: number;
  orders: number;
  endemic: number;
  introduced: number;
  withRecords: number;
  medianYear: number | null;
  /** Per view (own dimension excluded). */
  byDept: number[];
  byFamily: Map<number, number>;
  byLife: Map<number, number>;
  byStatus: Record<Status, number>;
  byDecade: number[];
  /** Species with no year, among those passing the other filters. */
  noYear: number;
}

/** Resolved filter: names turned into indices once per state. */
interface Resolved {
  depMask: number;
  ord: number;
  fam: number;
  lf: number;
  st: Status | null;
  y0: number;
  y1: number;
  hasYear: boolean;
}

function resolve(f: Facets, s: State): Resolved {
  let depMask = 0;
  for (const d of s.dep) {
    const i = f.depts.indexOf(d);
    if (i >= 0) depMask |= 1 << i;
  }
  const idx = (pool: string[], v: string | null) => (v == null ? -1 : pool.indexOf(v));
  // An unknown name must match nothing, not everything: -2 never equals a row.
  const pick = (pool: string[], v: string | null) => (v == null ? -1 : idx(pool, v) >= 0 ? idx(pool, v) : -2);
  const hasYear = !!f.year && (s.y0 != null || s.y1 != null);
  return {
    depMask: s.dep.length && !depMask ? -1 : depMask,
    ord: pick(f.orders, s.ord),
    fam: pick(f.families, s.fam),
    lf: pick(f.lifeforms, s.lf),
    st: s.st,
    y0: s.y0 ?? 0,
    y1: s.y1 ?? 9999,
    hasYear,
  };
}

// Dimension bits for the "fails" bookkeeping.
const D_DEP = 1, D_TAX = 2, D_LIFE = 4, D_ST = 8, D_YEAR = 16;

/** Which dimensions row i fails. The family view excludes only `fam`, so `ord`
 *  is folded into D_TAX together with fam but tracked apart below. */
function fails(f: Facets, r: Resolved, i: number): { bits: number; famOnly: boolean } {
  let bits = 0;
  if (r.depMask && (r.depMask === -1 || !(f.mask[i] & r.depMask))) bits |= D_DEP;
  const ordFail = r.ord !== -1 && f.ord[i] !== r.ord;
  const famFail = r.fam !== -1 && f.fam[i] !== r.fam;
  if (ordFail || famFail) bits |= D_TAX;
  if (r.lf !== -1 && f.life[i] !== r.lf) bits |= D_LIFE;
  if (r.st && statusOf(f.flags[i], f.meta.flags) !== r.st) bits |= D_ST;
  if (r.hasYear) {
    const y = f.year![i];
    if (!y || y < r.y0 || y > r.y1) bits |= D_YEAR;
  }
  return { bits, famOnly: famFail && !ordFail };
}

export function aggregate(f: Facets, s: State): Aggregates {
  const r = resolve(f, s);
  const n = f.fam.length;
  const byDept = new Array(f.depts.length).fill(0);
  const byFamily = new Map<number, number>();
  const byLife = new Map<number, number>();
  const byStatus: Record<Status, number> = { endemica: 0, nativa: 0, introducida: 0, nodata: 0 };
  const byDecade = new Array(DECADES).fill(0);
  let noYear = 0;
  let total = 0, endemic = 0, introduced = 0, withRecords = 0;
  const fams = new Set<number>(), ords = new Set<number>();
  const years: number[] = [];
  const inc = <K,>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);

  for (let i = 0; i < n; i++) {
    const { bits, famOnly } = fails(f, r, i);
    // A row that fails two or more dimensions counts nowhere.
    if (bits & (bits - 1)) continue;
    const st = statusOf(f.flags[i], f.meta.flags);
    const y = f.year ? f.year[i] : 0;

    if (bits === 0) {
      total++;
      if (f.fam[i] >= 0) fams.add(f.fam[i]);
      if (f.ord[i] >= 0) ords.add(f.ord[i]);
      if (st === 'endemica') endemic++;
      if (st === 'introducida') introduced++;
      if (f.mask[i]) withRecords++;
      if (y) years.push(y);
    }
    if (bits === 0 || bits === D_DEP) {
      const m = f.mask[i];
      for (let d = 0; m >> d; d++) if ((m >> d) & 1) byDept[d]++;
    }
    // The family view keeps the order filter (families of the chosen order)
    // but drops the family one.
    if (bits === 0 || (bits === D_TAX && famOnly)) inc(byFamily, f.fam[i]);
    if (bits === 0 || bits === D_LIFE) inc(byLife, f.life[i]);
    if (bits === 0 || bits === D_ST) byStatus[st]++;
    if (bits === 0 || bits === D_YEAR) {
      if (y) {
        const b = Math.min(DECADES - 1, Math.max(0, Math.floor((y - DECADE0) / 10)));
        byDecade[b]++;
      } else noYear++;
    }
  }

  years.sort((a, b) => a - b);
  return {
    total, families: fams.size, orders: ords.size, endemic, introduced, withRecords,
    medianYear: years.length ? years[years.length >> 1] : null,
    byDept, byFamily, byLife, byStatus, byDecade, noYear,
  };
}

/** Species rows passing all filters (for lists and the comparison). */
export function rowsMatching(f: Facets, s: State): number[] {
  const r = resolve(f, s);
  const out: number[] = [];
  for (let i = 0; i < f.fam.length; i++) if (fails(f, r, i).bits === 0) out.push(i);
  return out;
}

/** Two-department comparison over the rows passing every non-department filter. */
export function compare(f: Facets, s: State, a: string, b: string) {
  const ia = f.depts.indexOf(a), ib = f.depts.indexOf(b);
  const r = resolve(f, { ...s, dep: [] });
  let onlyA = 0, both = 0, onlyB = 0;
  const famA = new Map<number, number>(), famB = new Map<number, number>();
  for (let i = 0; i < f.fam.length; i++) {
    if (fails(f, r, i).bits) continue;
    const inA = (f.mask[i] >> ia) & 1, inB = (f.mask[i] >> ib) & 1;
    if (inA && inB) both++;
    else if (inA) { onlyA++; famA.set(f.fam[i], (famA.get(f.fam[i]) ?? 0) + 1); }
    else if (inB) { onlyB++; famB.set(f.fam[i], (famB.get(f.fam[i]) ?? 0) + 1); }
  }
  const top = (m: Map<number, number>) =>
    [...m].filter(([k]) => k >= 0).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => ({ family: f.families[k] ?? '—', species: v }));
  return { onlyA, both, onlyB, topA: top(famA), topB: top(famB) };
}
