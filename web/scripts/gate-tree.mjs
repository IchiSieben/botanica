// Tree gate (Playwright), v3 item 6. For plants and fungi, EN and ES, at 1280 and 360 px:
//   - a list click puts `ord=` in the URL and, within 3 s, `data-focus` on the chart
//     equals that order, with the drawn node inside the chart's box
//   - a family chip moves the focus to the family; Back returns it to the order
//   - a URL with `?ord=` or only `?fam=` lands focused; Back clears `data-focus`
//   - zoom in / out change the series zoom AND move what is drawn; Reset goes back to 1
//   - expand all / collapse all change the number of visible nodes
//   - full screen toggles document.fullscreenElement and back (button label follows)
//   - a tool button works from the keyboard
//   - 0 console errors, 0 px horizontal overflow at 360 (strict viewport)
// Plus: tool buttons ≥ 44 px under touch emulation, and INP of an order-list tap at 4x CPU.
//
//   node --experimental-strip-types scripts/gate-tree.mjs [port=4410]
//
// Reads the chart through window.__phylo (scripts/tree.ts): the drawn symbol's
// global transform, the series zoom, and the visible node count. window.__phylo
// only exists when the site is built with PUBLIC_TEST_HOOKS=1 (scripts/build-test.mjs
// -> dist-test/), so this gate must run against that build (`npm run serve:test`
// on port 4401, see package.json's `gate:v3`), never against the production
// `dist/` on 4400. v3.1: also checks the hook is ABSENT from the production dist
// (grep, not a browser) — see HANDOFF "window.__phylo".
//
// v3.1 additions: default view is linear; sunburst zoom + breadcrumb; the 3D
// chunk is not requested until picked; one-glance layout at 1440x900.
// Exit 1 on failure.
import { chromium } from 'playwright-core';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const port = process.argv[2] ?? '4410';
const BASE = `http://localhost:${port}/botanica/`;
const LOCALES = (process.env.LOCALES ?? 'en,es').split(',');
const prefix = (l) => (l === 'en' ? '' : `${l}/`);
// One order deep in each hierarchy: Malpighiales sits 4 levels under Plantae
// (Angiosperms › Eudicots › Superrosids), Lecanorales under Ascomycota › Lecanoromycetes.
const CASES = [
  // `probe`: a node visible in every state, away from the root (the root sits at the
  // canvas centre in the radial layout, which is the zoom buttons' fixed point).
  // `fam`/`famOrd`: a family-only URL, as the explorer's "open in tree" links carry.
  { k: 'plantae', q: '', ord: 'Malpighiales', url: 'Poales', probe: 'Lycophytes', fam: 'Orchidaceae', famOrd: 'Asparagales' },
  { k: 'fungi', q: '?k=fungi', ord: 'Lecanorales', url: 'Agaricales', probe: 'Ascomycota', fam: 'Parmeliaceae', famOrd: 'Lecanorales' },
];

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);
const check = (cond, msg, detail = '') => (cond ? ok(msg) : fail(`${msg}${detail ? ` (${detail})` : ''}`));

// __phylo must never ship in the production dist (v3.1 item 6): a plain grep of
// the built files, not a page load. `dist/` is optional here (the gate may run
// standalone against dist-test only); when present, it must be clean.
console.log('\n__phylo absent from the production dist');
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(html|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
if (existsSync('dist')) {
  const hits = walk('dist').filter((f) => readFileSync(f, 'utf8').includes('__phylo'));
  check(hits.length === 0, '__phylo does not appear anywhere in dist/', JSON.stringify(hits));
} else {
  console.log('  (no dist/ next to this run — skipped; grep it separately after `npm run build`)');
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function open(url, width, touch = false) {
  // Strict viewport for overflow; touch emulation only where (pointer: coarse) matters.
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 780 : 900 }, isMobile: touch, hasTouch: touch });
  await ctx.addInitScript(() => localStorage.setItem('ic7-tutorial:seen:botanica-filogenia', '1'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  return { page, ctx, errors };
}

const hook = (page, k, fn, ...args) => page.evaluate(([k, fn, args]) => window.__phylo[k][fn](...args), [k, fn, args]);
const focusOf = (page, k) => page.$eval(`#phylo-${k}-chart`, (e) => e.dataset.focus ?? null);
const waitFocus = (page, k, want, timeout = 3000) =>
  page.waitForFunction(([k, want]) => (document.querySelector(`#phylo-${k}-chart`).dataset.focus ?? null) === want, [k, want], { timeout })
    .then(() => true, () => false);
const waitHook = (page, k, fn, pred, timeout = 3000) =>
  page.waitForFunction(([k, fn, pred]) => new Function('v', `return ${pred}`)(window.__phylo[k][fn]()), [k, fn, pred], { timeout })
    .then(() => true, () => false);
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function inBox(page, k) {
  const p = await hook(page, k, 'focusPoint');
  const b = await page.$eval(`#phylo-${k}-chart`, (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  return { inside: !!p && p.x >= b.l && p.x <= b.r && p.y >= b.t && p.y <= b.b, p, b };
}

for (const locale of LOCALES) {
  for (const c of CASES) {
    for (const width of [1280, 360]) {
      const url = `${BASE}${prefix(locale)}filogenia/${c.q}`;
      const tag = `${locale} ${c.k} @${width}`;
      console.log(`\n${tag}  ${url}`);
      const { page, ctx, errors } = await open(url, width);
      const k = c.k;
      await page.waitForSelector(`#phylo-${k}-chart canvas`);
      await waitHook(page, k, 'visible', 'v > 0');
      const vFirst = await hook(page, k, 'visible');

      if (width === 360) {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        check(over <= 0, 'no horizontal overflow at 360', `${over}px`);
      }

      // 1. List click -> URL -> data-focus -> node inside the chart.
      await page.click(`#phylo-${k} [data-ord="${c.ord}"]`);
      const inUrl = await page.waitForFunction((o) => new URLSearchParams(location.search).get('ord') === o, c.ord, { timeout: 3000 }).then(() => true, () => false);
      check(inUrl, `list click put ord=${c.ord} in the URL`);
      check(await waitFocus(page, k, c.ord), `data-focus = ${c.ord} within 3 s`, `got ${await focusOf(page, k)}`);
      await settle(page);
      const box = await inBox(page, k);
      check(box.inside, 'focused node drawn inside the chart box', JSON.stringify(box));
      check((await hook(page, k, 'zoom')) > 1, 'selection zoomed in');

      // 2. A family chip (the store's `fam`) moves the focus to that family.
      const chip = `#phylo-${k} [data-fam]`;
      await page.waitForSelector(chip);
      const fam = await page.getAttribute(chip, 'data-fam');
      await page.click(chip);
      check(await waitFocus(page, k, fam), `family chip: data-focus = ${fam}`, `got ${await focusOf(page, k)}`);
      await settle(page);
      check((await inBox(page, k)).inside, 'focused family drawn inside the chart box');
      await page.goBack();
      check(await waitFocus(page, k, c.ord), 'Back from the family returned the focus to the order', `got ${await focusOf(page, k)}`);

      // 3. Back again clears the focus.
      await page.goBack();
      check(await waitFocus(page, k, null), 'Back cleared data-focus', `got ${await focusOf(page, k)}`);

      // 3. Zoom in / out / reset: the series zoom changes and what is drawn moves.
      const z0 = await hook(page, k, 'zoom');
      await settle(page);
      const p0 = await hook(page, k, 'nodePoint', c.probe);
      await page.click(`#phylo-${k} [data-zoom="in"]`);
      check(await waitHook(page, k, 'zoom', `v > ${z0}`), 'zoom in raised the series zoom');
      await settle(page);
      const p1 = await hook(page, k, 'nodePoint', c.probe);
      check(!!p0 && !!p1 && Math.hypot(p1.x - p0.x, p1.y - p0.y) > 1, 'zoom in moved the drawn nodes', JSON.stringify({ p0, p1 }));
      const z1 = await hook(page, k, 'zoom');
      await page.click(`#phylo-${k} [data-zoom="out"]`);
      check(await waitHook(page, k, 'zoom', `v < ${z1}`), 'zoom out lowered the series zoom');
      await page.click(`#phylo-${k} [data-zoom="in"]`);
      await page.click(`#phylo-${k} [data-reset]`);
      check(await waitHook(page, k, 'zoom', `Math.abs(v - ${z0}) < 1e-6`), 'Reset restored the fitted view', `fit zoom ${z0}`);

      // 4. Keyboard: a tool button works with Enter.
      const zk = await hook(page, k, 'zoom');
      await page.focus(`#phylo-${k} [data-zoom="in"]`);
      await page.keyboard.press('Enter');
      check(await waitHook(page, k, 'zoom', `v > ${zk}`), 'zoom in works from the keyboard');
      await page.click(`#phylo-${k} [data-reset]`);

      // 5. Expand all / collapse all.
      const v0 = await hook(page, k, 'visible');
      await page.click(`#phylo-${k} [data-expand="all"]`);
      check(await waitHook(page, k, 'visible', `v > ${v0}`), 'expand all showed more nodes');
      const v1 = await hook(page, k, 'visible');
      await page.click(`#phylo-${k} [data-expand="none"]`);
      check(await waitHook(page, k, 'visible', `v < ${Math.min(v0, v1)}`), 'collapse all showed fewer nodes');
      const v2 = await hook(page, k, 'visible');
      ok(`visible nodes: first paint ${vFirst}, after Back ${v0}, expand all ${v1}, collapse all ${v2}`);

      // 6. A URL with ?ord= lands focused (expanding from the collapsed state).
      const sep = c.q ? '&' : '?';
      await page.goto(`${url}${sep}ord=${c.url}`, { waitUntil: 'networkidle' });
      await page.waitForSelector(`#phylo-${k}-chart canvas`);
      check(await waitFocus(page, k, c.url, 5000), `?ord=${c.url} lands with data-focus`, `got ${await focusOf(page, k)}`);
      await settle(page);
      check((await inBox(page, k)).inside, 'URL-focused node inside the chart box');
      await page.goto(`${url}${sep}fam=${c.fam}`, { waitUntil: 'networkidle' });
      await page.waitForSelector(`#phylo-${k}-chart canvas`);
      check(await waitFocus(page, k, c.fam, 5000), `?fam=${c.fam} (no ord) lands with data-focus`, `got ${await focusOf(page, k)}`);
      const pressed = await page.$$eval(`#phylo-${k} [data-ord][aria-pressed="true"]`, (bs) => bs.map((b) => b.dataset.ord));
      check(pressed.length === 1 && pressed[0] === c.famOrd, `?fam= presses its order ${c.famOrd} in the list`, JSON.stringify(pressed));
      await settle(page);
      check((await inBox(page, k)).inside, 'family from the URL drawn inside the chart box');

      // 7. Full screen on the tree frame, and back.
      const fs = `#phylo-${k} [data-fs]`;
      const label0 = await page.getAttribute(fs, 'aria-label');
      await page.click(fs);
      const entered = await page.waitForFunction((id) => document.fullscreenElement?.id === id, `phylo-${k}-frame`, { timeout: 3000 }).then(() => true, () => false);
      check(entered, 'full screen entered on the tree frame');
      const label1 = await page.getAttribute(fs, 'aria-label');
      check(label1 !== label0, 'full-screen button label toggled', `${label0} -> ${label1}`);
      await page.click(fs);
      const left = await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3000 }).then(() => true, () => false);
      check(left, 'full screen exited');
      check((await page.getAttribute(fs, 'aria-label')) === label0, 'full-screen label restored');

      errors.length ? errors.forEach((e) => fail(`${tag}: ${e}`)) : ok('no console errors');
      await ctx.close();
    }
  }
}

// Kingdom switch after an interaction: the other kingdom's tree must still mount (review v3 #2).
console.log('\nkingdom switch after a click');
{
  const { page, ctx, errors } = await open(`${BASE}filogenia/`, 1280);
  await page.waitForSelector('#phylo-plantae [data-ord]', { timeout: 20000 });
  await page.click('#phylo-plantae [data-ord]');
  await page.waitForFunction(() => location.search.includes('ord='));
  await page.click('[data-kset="fungi"]');
  const ready = await page.waitForFunction(() => { const c = document.querySelector('#phylo-fungi-chart'); return c && c.dataset.ready && c.querySelector('canvas'); }, null, { timeout: 15000 }).then(() => true, () => false);
  check(ready, 'fungi tree mounts after an order click in plantae');
  errors.forEach((e) => fail(`kingdom switch: ${e}`));
  await ctx.close();
}

// Touch targets of the tree controls (touch emulation, so (pointer: coarse) applies).
console.log('\ntouch targets');
for (const locale of LOCALES) {
  for (const c of CASES) {
    const { page, ctx, errors } = await open(`${BASE}${prefix(locale)}filogenia/${c.q}`, 360, true);
    const small = await page.$$eval(`#phylo-${c.k} .phylo-tools button`, (bs) =>
      bs.filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), b.getAttribute('aria-label') ?? b.textContent.trim()]; })
        .filter(([w, h]) => w < 44 || h < 44));
    check(!small.length, `${locale} ${c.k}: tree controls ≥ 44 px`, JSON.stringify(small));
    errors.forEach((e) => fail(`${locale} ${c.k} @touch: ${e}`));
    await ctx.close();
  }
}

// INP of an order-list tap, CPU slowed 4x (as gate.mjs measures the other taps).
const INP_RUNS = Number(process.env.INP_RUNS ?? 5);
console.log(`\nINP (4x CPU, ${INP_RUNS} runs)`);
const inps = [];
for (let run = 0; run < INP_RUNS; run++) {
  const { page, ctx } = await open(`${BASE}filogenia/`, 390, true);
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate(() => {
    window.__inp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__inp = Math.max(window.__inp, e.duration); })
      .observe({ type: 'event', durationThreshold: 16, buffered: true });
  });
  await page.waitForSelector('#phylo-plantae-chart canvas');
  await page.waitForTimeout(1500);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.tap('#phylo-plantae [data-ord="Malpighiales"]');
  await page.waitForTimeout(1500);
  const inp = await page.evaluate(() => window.__inp);
  const focused = await focusOf(page, 'plantae');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  inps.push(Math.round(inp));
  if (focused !== 'Malpighiales') fail(`tree did not follow the tap under 4x CPU (data-focus=${focused})`);
  await ctx.close();
}
inps.sort((a, b) => a - b);
const med = inps[Math.floor(inps.length / 2)];
check(med < 200, `order-list tap: median ${med} ms, range ${inps[0]}-${inps[inps.length - 1]} ms`, 'budget 200 ms (median)');

// v3.1 item 2: default view is linear.
console.log('\ndefault view');
{
  const { page, ctx, errors } = await open(`${BASE}filogenia/`, 1280);
  await page.waitForSelector('#phylo-plantae-chart canvas');
  check((await page.getAttribute('#phylo-plantae', 'data-view')) === 'linear', 'the tree opens on the linear view');
  check(await page.getAttribute('#phylo-plantae [data-view="linear"]', 'aria-pressed') === 'true', 'Linear is the pressed view button');
  check(await hook(page, 'plantae', 'view') === 'linear', '__phylo agrees: view() === "linear"');
  errors.forEach((e) => fail(`default view: ${e}`));
  await ctx.close();
}

// v3.1 item 2: sunburst zoom (click an order) + breadcrumb (down and back up).
console.log('\nsunburst zoom + breadcrumb');
{
  const { page, ctx, errors } = await open(`${BASE}filogenia/`, 1280);
  await page.waitForSelector('#phylo-plantae-chart canvas');
  await page.click('#phylo-plantae [data-view="sunburst"]');
  await page.waitForFunction(() => document.querySelector('#phylo-plantae').dataset.view === 'sunburst');
  await page.waitForSelector('#phylo-plantae-chart canvas');
  const z0 = await hook(page, 'plantae', 'zoom');
  check(z0 === 0, 'sunburst opens fully zoomed out (depth 0)', `got ${z0}`);
  await page.click('#phylo-plantae [data-ord="Malpighiales"]');
  const zoomedIn = await waitHook(page, 'plantae', 'zoom', 'v > 0');
  check(zoomedIn, 'picking an order zoomed the sunburst in (depth > 0)');
  const crumbLen = await hook(page, 'plantae', 'crumbLength');
  check(crumbLen >= 2, 'breadcrumb has more than one step after zooming in', `length ${crumbLen}`);
  const focus = await focusOf(page, 'plantae');
  check(focus === 'Malpighiales', 'sunburst data-focus follows the same selection as linear', `got ${focus}`);
  // Breadcrumb's first (kingdom) crumb is keyboard-reachable and zooms all the way out.
  await page.focus('#phylo-plantae [data-crumb] button');
  await page.keyboard.press('Enter');
  const zoomedOut = await waitHook(page, 'plantae', 'zoom', 'v === 0');
  check(zoomedOut, 'the breadcrumb’s root step (keyboard) zoomed back out to depth 0');
  errors.forEach((e) => fail(`sunburst: ${e}`));
  await ctx.close();
}

// v3.1 item 2: the 3D chunk is never requested until the 3D view is chosen,
// and only on a capable, motion-consenting device (forced here via the same
// ic7.tier override the app itself reads, so the check is deterministic).
console.log('\n3D is lazy and gated by tier + reduced motion');
{
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.addInitScript(() => {
    localStorage.setItem('ic7-tutorial:seen:botanica-filogenia', '1');
    localStorage.setItem('ic7.tier', '2');
  });
  const page = await ctx2.newPage();
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(`${BASE}filogenia/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#phylo-plantae-chart canvas');
  check(!requests.some((u) => u.includes('tree-3d')), 'no tree-3d chunk requested before the 3D view is picked');
  const enabled = await page.$eval('#phylo-plantae [data-view="3d"]', (b) => !b.disabled);
  check(enabled, '3D is enabled at tier 2 with no reduced-motion preference');
  await page.click('#phylo-plantae [data-view="3d"]');
  const gotChunk = await page.waitForFunction(() => window.performance.getEntriesByType('resource').some((e) => e.name.includes('tree-3d')), null, { timeout: 10000 }).then(() => true, () => false);
  check(gotChunk, 'choosing 3D requested the tree-3d chunk');
  await ctx2.close();

  // Reduced motion (or a low tier) disables the button with a stated reason.
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx3.addInitScript(() => {
    localStorage.setItem('ic7-tutorial:seen:botanica-filogenia', '1');
    localStorage.setItem('ic7.tier', '2');
  });
  const page3 = await ctx3.newPage();
  await page3.goto(`${BASE}filogenia/`, { waitUntil: 'networkidle' });
  await page3.waitForSelector('#phylo-plantae-chart canvas');
  const disabled = await page3.$eval('#phylo-plantae [data-view="3d"]', (b) => b.disabled);
  const title = await page3.getAttribute('#phylo-plantae [data-view="3d"]', 'title');
  check(disabled, '3D is disabled under prefers-reduced-motion');
  check(!!title && title.length > 0, '3D’s disabled reason is stated (title/aria-label)', title ?? '');
  await ctx3.close();
}

// v3.1 item 5: one-glance layout at 1440x900 (chart, orders list, department
// bars all read above the fold once the section is at the top of the viewport).
console.log('\none-glance layout at 1440x900');
{
  const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx4.addInitScript(() => localStorage.setItem('ic7-tutorial:seen:botanica-filogenia', '1'));
  const page = await ctx4.newPage();
  await page.goto(`${BASE}filogenia/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#phylo-plantae-chart canvas');
  await page.evaluate(() => document.querySelector('#phylo-plantae').scrollIntoView());
  await page.waitForTimeout(300);
  const rects = await page.evaluate(() => {
    const sel = ['#phylo-plantae-frame', '#phylo-plantae .ord-list', '#phylo-plantae-side'];
    return sel.map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [s, r.bottom]; });
  });
  for (const [sel, bottom] of rects) check(bottom <= 900, `${sel} bottom ≤ 900px`, `${Math.round(bottom)}px`);
  await ctx4.close();
}

await browser.close();
console.log(failures.length ? `\nTREE GATE FAILED: ${failures.length}` : '\nTREE GATE PASSED');
process.exit(failures.length ? 1 : 0);
