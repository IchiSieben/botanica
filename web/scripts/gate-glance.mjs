// v3.2 B3 gate: "one glance per section".
//   1. At 1440×900 and 2560×1080 (EN + ES), each intro section (opening, numbers,
//      timeline, how the atlas works) fits one viewport under the sticky header.
//   2. The gap between the opening's last line and "Peru, by the numbers" stays small.
//   3. Timeline: two columns from 1280 px, one below.
//   4. Explorer at 1440×900: KPIs, map, families and origin panels all inside the
//      viewport once #explorar is scrolled to.
//   5. scroll-snap-type is `y proximity` (never mandatory) and `none` under reduced motion.
//   6. "How to read this": whole on the first visit, one line + expand control after.
//
//   node scripts/gate-glance.mjs [port=4400]
import { chromium } from 'playwright-core';

const port = process.argv[2] ?? '4400';
const BASE = `http://localhost:${port}/botanica/`;
const failures = [];
const check = (c, good, bad) => { if (c) console.log(`  ✓ ${good}`); else { failures.push(bad ?? good); console.log(`  ✗ ${bad ?? good}`); } };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function open(url, vp, { reduced = false, seen = true } = {}) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((s) => {
    localStorage.setItem('ic7-tutorial:seen:botanica', '1');
    if (s) localStorage.setItem('botanica.howto.seen', '1');
  }, seen);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

for (const loc of ['', 'es/']) {
  for (const vp of [{ width: 1440, height: 900 }, { width: 2560, height: 1080 }]) {
    console.log(`\n${loc || 'en/'} ${vp.width}×${vp.height}`);
    const { ctx, page } = await open(`${BASE}${loc}`, vp);
    const m = await page.evaluate(() => {
      const hdr = document.querySelector('header.site')?.getBoundingClientRect().height ?? 0;
      const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; };
      const secs = [...document.querySelectorAll('.intro > section')].filter((s) => s.offsetParent).map((s) => ({ cls: s.className.split(' ')[0], ...box(s) }));
      const open = document.querySelector('.in-actions'), facts = document.querySelector('#in-facts-h');
      return { hdr, secs, gap: facts.getBoundingClientRect().top - open.getBoundingClientRect().bottom,
        tlCols: getComputedStyle(document.querySelector('.in-tl-list')).columnCount };
    });
    const room = vp.height - m.hdr;
    for (const s of m.secs) check(s.h <= room, `${s.cls} ${Math.round(s.h)} px ≤ ${Math.round(room)} px`, `${loc}${vp.width}: ${s.cls} is ${Math.round(s.h)} px, viewport room ${Math.round(room)} px`);
    check(m.gap <= 160, `gap opening → numbers ${Math.round(m.gap)} px`, `${loc}${vp.width}: gap before the numbers is ${Math.round(m.gap)} px`);
    check(m.tlCols === '2', `timeline in 2 columns`, `${loc}${vp.width}: timeline columns=${m.tlCols}`);
    if (vp.width === 1440) {
      await page.evaluate(() => document.getElementById('explorar').scrollIntoView({ block: 'start' }));
      await page.waitForSelector('[data-explorer] [data-painted]', { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(400);
      const vis = await page.evaluate(() => {
        const inView = (sel) => { const el = document.querySelector(sel); if (!el) return `${sel}: missing`; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 ? true : `${sel}: ${Math.round(r.top)}→${Math.round(r.bottom)} of ${innerHeight}`; };
        return ['#kpis', '#cf-map', '#cf-fam', '#cf-st'].map(inView);
      });
      check(vis.every((v) => v === true), 'explorer: KPIs, map, families, origin in one viewport', `${loc}1440: explorer not in one glance: ${vis.filter((v) => v !== true).join('; ')}`);
    }
    await ctx.close();
  }
  // One column below 1280.
  {
    const { ctx, page } = await open(`${BASE}${loc}`, { width: 1024, height: 800 });
    const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.in-tl-list')).columnCount);
    check(cols !== '2', `1024: timeline in one column`, `${loc}1024: timeline columns=${cols}`);
    await ctx.close();
  }
}

// Snap: proximity, and off under reduced motion.
{
  const { ctx, page } = await open(BASE, { width: 1440, height: 900 });
  const snap = await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);
  // Chrome serializes 'y proximity' as 'y' (proximity is the default strictness).
  check(snap.startsWith('y') && !snap.includes('mandatory'), `scroll-snap-type: ${snap}`, `scroll-snap-type is "${snap}"`);
  await ctx.close();
  const r = await open(BASE, { width: 1440, height: 900 }, { reduced: true });
  const snapR = await r.page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);
  check(snapR === 'none', 'reduced motion: no snap', `reduced motion: scroll-snap-type is "${snapR}"`);
  await r.ctx.close();
}

// How to read this: first visit whole, later one line; the label expands it.
{
  const first = await open(BASE, { width: 1440, height: 900 }, { seen: false });
  const h1 = await first.page.$eval('#cf-map .cf-howto', (p) => ({ h: p.getBoundingClientRect().height, open: p.hasAttribute('data-open') }));
  check(h1.open, `first visit: how-to open (${Math.round(h1.h)} px)`, 'first visit: how-to collapsed');
  await first.ctx.close();
  const later = await open(BASE, { width: 1440, height: 900 });
  const p = '#cf-map .cf-howto';
  const h2 = await later.page.$eval(p, (el) => ({ h: el.getBoundingClientRect().height, exp: el.querySelector('button').getAttribute('aria-expanded') }));
  check(h2.h <= 24 && h2.exp === 'false', `repeat visit: one line (${Math.round(h2.h)} px, aria-expanded=false)`, `repeat visit: how-to ${Math.round(h2.h)} px, aria-expanded=${h2.exp}`);
  await later.page.$eval(`${p} button`, (b) => b.click()); // the tour card can sit over it
  const h3 = await later.page.$eval(p, (el) => ({ h: el.getBoundingClientRect().height, exp: el.querySelector('button').getAttribute('aria-expanded') }));
  check(h3.h > h2.h && h3.exp === 'true', `expand control opens it (${Math.round(h3.h)} px)`, `expand control: ${Math.round(h3.h)} px, aria-expanded=${h3.exp}`);
  await later.ctx.close();
}

await browser.close();
console.log(failures.length ? `\nGLANCE GATE FAILED: ${failures.length}` : '\nGLANCE GATE PASSED');
process.exit(failures.length ? 1 : 0);
