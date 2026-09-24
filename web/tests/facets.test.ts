// Unfiltered client aggregates must equal the ETL marts: the explorer derives
// every count from facets-*.json, and this proves it counts the same universe.
//
//   node --experimental-strip-types --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aggregate, compare, type Facets } from '../src/lib/facets.ts';
import { EMPTY, parse, serialize } from '../src/lib/store.ts';

const json = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const mart = (name: string) => json(`../../data/exports/${name}.json`);

for (const kingdom of ['Plantae', 'Fungi']) {
  const f: Facets = json(`../public/data/facets-${kingdom.toLowerCase()}.json`);
  const k = kingdom.toLowerCase() as 'plantae' | 'fungi';
  const a = aggregate(f, { ...EMPTY, k });

  test(`${kingdom}: totals match mart_kpis`, () => {
    const kpi = mart('mart_kpis').find((r: any) => r.kingdom === kingdom);
    assert.equal(a.total, kpi.species);
    assert.equal(a.families, kpi.families);
    if (kingdom === 'Plantae') {
      assert.equal(a.endemic, kpi.endemic);
      assert.equal(a.introduced, kpi.introduced);
    }
  });

  test(`${kingdom}: families match mart_family_composition`, () => {
    for (const row of mart('mart_family_composition').filter((r: any) => r.kingdom === kingdom)) {
      assert.equal(a.byFamily.get(f.families.indexOf(row.family)), row.species, row.family);
    }
  });

  test(`${kingdom}: status matches mart_status`, () => {
    const map: Record<string, keyof typeof a.byStatus> = {
      endemica: 'endemica', nativa: 'nativa', introducida: 'introducida', '(sin dato)': 'nodata',
    };
    for (const row of mart('mart_status').filter((r: any) => r.kingdom === kingdom)) {
      assert.equal(a.byStatus[map[row.status]], row.species, row.status);
    }
  });

  test(`${kingdom}: lifeforms match mart_lifeform_spectrum`, () => {
    for (const row of mart('mart_lifeform_spectrum').filter((r: any) => r.kingdom === kingdom)) {
      const i = row.lifeform === '(sin dato)' ? -1 : f.lifeforms.indexOf(row.lifeform);
      assert.equal(a.byLife.get(i), row.species, row.lifeform);
    }
  });
}

test('Plantae: filters narrow and cross-filter views exclude their own dimension', () => {
  const f: Facets = json('../public/data/facets-plantae.json');
  const all = aggregate(f, EMPTY);
  const lor = aggregate(f, { ...EMPTY, dep: ['LORETO'] });
  assert.equal(lor.total, all.byDept[f.depts.indexOf('LORETO')]);
  // The map ignores its own filter: selecting Loreto leaves the other departments' counts intact.
  assert.deepEqual(lor.byDept, all.byDept);
  const orch = aggregate(f, { ...EMPTY, dep: ['LORETO'], fam: 'Orchidaceae' });
  assert.ok(orch.total > 0 && orch.total < lor.total);
  assert.equal(orch.byFamily.get(f.families.indexOf('Orchidaceae')), orch.total);
  // Unknown names match nothing instead of silently dropping the filter.
  assert.equal(aggregate(f, { ...EMPTY, fam: 'Nonexistentaceae' }).total, 0);
});

test('Plantae: comparison partitions the union', () => {
  const f: Facets = json('../public/data/facets-plantae.json');
  const c = compare(f, EMPTY, 'LORETO', 'CUSCO');
  const union = aggregate(f, { ...EMPTY, dep: ['LORETO', 'CUSCO'] }).total;
  assert.equal(c.onlyA + c.both + c.onlyB, union);
});

test('store: URL round-trip and sanitising', () => {
  const s = parse('?k=fungi&dep=loreto,cusco,puno&st=bogus&y0=1900&y1=19x9&m=records');
  assert.deepEqual(s.dep, ['LORETO', 'CUSCO']);
  assert.equal(s.st, null);
  assert.equal(s.y1, null);
  assert.equal(serialize(s), '?k=fungi&dep=LORETO%2CCUSCO&y0=1900&m=records');
  assert.equal(serialize(EMPTY), '');
});
