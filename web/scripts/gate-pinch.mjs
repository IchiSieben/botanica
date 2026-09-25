// Gate for the explorer map's touch gestures (lib/map-zoom.ts), driven through CDP touch
// events on an emulated phone:
//   - a two-finger pinch zooms (data-scale grows) and does not select a department;
//   - after a pinch, lifting one finger leaves the other panning and the closing click
//     selects nothing (v3 review #10; replayed as pointer events, CDP cannot lift one finger);
//   - a plain tap still selects the department under the finger.
//
//   node scripts/gate-pinch.mjs <port>
import { chromium } from 'playwright-core';

const port = process.argv[2] ?? '4400';
const BASE = `http://localhost:${port}/botanica/`;
const failures = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures.push(m); console.log(`  ✗ ${m}`); };
const check = (c, m) => (c ? ok(m) : fail(m));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function open(locale) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem('ic7-tutorial:seen:botanica-explorar', '1'); } catch {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  // A state in the URL skips the intro, so the map is in view.
  await page.goto(`${BASE}${locale === 'es' ? 'es/' : ''}?m=species`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('[data-explorer]').classList.contains('is-loading'));
  await page.$eval('#map-vp', (e) => e.scrollIntoView({ block: 'center' }));
  const cdp = await ctx.newCDPSession(page);
  const box = await page.$eval('#map-vp', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  return { ctx, page, cdp, box, errors };
}

const touch = (cdp, type, points) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
const scaleOf = (page) => page.$eval('#map-vp', (e) => Number(e.dataset.scale ?? 1));
const layerXY = (page) => page.$eval('#map-zoom', (e) => { const m = new DOMMatrix(getComputedStyle(e).transform); return [m.e, m.f]; });
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

for (const locale of ['en', 'es']) {
  console.log(`\n${locale} pinch`);
  const { ctx, page, cdp, box, errors } = await open(locale);
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;

  // 1. Pinch out from 40 px apart to 200 px apart, in steps.
  await touch(cdp, 'touchStart', [[cx - 20, cy], [cx + 20, cy]]);
  for (let d = 20; d <= 100; d += 10) { await touch(cdp, 'touchMove', [[cx - d, cy], [cx + d, cy]]); await frame(page); }
  const k1 = await scaleOf(page);
  check(k1 > 2, `pinch zooms (scale ${k1.toFixed(2)})`);

  await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(250);
  check(!new URL(page.url()).searchParams.get('dep'), 'no department selected by the pinch');

  // 2. Pinch, lift one finger, pan with the other (v3 review #10). CDP cannot release a
  // single touch point, so this sequence is replayed as the pointer events map-zoom.ts
  // listens to, dispatched on the viewport (pointer capture throws and is caught there).
  const r = await page.evaluate(([cx, cy]) => {
    const vp = document.querySelector('#map-vp');
    const ev = (type, id, x, y) => vp.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    const k0 = Number(vp.dataset.scale ?? 1);
    ev('pointerdown', 11, cx - 20, cy); ev('pointerdown', 12, cx + 20, cy);
    for (let d = 20; d <= 60; d += 10) { ev('pointermove', 11, cx - d, cy); ev('pointermove', 12, cx + d, cy); }
    const k1 = Number(vp.dataset.scale);
    ev('pointerup', 12, cx + 60, cy);
    const t0 = new DOMMatrix(getComputedStyle(document.querySelector('#map-zoom')).transform);
    for (let s = 1; s <= 5; s++) ev('pointermove', 11, cx - 60 + s * 15, cy + s * 10);
    const t1 = new DOMMatrix(getComputedStyle(document.querySelector('#map-zoom')).transform);
    const k2 = Number(vp.dataset.scale);
    ev('pointerup', 11, cx + 15, cy + 50);
    // The click that ends the gesture must be swallowed (no department selected).
    const p = document.elementFromPoint(cx + 15, cy + 50);
    p?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx + 15, clientY: cy + 50 }));
    return { k0, k1, k2, moved: [t0.e, t0.f, t1.e, t1.f].map(Math.round) };
  }, [cx, cy]);
  check(r.k1 > r.k0, `synthetic pinch zooms (${r.k0} → ${r.k1})`);
  check(r.moved[2] !== r.moved[0] || r.moved[3] !== r.moved[1], `the remaining finger pans (${r.moved.slice(0, 2)} → ${r.moved.slice(2)})`);
  check(Math.abs(r.k2 - r.k1) < 0.01, `panning keeps the zoom (${r.k1} → ${r.k2})`);
  await page.waitForTimeout(250);
  check(!new URL(page.url()).searchParams.get('dep'), 'the click that ends the gesture selects nothing');

  // 3. Reset, then a plain tap selects the department under it.
  await page.click('#cf-map [data-zoom="reset"]');
  const target = await page.$eval('#map path[data-dep="LORETO"]', (p) => { const r = p.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await touch(cdp, 'touchStart', [target]);
  await touch(cdp, 'touchEnd', []);
  const dep = await page.waitForFunction(() => new URL(location.href).searchParams.get('dep'), null, { timeout: 3000 }).then((h) => h.jsonValue(), () => null);
  check(dep === 'LORETO', `tap selects the department (${dep})`);

  check(errors.length === 0, `0 console errors${errors.length ? ` → ${errors.slice(0, 2).join(' | ')}` : ''}`);
  await ctx.close();
}

await browser.close();
console.log(failures.length ? `\nPINCH GATE FAILED: ${failures.length}` : '\nPINCH GATE PASSED');
process.exit(failures.length ? 1 : 0);
