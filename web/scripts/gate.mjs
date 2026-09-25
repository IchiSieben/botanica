// Commit gate (Playwright): for every page and locale
//   - zero console errors, page errors and failed requests
//   - no horizontal overflow at 360 px
//   - every guided-tour step target resolves
// and on the explorer and the tree, interactions that must change OTHER views.
//
//   node --experimental-strip-types scripts/gate.mjs [port=4400]
//
// Needs a served build (scripts/serve.mjs). Exit code 1 on any failure.
import { chromium } from 'playwright-core';
import { TOURS } from '../src/lib/tours.ts';

const port = process.argv[2] ?? '4400';
const BASE = `http://localhost:${port}/botanica/`;
const LOCALES = (process.env.LOCALES ?? 'en,es').split(',');
// The unprefixed locale (EN once i18n lands; ES before it).
const ROOT_LOCALE = process.env.ROOT_LOCALE ?? 'en';
const prefix = (l) => (l === ROOT_LOCALE ? '' : `${l}/`);
const PAGES = [
  { id: 'explore', path: '' },
  { id: 'species', path: 'especies/' },
  { id: 'tree', path: 'filogenia/' },
];

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function open(url, width = 1280, touch = false) {
  // Overflow is measured WITHOUT mobile emulation: with it, Chrome widens the
  // layout viewport to fit the content and hides the overflow. Touch targets
  // are measured WITH it, so (pointer: coarse) styles apply as on a phone.
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 780 : 900 }, isMobile: touch, hasTouch: touch });
  // The tours open on a first visit and cover the page; the gate checks their
  // targets separately, so mark them seen before any script runs.
  await ctx.addInitScript(() => {
    for (const id of ['botanica-explorar', 'botanica-especies', 'botanica-filogenia']) localStorage.setItem(`ic7-tutorial:seen:${id}`, '1');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  return { page, ctx, errors };
}

for (const locale of LOCALES) {
  for (const p of PAGES) {
    const url = `${BASE}${prefix(locale)}${p.path}`;
    console.log(`\n${locale} ${url}`);
    // Desktop: errors + tour targets.
    {
      const { page, ctx, errors } = await open(url);
      const lang = await page.getAttribute('html', 'lang');
      lang === locale ? ok(`lang=${lang}`) : fail(`${url}: html lang=${lang}, expected ${locale}`);
      for (const step of TOURS[p.id][locale]) {
        if (!step.target) continue;
        (await page.$(step.target)) ? null : fail(`${url}: tour target missing: ${step.target}`);
      }
      ok(`tour targets checked (${TOURS[p.id][locale].filter((s) => s.target).length})`);
      if (p.id === 'explore') await exploreChecks(page, url);
      if (p.id === 'species') await speciesChecks(page, url);
      // The tree joins the shared state in Phase 2; until then TREE=0 skips it.
      if (p.id === 'tree' && process.env.TREE !== '0') await treeChecks(page, url);
      errors.length ? errors.forEach((e) => fail(`${url}: ${e}`)) : ok('no console errors');
      await ctx.close();
    }
    // Phone: overflow at 360 px, also with the drawer open on the explorer.
    {
      const { page, ctx, errors } = await open(url, 360);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      over > 0 ? fail(`${url}: ${over}px horizontal overflow at 360`) : ok('no overflow at 360');
      if (p.id === 'explore') {
        await page.goto(`${url}?sp=Cinchona%20officinalis&dep=CUSCO,PUNO`, { waitUntil: 'networkidle' });
        await page.waitForSelector('#drawer:not([hidden])', { timeout: 5000 }).catch(() => fail(`${url}: drawer did not open from ?sp=`));
        const over2 = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        over2 > 0 ? fail(`${url}: ${over2}px overflow at 360 with drawer + comparison`) : ok('no overflow at 360 with drawer + comparison');
        const tctx = await open(page.url(), 360, true);
        await tctx.page.waitForSelector('#drawer:not([hidden])', { timeout: 5000 }).catch(() => {});
        const small = await tctx.page.evaluate(() =>
          [...document.querySelectorAll('.ex-grid button, .chips button, .ex-controls button')]
            .filter((b) => b.offsetParent && !b.closest('.cols'))
            .map((b) => [b.getBoundingClientRect().height, b.textContent.trim().slice(0, 24)])
            .filter(([h]) => h < 44));
        small.length ? fail(`${url}: ${small.length} touch targets < 44px, e.g. ${JSON.stringify(small.slice(0, 3))}`) : ok('touch targets ≥ 44px');
        tctx.errors.forEach((e) => fail(`${url} @touch: ${e}`));
        await tctx.ctx.close();
      }
      errors.length ? errors.forEach((e) => fail(`${url} @360: ${e}`)) : ok('no console errors @360');
      await ctx.close();
    }
  }
}

async function text(page, sel) {
  return page.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim());
}

async function exploreChecks(page, url) {
  await page.waitForFunction(() => !document.querySelector('[data-explorer]').classList.contains('is-loading'));
  const kpi0 = await text(page, '#kpis');
  const fam0 = await text(page, '#families');
  const years0 = await page.$eval('#years', (el) => el.innerHTML);

  // 1. Map -> every other view.
  await page.click('#map path[data-dep="LORETO"]');
  await page.waitForFunction(() => location.search.includes('dep=LORETO') && (document.querySelector('[data-explorer]')?.dataset.painted ?? location.search) === location.search);
  const kpi1 = await text(page, '#kpis');
  const fam1 = await text(page, '#families');
  const years1 = await page.$eval('#years', (el) => el.innerHTML);
  kpi1 !== kpi0 ? ok('map click changed KPIs') : fail(`${url}: map click did not change KPIs`);
  fam1 !== fam0 ? ok('map click changed families') : fail(`${url}: map click did not change families`);
  years1 !== years0 ? ok('map click changed years') : fail(`${url}: map click did not change years`);

  // 2. Family -> map.
  const map1 = await page.$$eval('#map path', (ps) => ps.map((p) => p.getAttribute('class')).join());
  await page.click('#families [data-fam]');
  await page.waitForFunction(() => location.search.includes('fam=') && (document.querySelector('[data-explorer]')?.dataset.painted ?? location.search) === location.search);
  const map2 = await page.$$eval('#map path', (ps) => ps.map((p) => p.getAttribute('class')).join());
  map2 !== map1 ? ok('family click changed the map') : fail(`${url}: family click did not change the map`);

  // 3. Back undoes the family.
  await page.goBack();
  await page.waitForFunction(() => !location.search.includes('fam=') && (document.querySelector('[data-explorer]')?.dataset.painted ?? location.search) === location.search);
  ok('Back undid the family filter');

  // 4. Search -> drawer -> map in species mode.
  await page.click('#q');
  await page.fill('#q', 'cinchona offic');
  await page.waitForSelector('#q-list [role=option]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#drawer:not([hidden])');
  const species = await page.evaluate(() => document.querySelector('[data-explorer]').classList.contains('map-species'));
  species ? ok('search opened the drawer and the map follows the species') : fail(`${url}: map not in species mode after search`);
  await page.keyboard.press('Escape');
  await page.waitForSelector('#drawer', { state: 'hidden' });
  ok('Escape closed the drawer');

  // A hit in the other kingdom switches kingdom AND opens that species.
  await page.click('#q');
  await page.fill('#q', 'abortiporus bien');
  await page.waitForSelector('#q-list [role=option]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#drawer:not([hidden])');
  const cross = await page.evaluate(() => location.search);
  /k=fungi/.test(cross) && /sp=Abortiporus/.test(cross) ? ok('cross-kingdom search keeps the species') : fail(`${url}: cross-kingdom search lost the species (${cross})`);
  await page.keyboard.press('Escape');
  await page.goBack();
  await page.goBack();
  await page.waitForFunction(() => !location.search.includes('k=fungi') && (document.querySelector('[data-explorer]')?.dataset.painted ?? location.search) === location.search);

  // 5. Years brush -> map.
  const map3 = await page.$$eval('#map path', (ps) => ps.map((p) => p.getAttribute('class')).join());
  await page.click('#years [data-decade="2000"]');
  await page.waitForFunction(() => location.search.includes('y0=2000') && (document.querySelector('[data-explorer]')?.dataset.painted ?? location.search) === location.search);
  const map4 = await page.$$eval('#map path', (ps) => ps.map((p) => p.getAttribute('class')).join());
  map4 !== map3 ? ok('decade click changed the map') : fail(`${url}: decade click did not change the map`);

  // 6. Kingdom toggle -> fungi, lifeform and origin say "not available".
  await page.click('[data-k="fungi"]');
  await page.waitForFunction(() => document.querySelector('[data-explorer]').dataset.k === 'fungi');
  (await page.$('#lifeforms .na')) && (await page.$('#status .na'))
    ? ok('fungi shows explicit not-available states')
    : fail(`${url}: fungi views not marked unavailable`);
}

async function speciesChecks(page, url) {
  await page.waitForSelector('#sp-list [data-i]');
  await page.fill('#sp-q', 'Cinchona');
  // v3.1: virtual scroll always paints ~20-25 rows regardless of filter state
  // (no more 200-row cap to shrink below), so wait for the filtered text itself.
  await page.waitForFunction(() => document.querySelector('#sp-list [data-i] .sci')?.textContent.includes('Cinchona'));
  await page.click('#sp-list [data-i]');
  await page.waitForFunction(() => location.search.includes('sp=') && (document.querySelector('[data-explorer]')?.dataset.painted ?? location.search) === location.search);
  const href = await page.getAttribute('#sp-detail a.btn', 'href');
  href && href.includes('sp=Cinchona') ? ok('species pick -> URL and "show on map" link') : fail(`${url}: show-on-map link wrong: ${href}`);
}

async function treeChecks(page, url) {
  const side = '#phylo-plantae-side';
  await page.waitForSelector('#phylo-plantae-chart canvas');
  const before = await text(page, side);
  // Click the first order via the accessible list the tree page renders.
  await page.click('#phylo-plantae [data-ord]');
  await page.waitForFunction(() => location.search.includes('ord=') && (document.querySelector('[data-explorer]')?.dataset.painted ?? location.search) === location.search);
  const after = await text(page, side);
  after !== before ? ok('tree selection changed the department view') : fail(`${url}: tree selection did not change the department view`);
}

if (LOCALES.includes('en') && LOCALES.includes('es')) await langChecks();
await inpChecks();

// INP budget (< 200 ms) with the CPU slowed 4x, as Lighthouse's mobile profile does.
// Event Timing entries give each interaction's full duration: input delay +
// handlers + the frame that shows the result.
async function inpChecks() {
  console.log('\nINP (4x CPU)');
  const measure = async (path, act, label) => {
    const { page, ctx } = await open(`${BASE}${prefix(ROOT_LOCALE)}${path}`, 390, true);
    const cdp = await ctx.newCDPSession(page);
    await page.evaluate(() => {
      window.__inp = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__inp = Math.max(window.__inp, e.duration); })
        .observe({ type: 'event', durationThreshold: 16, buffered: true });
    });
    await page.waitForTimeout(1500); // data after load + idle
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await act(page);
    await page.waitForTimeout(800);
    const inp = await page.evaluate(() => window.__inp);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    inp < 200 ? ok(`${label}: ${Math.round(inp)} ms`) : fail(`${label}: INP ${Math.round(inp)} ms ≥ 200`);
    await ctx.close();
  };
  await measure('', (p) => p.tap('#map path[data-dep="CUSCO"]'), 'map tap');
  await measure('', (p) => p.tap('#families [data-fam]'), 'family tap');
  await measure('', async (p) => { await p.tap('#q'); await p.waitForTimeout(1200); await p.keyboard.type('cin', { delay: 120 }); }, 'search keystrokes');
  await measure('?dep=LORETO', (p) => p.tap('#years [data-decade="1800"]'), 'decade tap');
  if (process.env.TREE !== '0') await measure('filogenia/', async (p) => { await p.waitForSelector('#phylo-plantae-chart canvas'); await p.tap('#phylo-plantae [data-ord]'); }, 'tree order tap');
  await measure('especies/', async (p) => { await p.tap('#sp-q'); await p.keyboard.type('cin', { delay: 120 }); }, 'species keystrokes');
}

async function langChecks() {
  console.log('\nlanguage');
  const path = () => page.evaluate(() => location.pathname + location.search + location.hash);
  const want = (got, exp, msg) => (got === exp ? ok(msg) : fail(`${msg}: got ${got}, expected ${exp}`));
  // ?lang= wins, is remembered, and the query and hash survive.
  let { page, ctx } = await open(`${BASE}especies/?k=fungi&lang=es#x`);
  await page.waitForURL((u) => u.pathname.includes('/es/'));
  want(await path(), '/botanica/es/especies/?k=fungi#x', '?lang=es redirects, keeps query and hash');
  await page.goto(`${BASE}?dep=CUSCO`, { waitUntil: 'networkidle' });
  want(await path(), '/botanica/es/?dep=CUSCO', 'stored choice sends / to /es/');
  // The switch writes the choice and carries the filters; reloading does not bounce.
  await page.click('#lang-switch');
  await page.waitForURL((u) => !u.pathname.includes('/es/'));
  want(await path(), '/botanica/?dep=CUSCO', 'switch goes to EN with the filters');
  await page.reload({ waitUntil: 'networkidle' });
  want(await page.evaluate(() => document.documentElement.lang), 'en', 'EN sticks after reload');
  await ctx.close();
  // No stored choice: the browser language decides, only on unprefixed pages.
  const es = await browser.newContext({ locale: 'es-PE' });
  page = await es.newPage();
  await page.goto(`${BASE}filogenia/`, { waitUntil: 'networkidle' });
  want(await path(), '/botanica/es/filogenia/', 'es-PE browser lands on /es/');
  await es.close();
  const en = await browser.newContext({ locale: 'en-US' });
  page = await en.newPage();
  await page.goto(`${BASE}es/filogenia/`, { waitUntil: 'networkidle' });
  want(await path(), '/botanica/es/filogenia/', '/es/ never redirects on its own');
  await en.close();
}

await browser.close();
console.log(failures.length ? `\nGATE FAILED: ${failures.length}` : '\nGATE PASSED');
process.exit(failures.length ? 1 : 0);
