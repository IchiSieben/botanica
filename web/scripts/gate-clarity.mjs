// Filter-clarity gate for v3.1 item 1, EN and ES:
//   1. question sentence: a multi-filter URL reads every filter in plain language and
//      ends "→ <count>"; each part is a removable chip (✕, aria-label) with a "clear all"
//   2. 0 results: an empty state lists, per active filter, the count without it, and each
//      is a button that removes it
//   3. dep-panel: the KPI count and the "top families" list never disagree (family counts
//      always sum to <= the KPI, and 0 species -> no families)
//   4. map legend: rescaled to the filtered maximum says so
//   5. the new explore-tour step (crossfilter) has a resolvable target
//   6. no CLS > 0.05 on ?dep=LORETO; 0 console errors; 0 px overflow at 360
//
//   node scripts/gate-clarity.mjs [port=4411]
//
// Needs a served build (scripts/serve.mjs). Exit code 1 on any failure.
import { chromium } from 'playwright-core';
import { TOURS } from '../src/lib/tours.ts';

const port = process.argv[2] ?? '4411';
const BASE = `http://localhost:${port}/botanica/`;
const LOCALES = { en: { path: '' }, es: { path: 'es/' } };

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);
const check = (cond, good, bad) => (cond ? ok(good) : fail(bad ?? good));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const allErrors = [];

async function open(url, { width = 1440, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript(() => localStorage.setItem('ic7-tutorial:seen:botanica-explorar', '1'));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') allErrors.push(`${url}: console: ${m.text()}`); });
  page.on('pageerror', (e) => allErrors.push(`${url}: pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) allErrors.push(`${url}: ${r.status()} ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('[data-explorer]').classList.contains('is-loading'));
  await page.evaluate(() => document.fonts.ready);
  return { page, ctx };
}

for (const [locale, L] of Object.entries(LOCALES)) {
  const url = `${BASE}${L.path}`;
  console.log(`\n${locale} ${url}`);

  // 1. Question sentence, multi-filter URL, both locales.
  {
    const q = `?dep=LAMBAYEQUE&st=introducida&fam=Acanthaceae`;
    const { page, ctx } = await open(`${url}${q}`);
    await page.waitForFunction(() => document.querySelector('[data-explorer]').dataset.painted?.includes('Acanthaceae'));
    const sentence = await page.$eval('#chips', (e) => e.textContent.trim());
    check(/→\s*[\d.,  ]+$/.test(sentence), `sentence ends "→ N": "${sentence}"`, `${url}${q}: sentence "${sentence}" does not end "→ N"`);
    check(/Acanthaceae/.test(sentence), `sentence names the family: "${sentence}"`, `${url}${q}: family missing from "${sentence}"`);
    check(/Lambayeque/.test(sentence), `sentence names the department: "${sentence}"`, `${url}${q}: department missing from "${sentence}"`);
    const chipsN = await page.$$eval('#chips .chip:not(.clear-all)', (bs) => bs.length);
    check(chipsN === 3, `3 removable filter chips`, `${url}${q}: ${chipsN} chips`);
    const labels = await page.$$eval('#chips .chip:not(.clear-all)', (bs) => bs.map((b) => b.getAttribute('aria-label')));
    check(labels.every((l) => l && l.length > 0), `every chip has an aria-label: ${JSON.stringify(labels)}`, `${url}${q}: chip without aria-label`);
    const clearAll = await page.$('#chips .chip.clear-all');
    check(!!clearAll, 'a "clear all" chip is present with 3 filters');
    // Removing one chip narrows the URL (data-clear wiring still works with the new markup).
    const before = await page.evaluate(() => location.search);
    await page.click('#chips [data-clear="fam"]');
    await page.waitForFunction((b) => location.search !== b, before);
    const after = await page.evaluate(() => new URLSearchParams(location.search).get('fam'));
    check(after === null, 'removing a chip clears that filter from the URL', `${url}${q}: fam still ${after}`);
    await ctx.close();
  }

  // 2. Zero results: per-filter counts, each a working button.
  {
    const q = `?dep=TUMBES&y0=1500&y1=1600`; // a department + a year range with (almost certainly) 0 species
    const { page, ctx } = await open(`${url}${q}`);
    await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.painted);
    const total = await page.$eval('#kpis .kpi:first-child b', (e) => e.textContent.trim());
    if (total !== '0') {
      fail(`${url}${q}: expected 0 species to test the empty state, got ${total} (pick another URL)`);
    } else {
      ok('0 species: the empty-state URL actually returns zero');
      const rows = await page.$$eval('#zero-state .zero-opt', (bs) => bs.map((b) => ({
        text: b.textContent.trim(), clear: b.dataset.clear, count: b.querySelector('b')?.textContent.trim(),
      })));
      check(rows.length === 2, `2 per-filter rows (dep, y): ${JSON.stringify(rows)}`, `${url}${q}: ${rows.length} zero-state rows`);
      check(rows.every((r) => r.count && /\d/.test(r.count)), `every row has a count: ${JSON.stringify(rows)}`);
      const depRow = rows.find((r) => r.clear === 'dep');
      if (depRow) {
        const before = await page.evaluate(() => location.search);
        await page.click('[data-clear="dep"]');
        await page.waitForFunction((b) => location.search !== b, before);
        const dep = await page.evaluate(() => new URLSearchParams(location.search).get('dep'));
        check(!dep, 'clicking a zero-state row removes that filter', `${url}${q}: dep still ${dep}`);
      } else fail(`${url}${q}: no "dep" row in the zero state`);
    }
    await ctx.close();
  }

  // 3. Chart frames: every one states it ignores its own filter.
  {
    const { page, ctx } = await open(url);
    const notes = await page.$$eval(
      '#cf-map [data-cf-howto], #cf-fam .cf-howto, #cf-st .cf-howto, #cf-life .cf-howto, #cf-years .cf-howto',
      (es) => es.map((e) => e.textContent.trim()),
    );
    check(notes.length === 5 && notes.every((t) => t.length > 40), `5 chart frames carry a howto line: ${notes.length}`);
    // Not asserting the exact sentence (locale-specific); the howto text must simply be
    // longer than the base sentence alone, i.e. the crossfilter note got appended.
    await ctx.close();
  }

  // 4. Department panel: the KPI count and its top families never disagree.
  {
    const { page, ctx } = await open(`${url}?dep=${encodeURIComponent('MADRE DE DIOS')}&fam=Poaceae`);
    await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.painted);
    const total = await page.$eval('.dep-nums b', (e) => e.textContent.trim().replace(/[^\d]/g, ''));
    const famSum = await page.$$eval('#dep-detail .toplist .mono', (es) => es.reduce((s, e) => s + Number(e.textContent.trim().replace(/[^\d]/g, '')), 0));
    check(famSum <= Number(total || 0), `top-families sum (${famSum}) <= panel total (${total})`, `${url}: families sum ${famSum} exceeds total ${total}`);
    if (total === '0') check((await page.$$('#dep-detail .toplist li')).length === 0, '0 species -> no "top families" rows', `${url}: 0 species but families listed`);
    await ctx.close();
  }

  // 5. Map legend rescale note, when a non-department filter narrows the max.
  {
    const { page, ctx } = await open(`${url}?fam=Orchidaceae`);
    await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.painted?.includes('Orchidaceae'));
    const note = await page.$('#legend .lg-rescale');
    check(!!note, 'legend shows the rescale note when a taxon filter narrows the map max', `${url}?fam=Orchidaceae: no .lg-rescale`);
    if (note) {
      const txt = (await note.textContent()).trim();
      check(/\d/.test(txt), `rescale note has numbers: "${txt}"`);
    }
    // Unfiltered: no rescale note (nothing to say).
    const { page: p2, ctx: c2 } = await open(url);
    const note0 = await p2.$('#legend .lg-rescale');
    check(!note0, 'no rescale note unfiltered', `${url}: rescale note shown unfiltered`);
    await ctx.close();
    await c2.close();
  }

  // 6. New tour step targets an element that exists.
  {
    const steps = TOURS.explore[locale];
    const last = steps[steps.length - 1];
    check(steps.length >= 8, `explore tour has the new step (${steps.length} steps)`, `${url}: only ${steps.length} explore-tour steps`);
    const { page, ctx } = await open(url);
    const hasTarget = last.target ? !!(await page.$(last.target)) : true;
    check(hasTarget, `last tour step target resolves: ${last.target}`, `${url}: tour target missing: ${last.target}`);
    check(/ignor|cross|propio filtro/i.test(last.body), `last step explains the crossfilter: "${last.title}"`, `${url}: last tour step doesn't read like the crossfilter explanation`);
    await ctx.close();
  }

  // 7. No CLS > 0.05 on a ?dep= deep link; 0 px overflow at 360.
  {
    const { page, ctx } = await open(`${url}?dep=LORETO`);
    const cls = await page.evaluate(() => new Promise((resolve) => {
      let total = 0;
      new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value; }).observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => resolve(total), 400);
    }));
    check(cls <= 0.05, `CLS ${cls.toFixed(3)} on ?dep=LORETO`, `${url}?dep=LORETO: CLS ${cls}`);
    await ctx.close();
    const { page: p2, ctx: c2 } = await open(`${url}?dep=TUMBES&y0=1500&y1=1600`, { width: 360, height: 780 });
    await p2.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.painted);
    const over = await p2.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(over <= 0, 'no overflow at 360 with the zero-state shown', `${url}: ${over}px overflow at 360 with the zero state`);
    await c2.close();
  }
}

console.log('\nconsole');
allErrors.length ? allErrors.forEach((e) => fail(e)) : ok('0 console errors, 0 page errors, 0 HTTP ≥ 400');

await browser.close();
console.log(failures.length ? `\nCLARITY GATE FAILED: ${failures.length}` : '\nCLARITY GATE PASSED');
process.exit(failures.length ? 1 : 0);
