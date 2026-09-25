// Explorer gate for v3 (brief items 2, 3, 4, 7, 9), EN and ES:
//   1. one glance at 1440×900: #kpis, #map, #families, #status end above 900 px once
//      #explorar is scrolled to the top (scroll-margin respected), one <h1>
//   2. every chart frame: how-to, legend, a source with a doi.org link (both kingdoms)
//   3. map zoom/pan/click/reset/keys/fullscreen; how-to follows the metric
//   4. ?dep=LORETO: first KPI says GBIF + 5,821 (per locale), the "why" note is there
//   5. drawer (?sp=Cinchona officinalis): photo slot, 4-part taxonomy, IPNI link, growth title
//   6. pre-v3 link ?lf=shrub or tree → lf=shrub
//   7. 0 console errors; 0 px overflow at 360 (strict viewport) with and without the
//      drawer; new controls ≥ 44 px under touch emulation
//
//   node scripts/gate-explorer.mjs [port=4430]
//
// Needs a served build (scripts/serve.mjs). Exit code 1 on any failure.
import { chromium } from 'playwright-core';

const port = process.argv[2] ?? '4430';
const BASE = `http://localhost:${port}/botanica/`;
const LOCALES = { en: { path: '', loreto: '5,821' }, es: { path: 'es/', loreto: '5 821' } };

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);
const check = (cond, good, bad) => (cond ? ok(good) : fail(bad ?? good));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const allErrors = [];

async function open(url, { width = 1440, height = 900, touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
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
const scale = (page) => page.$eval('#map-zoom', (e) => new DOMMatrix(getComputedStyle(e).transform === 'none' ? '' : getComputedStyle(e).transform).a);
const translate = (page) => page.$eval('#map-zoom', (e) => { const m = new DOMMatrix(getComputedStyle(e).transform === 'none' ? '' : getComputedStyle(e).transform); return [m.e, m.f]; });

for (const [locale, L] of Object.entries(LOCALES)) {
  const url = `${BASE}${L.path}`;
  console.log(`\n${locale} ${url}`);

  // 1. One glance.
  {
    const { page, ctx } = await open(url);
    await page.evaluate(() => document.querySelector('#explorar').scrollIntoView());
    await page.waitForTimeout(200);
    const m = await page.evaluate(() => {
      const hdr = document.querySelector('header.site').getBoundingClientRect().bottom;
      const out = { hdr, ih: innerHeight, top: document.querySelector('#explorar').getBoundingClientRect().top, h1: document.querySelectorAll('h1').length };
      for (const s of ['#kpis', '#map', '#families', '#status']) {
        const r = document.querySelector(s).getBoundingClientRect();
        out[s] = [Math.round(r.top), Math.round(r.bottom)];
      }
      return out;
    });
    check(Math.abs(m.top - m.hdr) <= 1, `#explorar lands under the sticky header (top ${Math.round(m.top)}, header ${Math.round(m.hdr)})`);
    for (const s of ['#kpis', '#map', '#families', '#status']) {
      const [top, bottom] = m[s];
      check(top >= m.hdr && bottom <= m.ih, `${s} in view at 1440×900: ${top}–${bottom}`, `${url}: ${s} not in one glance: ${top}–${bottom} (viewport ${m.ih})`);
    }
    check(m.h1 === 1, 'exactly one <h1>', `${url}: ${m.h1} <h1>`);

    // 2. Chart frames, per kingdom.
    for (const k of ['plantae', 'fungi']) {
      if (k === 'fungi') {
        await page.click('.ex-controls [data-k="fungi"]');
        await page.waitForFunction(() => document.querySelector('[data-explorer]').dataset.k === 'fungi');
      }
      const frames = await page.$$eval('#explorar .cf', (fs) => fs.map((f) => {
        const vis = (e) => !!e && e.getClientRects().length > 0;
        const src = [...f.querySelectorAll('.cf-source')].filter(vis);
        return {
          id: f.id,
          howto: f.querySelector('.cf-howto [data-cf-howto]')?.textContent.trim() ?? '',
          legend: f.querySelector('.cf-legend')?.textContent.trim() ?? '',
          sources: src.length,
          doi: src.some((s) => [...s.querySelectorAll('a')].some((a) => a.href.startsWith('https://doi.org/'))),
        };
      }));
      const bad = frames.filter((f) => !f.howto || !f.legend || f.sources !== 1 || !f.doi);
      check(frames.length >= 6 && !bad.length, `${k}: ${frames.length} frames with how-to, legend and one DOI source line`,
        `${url} ${k}: frames incomplete: ${JSON.stringify(bad)}`);
    }
    await ctx.close();
  }

  // 3. Map zoom / pan / tap / reset / keys / fullscreen, and the metric-aware how-to.
  {
    const { page, ctx } = await open(url);
    await page.evaluate(() => document.querySelector('#explorar').scrollIntoView());
    const how0 = await page.textContent('#cf-map [data-cf-howto]');
    await page.click('[data-m="records"]');
    await page.waitForFunction(() => location.search.includes('m=records'));
    const how1 = await page.textContent('#cf-map [data-cf-howto]');
    check(how1 !== how0, 'map how-to follows the metric', `${url}: map how-to did not change with the metric`);
    await page.click('[data-m="species"]');

    await page.click('[data-zoom="in"]');
    await page.click('[data-zoom="in"]');
    const k1 = await scale(page);
    check(k1 > 1, `zoom in → scale ${k1.toFixed(2)}`, `${url}: zoom in left scale ${k1}`);
    const vp = await page.$eval('#map-vp', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const t0 = await translate(page);
    const search0 = await page.evaluate(() => location.search);
    await page.mouse.move(vp.x + vp.w / 2, vp.y + vp.h / 2);
    await page.mouse.down();
    await page.mouse.move(vp.x + vp.w / 2 + 40, vp.y + vp.h / 2 + 30, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const t1 = await translate(page);
    check(t1[0] !== t0[0] || t1[1] !== t0[1], `drag pans (${t0.map(Math.round)} → ${t1.map(Math.round)})`, `${url}: drag did not pan`);
    check((await page.evaluate(() => location.search)) === search0, 'a drag does not select a department', `${url}: drag changed the URL`);
    // A tap without movement on a department that is in view selects it.
    const target = await page.evaluate(() => {
      const v = document.querySelector('#map-vp').getBoundingClientRect();
      for (const p of document.querySelectorAll('#map path[data-dep]')) {
        const r = p.getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        if (cx > v.left + 10 && cx < v.right - 10 && cy > v.top + 10 && cy < v.bottom - 10 && document.elementFromPoint(cx, cy) === p) return { dep: p.dataset.dep, cx, cy };
      }
      return null;
    });
    if (!target) fail(`${url}: no department in view while zoomed`);
    else {
      await page.mouse.click(target.cx, target.cy);
      await page.waitForFunction((d) => new URLSearchParams(location.search).get('dep') === d, target.dep, { timeout: 3000 })
        .then(() => ok(`tap while zoomed selects ${target.dep}`), () => fail(`${url}: tap while zoomed did not select ${target.dep}`));
    }
    await page.click('[data-zoom="reset"]');
    check((await scale(page)) === 1, 'reset → scale 1', `${url}: reset did not restore scale 1`);
    await page.focus('#map path[tabindex="0"]');
    await page.keyboard.press('+');
    const kk = await scale(page);
    await page.keyboard.press('0');
    check(kk > 1 && (await scale(page)) === 1, 'keys + and 0 zoom and reset with focus in the map', `${url}: keyboard zoom failed (${kk})`);
    // Stroke width on screen = computed width × CSS scale: the same at scale 1 and zoomed.
    const onScreen = async () => (await page.$eval('#map path[data-dep]:not(.sel)', (p) => parseFloat(getComputedStyle(p).strokeWidth))) * (await scale(page));
    const w1 = await onScreen();
    await page.click('[data-zoom="in"]');
    await page.click('[data-zoom="in"]');
    await page.click('[data-zoom="in"]');
    const w3 = await onScreen();
    await page.click('[data-zoom="reset"]');
    check(Math.abs(w1 - w3) < 0.05, `department strokes stay ${w1.toFixed(2)} px when zoomed (${w3.toFixed(2)} px at ${(await page.$eval('#map-vp', (e) => e.style.getPropertyValue('--z'))) || 1}x after reset)`, `${url}: stroke ${w1} px at 1x, ${w3} px zoomed`);
    // Fullscreen.
    const fsVisible = await page.$eval('#map-fs', (b) => !b.hidden);
    if (fsVisible) {
      await page.click('#map-fs');
      await page.waitForFunction(() => document.fullscreenElement?.id === 'cf-map', null, { timeout: 3000 })
        .then(() => ok('fullscreen on the map frame'), () => fail(`${url}: fullscreen did not start`));
      const lab = await page.getAttribute('#map-fs', 'aria-label');
      await page.click('#map-fs');
      await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3000 })
        .then(() => ok(`fullscreen exits (label while on: "${lab}")`), () => fail(`${url}: fullscreen did not exit`));
    } else fail(`${url}: fullscreen button hidden (Fullscreen API unavailable?)`);
    await ctx.close();
  }

  // 4. Department label and the "why" note.
  {
    const { page, ctx } = await open(`${url}?dep=LORETO`);
    const kpi = await page.$eval('#kpis .kpi:first-child', (e) => ({ v: e.querySelector('b').textContent, l: e.querySelector('span').textContent }));
    check(kpi.l.includes('GBIF') && kpi.l.includes('Loreto'), `first KPI label: "${kpi.l}"`, `${url}: KPI label "${kpi.l}"`);
    check(kpi.v === L.loreto, `Loreto = ${kpi.v}`, `${url}: Loreto KPI is ${JSON.stringify(kpi.v)}, expected ${JSON.stringify(L.loreto)}`);
    const why = await page.$eval('#dep-why', (d) => !d.hidden && d.querySelector('a[href*="AUDIT-v2.md"]') !== null);
    check(why, 'the "why fewer" note is shown and links AUDIT-v2', `${url}: why note missing`);
    await page.goto(`${url}?dep=LORETO,CUSCO`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('[data-explorer]').classList.contains('is-stale'));
    const two = await page.$eval('#kpis .kpi:first-child span', (e) => e.textContent);
    check(/Loreto (or|o) Cusco/.test(two), `two departments: "${two}"`, `${url}: two-department label "${two}"`);
    await ctx.close();
  }

  // 5. Drawer.
  {
    const { page, ctx } = await open(`${url}?sp=Cinchona+officinalis`);
    await page.waitForSelector('#drawer:not([hidden])');
    check(!!(await page.$('#drawer [data-photo-slot]')), 'photo slot present');
    const crumbs = await page.$$eval('#drawer .dr-crumbs li', (l) => l.map((x) => x.textContent.trim()));
    check(crumbs.length === 4, `taxonomy: ${crumbs.join(' › ')}`, `${url}: breadcrumb has ${crumbs.length} parts`);
    const href = await page.waitForSelector('#drawer a.dr-ipni', { timeout: 5000 }).then((a) => a.getAttribute('href'), () => null);
    check(href === 'https://www.ipni.org/n/58723-2', `IPNI link ${href}`, `${url}: IPNI link ${href}`);
    const lf = await page.$eval('#drawer .dr-lf', (e) => e.getAttribute('title')).catch(() => null);
    check(!!lf, `growth form title: "${lf}"`, `${url}: growth-form label without title`);
    await ctx.close();
  }

  // 6. Pre-v3 growth-form link.
  {
    const { page, ctx } = await open(`${url}?lf=shrub%20or%20tree`);
    await page.waitForFunction(() => new URLSearchParams(location.search).get('lf') === 'shrub', null, { timeout: 3000 })
      .then(() => ok('?lf=shrub or tree → lf=shrub'), async () => fail(`${url}: old lf link stayed ${await page.evaluate(() => location.search)}`));
    await ctx.close();
  }

  // 7. 360 px: overflow with and without the drawer, touch targets.
  {
    const { page, ctx } = await open(url, { width: 360, height: 780 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(over <= 0, 'no overflow at 360', `${url}: ${over}px overflow at 360`);
    await page.evaluate(() => document.querySelector('#explorar').scrollIntoView());
    const land = await page.evaluate(() => [document.querySelector('#explorar').getBoundingClientRect().top, document.querySelector('header.site').getBoundingClientRect().bottom]);
    check(Math.abs(land[0] - land[1]) <= 1, `#explorar lands under the header at 360 (${land.map(Math.round).join(' / ')})`, `${url}: at 360 #explorar top ${land[0]} vs header ${land[1]}`);
    await page.goto(`${url}?sp=Cinchona+officinalis&dep=LORETO`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#drawer:not([hidden])');
    await page.waitForSelector('#drawer a.dr-ipni', { timeout: 5000 }).catch(() => {});
    const over2 = await page.evaluate(() => Math.max(document.documentElement.scrollWidth - innerWidth, document.querySelector('#drawer').scrollWidth - document.querySelector('#drawer').clientWidth));
    check(over2 <= 0, 'no overflow at 360 with the drawer open', `${url}: ${over2}px overflow at 360 with the drawer`);
    await ctx.close();
    const t = await open(`${url}?sp=Cinchona+officinalis&dep=LORETO`, { width: 360, height: 780, touch: true });
    await t.page.waitForSelector('#drawer a.dr-ipni', { timeout: 5000 }).catch(() => {});
    const small = await t.page.evaluate(() =>
      [...document.querySelectorAll('[data-zoom], #map-fs, #dep-why summary, #dr-close, #drawer .dr-ipni, #drawer .dr-actions button, .ex-controls button, .metric button')]
        .filter((b) => b.getClientRects().length)
        .map((b) => [Math.round(b.getBoundingClientRect().height), b.getAttribute('aria-label') || b.textContent.trim().slice(0, 24)])
        .filter(([h]) => h < 44));
    check(!small.length, 'new controls ≥ 44 px under touch', `${url}: touch targets < 44 px: ${JSON.stringify(small)}`);
    await t.ctx.close();
  }
}

console.log('\nconsole');
allErrors.length ? allErrors.forEach((e) => fail(e)) : ok('0 console errors, 0 page errors, 0 HTTP ≥ 400');

await browser.close();
console.log(failures.length ? `\nEXPLORER GATE FAILED: ${failures.length}` : '\nEXPLORER GATE PASSED');
process.exit(failures.length ? 1 : 0);
