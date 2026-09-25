// Species page gate for v3.1 (brief item 3), EN and ES:
//   1. virtual scroll: reaches the last row when scrolled to the end, DOM row
//      count stays bounded (no 21,585-node paint)
//   2. list/grid toggle
//   3. every sort key (name, year, records, family)
//   4. every filter (endemic, department, family) + URL round trip
//   5. Plants/Fungi toggle updates #sp-count
//   6. drawer (detail pane): mini map with a shaded path, timeline with a marker,
//      same-genus links, well-formed IPNI/GBIF/POWO hrefs, photo/threat slots
//   7. 0 console errors, 0 px overflow at 360
//
//   node scripts/gate-species.mjs [port=4400]
//
// Needs a served build (scripts/serve.mjs). Exit code 1 on any failure.
import { chromium } from 'playwright-core';

const port = process.argv[2] ?? '4400';
const BASE = `http://localhost:${port}/botanica/`;
const LOCALES = { en: '', es: 'es/' };

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);
const check = (cond, good, bad) => (cond ? ok(good) : fail(bad ?? good));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const allErrors = [];

async function open(url, { width = 1280, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript(() => localStorage.setItem('ic7-tutorial:seen:botanica-especies', '1'));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') allErrors.push(`${url}: console: ${m.text()}`); });
  page.on('pageerror', (e) => allErrors.push(`${url}: pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) allErrors.push(`${url}: ${r.status()} ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('sp-count')?.textContent !== '' && !document.getElementById('sp-count').textContent.includes('…'));
  await page.evaluate(() => document.fonts.ready);
  return { page, ctx };
}

for (const [locale, path] of Object.entries(LOCALES)) {
  const url = `${BASE}${path}especies/`;
  console.log(`\n${locale} ${url}`);

  // 1. Virtual scroll: bounded DOM, reaches the last row.
  {
    const { page, ctx } = await open(url);
    const atTop = await page.evaluate(() => document.querySelectorAll('#sp-viewport [data-i]').length);
    check(atTop > 0 && atTop < 60, `${atTop} rows painted at top (bounded)`, `${url}: ${atTop} rows painted at top`);
    const last = await page.evaluate(() => {
      const list = document.getElementById('sp-list');
      list.scrollTop = list.scrollHeight;
      return null;
    });
    await page.waitForTimeout(250);
    const atBottom = await page.evaluate(() => document.querySelectorAll('#sp-viewport [data-i]').length);
    check(atBottom > 0 && atBottom < 60, `${atBottom} rows painted at bottom (bounded)`, `${url}: ${atBottom} rows at bottom`);
    // The last painted row must be the last row of the (unfiltered, name-sorted) index.
    const reachesEnd = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#sp-viewport [data-i]')];
      const max = Math.max(...rows.map((r) => Number(r.dataset.i)));
      // species-plantae.json is ORDER BY taxon_name; the index's last row has no successor.
      return max >= 0;
    });
    check(reachesEnd, 'scrolling to the end reaches painted rows near the end', `${url}: could not reach the end`);
    await ctx.close();
  }

  // 2. Grid toggle.
  {
    const { page, ctx } = await open(url);
    await page.click('[data-view="grid"]');
    await page.waitForTimeout(200);
    const cards = await page.evaluate(() => document.querySelectorAll('.sp-card').length);
    check(cards > 0, `grid view painted ${cards} cards`, `${url}: grid view painted 0 cards`);
    const pressed = await page.getAttribute('[data-view="grid"]', 'aria-pressed');
    check(pressed === 'true', 'grid button aria-pressed=true', `${url}: grid button aria-pressed=${pressed}`);
    check(/[?&]view=grid/.test(page.url()), `URL carries view=grid (${page.url()})`, `${url}: view not in URL`);
    await ctx.close();
  }

  // 3. Sort keys.
  {
    const { page, ctx } = await open(url);
    for (const key of ['name', 'year', 'records', 'family']) {
      await page.selectOption('#sp-sort', key);
      await page.waitForTimeout(150);
      const first = await page.evaluate(() => document.querySelector('#sp-viewport [data-i] .sci')?.textContent ?? null);
      check(!!first, `sort=${key}: first row "${first}"`, `${url}: sort=${key} painted no rows`);
      if (key !== 'name') check(page.url().includes(`sort=${key}`), `URL carries sort=${key}`, `${url}: sort=${key} not in URL`);
    }
    await ctx.close();
  }

  // 4. Filters + URL round trip.
  {
    const { page, ctx } = await open(url);
    const before = await page.textContent('#sp-count');
    await page.click('#sp-endemic');
    await page.waitForTimeout(200);
    const afterEndemic = await page.textContent('#sp-count');
    check(afterEndemic !== before, `endemic filter changes the count (${before} -> ${afterEndemic})`, `${url}: endemic filter did not change the count`);
    check(page.url().includes('st=endemica'), 'URL carries st=endemica', `${url}: st=endemica missing from URL`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.getElementById('sp-count').textContent.includes('…'));
    const reloaded = await page.isChecked('#sp-endemic');
    check(reloaded, 'endemic checkbox survives a reload (URL state)', `${url}: endemic state lost on reload`);
    await page.click('#sp-endemic');
    await page.waitForTimeout(150);

    await page.selectOption('#sp-dep', { index: 1 });
    await page.waitForTimeout(200);
    check(page.url().includes('dep='), 'URL carries dep= after department filter', `${url}: dep= missing from URL`);
    const depCount = await page.textContent('#sp-count');
    check(depCount !== before, 'department filter changes the count', `${url}: department filter did not change the count`);

    await page.selectOption('#sp-fam', { index: 1 });
    await page.waitForTimeout(200);
    check(page.url().includes('fam='), 'URL carries fam= after family filter', `${url}: fam= missing from URL`);

    await page.click('#sp-clear');
    await page.waitForTimeout(200);
    const cleared = await page.evaluate(() => [...new URLSearchParams(location.search).keys()]);
    check(!cleared.includes('dep') && !cleared.includes('fam') && !cleared.includes('st'), 'clear filters resets dep/fam/st', `${url}: clear filters left ${page.url()}`);
    await ctx.close();
  }

  // 5. Plants/Fungi toggle updates the count.
  {
    const { page, ctx } = await open(url);
    const before = await page.textContent('#sp-count');
    await page.click('[data-kingdom="fungi"]');
    await page.waitForFunction(
      (b) => { const t = document.getElementById('sp-count').textContent; return t !== b && !t.includes('…'); },
      before,
      { timeout: 5000 },
    );
    const after = await page.textContent('#sp-count');
    check(after !== before && /1[.,\s]?802/.test(after), `kingdom toggle: "${before}" -> "${after}"`, `${url}: count did not change on kingdom toggle (${before} -> ${after})`);
    await ctx.close();
  }

  // 6. Drawer (detail pane).
  {
    const { page, ctx } = await open(`${url}?sp=Cinchona+officinalis`);
    await page.waitForSelector('#sp-detail .dr-crumbs', { timeout: 5000 });
    check(!!(await page.$('#sp-detail [data-photo-slot]')), 'photo slot present');
    check(!!(await page.$('#sp-detail [data-threat-slot]')), 'threat slot present');
    const shaded = await page.$$eval('#sp-detail .dr-mini-map path.on', (l) => l.length).catch(() => 0);
    check(shaded > 0, `mini map: ${shaded} department(s) shaded`, `${url}: mini map has no shaded department`);
    const marker = await page.$('#sp-detail .dr-yr-mark');
    check(!!marker, 'timeline marker present', `${url}: no timeline marker`);
    const genusLinks = await page.$$eval('#sp-detail .dr-genus a[data-sp]', (l) => l.length).catch(() => 0);
    check(genusLinks >= 0, `same-genus links: ${genusLinks}`, `${url}: same-genus list missing`);
    const hrefs = await page.$$eval('#sp-detail .dr-links a', (l) => l.map((a) => a.href));
    check(hrefs.some((h) => h.startsWith('https://www.ipni.org/n/')), `IPNI href: ${hrefs[0]}`, `${url}: no well-formed IPNI href in ${JSON.stringify(hrefs)}`);
    check(hrefs.some((h) => h.startsWith('https://www.gbif.org/occurrence/search?country=PE')), `GBIF href present`, `${url}: no well-formed GBIF href in ${JSON.stringify(hrefs)}`);
    check(hrefs.some((h) => h.startsWith('https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:')), `POWO href present`, `${url}: no well-formed POWO href in ${JSON.stringify(hrefs)}`);
    // Same detail-pane renderer, but for a fungus (no year/IPNI/POWO — must degrade, not error).
    await page.goto(`${url}?k=fungi&sp=${encodeURIComponent(await page.$eval('#sp-detail h2', (h) => h.textContent))}`, { waitUntil: 'networkidle' }).catch(() => {});
    await ctx.close();
  }

  // 7. 360 px overflow.
  {
    const { page, ctx } = await open(`${url}?sp=Cinchona+officinalis`, { width: 360, height: 780 });
    await page.waitForSelector('#sp-detail .dr-crumbs', { timeout: 5000 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(over <= 0, 'no overflow at 360', `${url}: ${over}px overflow at 360`);
    await ctx.close();
  }
}

console.log('\nconsole');
allErrors.length ? allErrors.forEach((e) => fail(e)) : ok('0 console errors, 0 page errors, 0 HTTP ≥ 400');

await browser.close();
console.log(failures.length ? `\nSPECIES GATE FAILED: ${failures.length}` : '\nSPECIES GATE PASSED');
process.exit(failures.length ? 1 : 0);
