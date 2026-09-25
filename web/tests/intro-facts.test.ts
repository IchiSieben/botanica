// The intro's numbers must be recomputable from the raw JSON the site ships: two facts are
// recomputed here independently (no helper from intro-facts.ts) and compared.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeFacts, loadIntroInputs, DOSSIER_PENDING } from '../src/lib/intro-facts.ts';

const json = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const facets = json('../public/data/facets-plantae.json');
const protologue: [string, string][] = json('../public/data/protologue-plantae.json').rows;
const data = computeFacts(loadIntroInputs());
const fact = (id: string) => data.facts.find((f) => f.id === id)!;

test('8–10 facts, each with a source', () => {
  assert.ok(data.facts.length >= 8 && data.facts.length <= 10, `${data.facts.length} facts`);
  for (const f of data.facts) assert.ok(f.source && Number.isFinite(f.value), f.id);
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
  assert.equal(fact('ruizPavon').value, count);
  assert.equal(data.ruizPavon.y0, y0);
  assert.equal(data.ruizPavon.y1, y1);
  // The brief's looser pattern also counts "Ruiz & Pav. ex X" (published by X).
  assert.ok(data.ruizPavon.loose >= count);
});

test('timeline starts at the earliest year described, with no dossier facts rendered', () => {
  const earliest = Math.min(...facets.year.filter((y: number) => y > 0));
  assert.equal(data.milestones[0].year, earliest);
  assert.ok(DOSSIER_PENDING.length > 0);
  assert.ok(!data.milestones.some((m) => m.year === 1777));
});
