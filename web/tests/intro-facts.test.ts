// The intro's numbers must be recomputable from the raw JSON the site ships: two own-data facts
// are recomputed here independently (no helper from intro-facts.ts) and compared. Dossier facts
// (docs/RESEARCH-PERU.md) are hard-coded in intro-facts.ts; this file checks every fact and
// milestone carries a citation that exists in lib/sources.ts, own-data or not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeFacts, loadIntroInputs } from '../src/lib/intro-facts.ts';
import { SOURCES } from '../src/lib/sources.ts';

const json = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const facets = json('../public/data/facets-plantae.json');
const protologue: [string, string][] = json('../public/data/protologue-plantae.json').rows;
const data = computeFacts(loadIntroInputs());
const fact = (id: string) => data.facts.find((f) => f.id === id)!;

test('8–10 facts, each with a source that exists in lib/sources.ts', () => {
  assert.ok(data.facts.length >= 8 && data.facts.length <= 10, `${data.facts.length} facts`);
  for (const f of data.facts) {
    assert.ok(f.source && Number.isFinite(f.value), f.id);
    assert.ok(f.source in SOURCES, `${f.id}: unknown source ${f.source}`);
    for (const [k, src] of Object.entries(f.detailSource ?? {})) assert.ok(src && src in SOURCES, `${f.id}.${k}: unknown source ${src}`);
  }
});

test('every milestone has a source that exists in lib/sources.ts (or is our own changelog)', () => {
  for (const m of data.milestones) {
    assert.ok(m.source === 'changes' || m.source in SOURCES, `${m.id}: unknown source ${m.source}`);
  }
});

test('the Libro Rojo comparison fact cites both the dossier and our own WCVP figure', () => {
  const f = fact('endemicCompare');
  assert.equal(f.source, 'libroRojo');
  assert.equal(f.detailSource?.ownPct, 'wcvp');
  assert.equal(f.detail?.ownPct, fact('endemic').value);
  assert.equal(f.detail?.ownN, fact('endemic').detail?.n);
});

test('share of checklist species with no GBIF record placed in a department', () => {
  let zero = 0;
  for (const m of facets.mask) if (m === 0) zero++;
  const n = facets.mask.length;
  assert.equal(fact('noRecords').detail!.n, zero);
  assert.equal(fact('noRecords').value, Math.round((1000 * zero) / n) / 10);
});

test('Ruiz & Pavón original descriptions (strict: no "ex") and their year range', () => {
  let count = 0;
  let y0 = Infinity;
  let y1 = -Infinity;
  protologue.forEach(([, authors], i) => {
    if (!authors || !authors.startsWith('Ruiz & Pav') || / ex /.test(authors)) return;
    count++;
    const y = facets.year[i];
    if (y > 0) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  });
  // Ruiz & Pavón is no longer a rendered fact card (dropped for the dossier mix, SPEC v3.1
  // item 0), but IntroData.ruizPavon still carries it — it feeds the 'rp-first'/'rp-peak'
  // timeline milestones.
  assert.equal(data.ruizPavon.strict, count);
  assert.equal(data.ruizPavon.y0, y0);
  assert.equal(data.ruizPavon.y1, y1);
  // The brief's looser pattern also counts "Ruiz & Pav. ex X" (published by X).
  assert.ok(data.ruizPavon.loose >= count);
});

test('timeline starts at 1777 (dossier anchor) and ends at 2026 (this atlas), never at 1753', () => {
  // 1753 (Linnaeus, Species Plantarum) is the earliest year in the raw WCVP data, but SPEC v3.1
  // drops it: the brief's timeline starts with the Ruiz, Pavón & Dombey expedition (1777).
  const earliest = Math.min(...facets.year.filter((y: number) => y > 0));
  assert.equal(earliest, 1753, 'sanity check: the raw data still has a pre-1777 year');
  assert.equal(data.milestones[0].year, 1777);
  assert.equal(data.milestones[0].id, 'rp-expedition');
  assert.equal(data.milestones.at(-1)!.year, 2026);
  assert.ok(!data.milestones.some((m) => m.year === 1753));
  assert.ok(!data.milestones.some((m) => m.year === 1802), 'the ⚠️ Humboldt row is not shown');
});
