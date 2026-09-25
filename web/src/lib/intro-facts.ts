/**
 * Intro facts (v3 item 1), computed at BUILD TIME from our own exports — never typed in.
 *
 * Inputs: `public/data/{facets,protologue}-*.json` (the files the browser fetches) and the
 * ETL marts in `data/exports/`. Every fact names the source it is cited to (lib/sources.ts).
 * `computeFacts` is pure so tests can feed it the same JSON; `loadIntroInputs` reads disk.
 *
 * Conventions (so the intro can never disagree with the explorer on the same page):
 * - Species per department = checklist ∩ GBIF (facets `mask`), as the map since v2 — NOT the
 *   mart's `species` column (all GBIF names; LORETO 7,905 vs 5,821).
 * - Median year = `aggregate(f, EMPTY).medianYear`, the explorer's own KPI.
 * - Record counts = cleaned records in the marts (`occurrences`), which are lower than the raw
 *   download sizes shown in sources.ts versions; the cards say "cleaned records".
 * - The mart's `unassigned` pseudo-department (records without a department) is excluded from
 *   every ranking, but counted in the total the top-3 share is divided by.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aggregate, type Facets } from './facets.ts';
import { EMPTY } from './store.ts';
import { SOURCES, type SourceKey } from './sources.ts';

/** Ruiz & Pavón as author of the original description. The brief's pattern is
 *  `/Ruiz\s*&\s*Pav/`; "A ex B" means B validly published the name, so the strict
 *  pattern drops strings where ` ex ` follows (e.g. "Ruiz & Pav. ex G.Don"). */
export const RUIZ_PAVON_LOOSE = /Ruiz\s*&\s*Pav/;
export const RUIZ_PAVON = /^Ruiz\s*&\s*Pav\.?(?!.*\bex\b)/;

/** Our own release dates (typed on purpose: they are ours; cited to /cambios/). */
export const RELEASES = [
  { version: 'v1.0.0', date: '2026-09-22' },
  { version: 'v2.0.0', date: '2026-09-24' },
  { version: 'v3.0.0', date: '2026-09-24' },
] as const;

/**
 * NOT RENDERED. Slot for facts that need the owner's research dossier
 * (docs/RESEARCH-PERU.md), which does not exist yet (SPEC "Out of scope").
 * Nothing here may be shown until each entry has a citation from the dossier.
 */
export const DOSSIER_PENDING = [
  { id: 'ruiz-pavon-expedition-start', note: 'Start of the Ruiz & Pavón expedition (1777 anchor for the timeline)' },
  { id: 'megadiverse', note: 'Peru among megadiverse countries — needs a cited source' },
  { id: 'country-rankings', note: 'Country rankings (orchids, endemics…) — needs a cited source' },
] as const;

export type FactFormat = 'int' | 'pct' | 'year';

export interface Fact {
  id: string;
  /** The big number. For 'pct', a percentage (0–100). */
  value: number;
  format: FactFormat;
  source: SourceKey;
  /** Values for the placeholders of `intro.fact.<id>.detail` (numbers are formatted, strings are dept keys or names). */
  detail?: Record<string, number | string>;
}

export interface Milestone {
  id: 'earliest' | 'rp-first' | 'rp-peak' | 'peak-decade' | 'since2000' | 'snapshot' | 'releases';
  /** Year shown on the axis. */
  year: number;
  /** Label for the year (e.g. "1930s", "2000–2025", a date). */
  when: string;
  source: SourceKey | 'changes';
  detail: Record<string, number | string>;
}

export interface Contrast {
  /** Department with the most cleaned records. */
  a: { dep: string; records: number; species: number };
  /** Department with the most species with records (differs from `a`). */
  b: { dep: string; records: number; species: number };
  /** a.records / b.records. */
  ratio: number;
}

export interface IntroData {
  facts: Fact[];
  milestones: Milestone[];
  contrast: Contrast | null;
  /** Headline numbers reused in the opening sentence. */
  head: { species: number; endemicPct: number; noRecordsPct: number };
  ruizPavon: { loose: number; strict: number; y0: number; y1: number; tail: number[] };
}

interface RichRow { kingdom: string; department: string; records: number; species: number }
interface KpiRow { kingdom: string; species: number; endemic: number; occurrences: number; families: number }

export interface IntroInputs {
  plantae: Facets;
  fungi: Facets;
  /** Rows aligned with facets-plantae: [ipniId, authors]. */
  protologue: [string, string][];
  richness: RichRow[];
  kpis: KpiRow[];
}

const EXPORTS = new URL('../../../data/exports/', import.meta.url);
const PUBLIC = new URL('../../public/data/', import.meta.url);
const read = (u: URL) => JSON.parse(readFileSync(fileURLToPath(u), 'utf-8'));

export function loadIntroInputs(): IntroInputs {
  return {
    plantae: read(new URL('facets-plantae.json', PUBLIC)),
    fungi: read(new URL('facets-fungi.json', PUBLIC)),
    protologue: read(new URL('protologue-plantae.json', PUBLIC)).rows,
    richness: read(new URL('mart_richness_by_department.json', EXPORTS)),
    kpis: read(new URL('mart_kpis.json', EXPORTS)),
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const pct = (a: number, b: number) => round1((100 * a) / b);

/** ISO date from a source's version string ("snapshot 2026-06-22"). */
export function snapshotDate(): string {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(SOURCES.wcvp.version);
  if (!m) throw new Error('intro-facts: no ISO date in SOURCES.wcvp.version');
  return m[1];
}

export function computeFacts(inp: IntroInputs): IntroData {
  const f = inp.plantae;
  const n = f.mask.length;
  if (f.meta.species !== n) throw new Error('intro-facts: facets rows != meta.species');
  if (inp.protologue.length !== n) throw new Error('intro-facts: protologue rows are not aligned with facets');
  const agg = aggregate(f, EMPTY);

  // --- Checklist -----------------------------------------------------------
  const endemic = agg.endemic;
  const endemicPct = pct(endemic, n);

  const famCount = new Map<number, number>();
  for (const i of f.fam) famCount.set(i, (famCount.get(i) ?? 0) + 1);
  const [topFamIdx, topFamN] = [...famCount].sort((a, b) => b[1] - a[1])[0];

  // --- GBIF coverage ---------------------------------------------------------
  const noRecords = f.mask.filter((m) => m === 0).length;
  const noRecordsPct = pct(noRecords, n);

  const perDept = f.depts.map((dep, d) => ({ dep, species: f.mask.reduce((s, m) => s + ((m >> d) & 1), 0) }));
  const bySpecies = [...perDept].sort((a, b) => b.species - a.species);
  const most = bySpecies[0];
  const fewest = bySpecies[bySpecies.length - 1];

  const rich = inp.richness.filter((r) => r.kingdom === 'Plantae');
  const totalRecords = rich.reduce((s, r) => s + r.records, 0); // includes `unassigned`
  const depts = rich.filter((r) => f.depts.includes(r.department)).sort((a, b) => b.records - a.records);
  const top3 = depts.slice(0, 3);
  const top3Share = pct(top3.reduce((s, r) => s + r.records, 0), totalRecords);
  const kp = inp.kpis.find((k) => k.kingdom === 'Plantae')!;
  if (kp.occurrences !== totalRecords) throw new Error('intro-facts: records mart != KPI occurrences');

  // --- Years described (WCVP first_published, basionym if any) ---------------
  const years = (f.year ?? []).filter((y) => y > 0);
  const since2000 = years.filter((y) => y >= 2000).length;
  const y0 = Math.min(...years);
  const y0Count = years.filter((y) => y === y0).length;
  const yMax = Math.max(...years);
  const decades = new Map<number, number>();
  for (const y of years) decades.set(Math.floor(y / 10) * 10, (decades.get(Math.floor(y / 10) * 10) ?? 0) + 1);
  const [peakDecade, peakDecadeN] = [...decades].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];

  // --- Ruiz & Pavón (protologue authors) -------------------------------------
  const loose = inp.protologue.filter((r) => RUIZ_PAVON_LOOSE.test(r[1] ?? '')).length;
  const rpYears = inp.protologue
    .map((r, i) => (RUIZ_PAVON.test(r[1] ?? '') ? (f.year?.[i] ?? 0) : -1))
    .filter((y) => y >= 0);
  const strict = rpYears.length;
  const rpDated = rpYears.filter((y) => y > 0);
  const rpByYear = new Map<number, number>();
  for (const y of rpDated) rpByYear.set(y, (rpByYear.get(y) ?? 0) + 1);
  const [rpPeakYear, rpPeakN] = [...rpByYear].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const rpY0 = Math.min(...rpDated);
  const rpY1 = Math.max(...rpDated);
  // Years with a single species, listed so the report can quote the tail from the data.
  const tail = [...rpByYear].filter(([, c]) => c === 1).map(([y]) => y).sort((a, b) => a - b);
  const rpFirstN = rpByYear.get(rpY0) ?? 0;

  // --- Fungi ------------------------------------------------------------------
  const fk = inp.kpis.find((k) => k.kingdom === 'Fungi')!;
  if (fk.species !== inp.fungi.mask.length) throw new Error('intro-facts: fungi facets != KPI');

  // --- Records ≠ richness --------------------------------------------------------
  const spOf = (dep: string) => perDept.find((p) => p.dep === dep)!.species;
  const mostRecords = depts[0];
  const recOf = (dep: string) => depts.find((r) => r.department === dep)?.records ?? 0;
  const contrast: Contrast | null =
    most.dep !== mostRecords.department && most.species > spOf(mostRecords.department)
      ? {
          a: { dep: mostRecords.department, records: mostRecords.records, species: spOf(mostRecords.department) },
          b: { dep: most.dep, records: recOf(most.dep), species: most.species },
          ratio: round1(mostRecords.records / recOf(most.dep)),
        }
      : null;

  const facts: Fact[] = [
    { id: 'species', value: n, format: 'int', source: 'wcvp' },
    { id: 'endemic', value: endemicPct, format: 'pct', source: 'wcvp', detail: { n: endemic } },
    { id: 'families', value: agg.families, format: 'int', source: 'wcvp', detail: { orders: agg.orders } },
    { id: 'topFamily', value: topFamN, format: 'int', source: 'wcvp', detail: { family: f.families[topFamIdx], pct: pct(topFamN, n) } },
    { id: 'noRecords', value: noRecordsPct, format: 'pct', source: 'gbifPlantae', detail: { n: noRecords } },
    { id: 'richestDept', value: most.species, format: 'int', source: 'gbifPlantae', detail: { dep: most.dep, fewest: fewest.dep, fewestN: fewest.species } },
    {
      id: 'top3Records', value: top3Share, format: 'pct', source: 'gbifPlantae',
      detail: { a: top3[0].department, b: top3[1].department, c: top3[2].department, total: totalRecords },
    },
    { id: 'since2000', value: since2000, format: 'int', source: 'wcvp', detail: { pct: pct(since2000, years.length), median: agg.medianYear ?? 0 } },
    { id: 'ruizPavon', value: strict, format: 'int', source: 'ipni', detail: { y0: rpY0, peak: rpPeakYear, peakN: rpPeakN } },
    { id: 'fungi', value: fk.species, format: 'int', source: 'gbifFungi', detail: { records: fk.occurrences } },
  ];

  const snap = snapshotDate();
  const milestones: Milestone[] = [
    { id: 'earliest', year: y0, when: String(y0), source: 'wcvp', detail: { n: y0Count } },
    { id: 'rp-first', year: rpY0, when: String(rpY0), source: 'ipni', detail: { n: rpFirstN } },
    { id: 'rp-peak', year: rpPeakYear, when: String(rpPeakYear), source: 'ipni', detail: { n: rpPeakN, total: strict } },
    { id: 'peak-decade', year: peakDecade, when: `${peakDecade}s`, source: 'wcvp', detail: { n: peakDecadeN } },
    { id: 'since2000', year: 2000, when: `2000–${yMax}`, source: 'wcvp', detail: { n: since2000 } },
    { id: 'snapshot', year: Number(snap.slice(0, 4)), when: snap, source: 'gbifPlantae', detail: {} },
    { id: 'releases', year: Number(RELEASES[0].date.slice(0, 4)), when: RELEASES[0].date, source: 'changes', detail: { v1: RELEASES[0].date, v3: RELEASES[2].date } },
  ].sort((a, b) => a.year - b.year || 0) as Milestone[];

  return {
    facts, milestones, contrast,
    head: { species: n, endemicPct, noRecordsPct },
    ruizPavon: { loose, strict, y0: rpY0, y1: rpY1, tail },
  };
}
