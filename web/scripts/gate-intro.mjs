// Intro gate (v3 item 1), Playwright. EN + ES:
//   - 8–10 fact cards; every fact number is an <a> to doi.org / ipni.org / gbif.org / the changelog
//   - the timeline's first year equals the earliest year described (recomputed from the JSON)
//   - exactly one <h1> inside the intro
//   - prefers-reduced-motion: reduce → every intro element has opacity 1 and no transform
//   - ?dep=LORETO → the explorer is within 120 px of the viewport top; CLS ≤ 0.05
//   - "Explore" moves scroll + focus to the explorer
//   - fresh profile: the explorer tour does NOT open while the intro is in view, and does
//     open once the explorer is scrolled into view
//   - 0 console errors; 0 px horizontal overflow at 360 (strict viewport, no isMobile)
//
//   node --experimental-strip-types scripts/gate-intro.mjs [port=4440]
// Needs a served build (scripts/serve.mjs dist <port>). Exit 1 on any failure.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const port = process.argv[2] ?? '4440';
const BASE = `http://localhost:${port}/botanica/`;
const SHOTS = process.env.SHOTS; // optional dir for screenshots
const facets = JSON.parse(readFileSync(new URL('../public/data/facets-plantae.json', import.meta.url), 'utf8'));
const EARLIEST = Math.min(...facets.year.filter((y) => y > 0));
const TOUR_ID = 'botanica-explorar';

const failures = [];
const fail = (m) => { failures.push(m); console.log(`  ✗ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);
const check = (cond, good, bad) => (cond ? ok(good) : fail(bad));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function open(url, { width = 1280, height = 900, seen = true, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  if (seen) await ctx.addInitScript((id) => localStorage.setItem(`ic7-tutorial:seen:${id}`, '1'), TOUR_ID);
  await ctx.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  return { page, ctx, errors };
}
const explorerTop = (page) => page.evaluate(() =>
  (document.getElementById('explorar') ?? document.querySelector('[data-explorer]')).getBoundingClientRect().top);
const tourOpen = (page) => page.evaluate(() => !!document.querySelector('.ic7-tutorial-root.ic7-tutorial-on'));

for (const locale of ['en', 'es']) {
  const url = `${BASE}${locale === 'en' ? '' : 'es/'}`;
  console.log(`\n${locale} ${url}`);

  // Structure, sources, timeline, errors.
  {
    const { page, ctx, errors } = await open(url);
    const s = await page.evaluate(() => {
      const intro = document.querySelector('[data-intro]');
      const cards = [...intro.querySelectorAll('.in-card')];
      return {
        cards: cards.length,
        links: cards.map((c) => { const a = c.querySelector('.in-big'); return a ? { tag: a.tagName, href: a.href, text: a.querySelector('.in-v')?.textContent } : null; }),
        tlFirst: intro.querySelector('.in-tl-item')?.getAttribute('data-year'),
        tlFirstText: intro.querySelector('.in-tl-item .in-v')?.textContent,
        tlLinks: [...intro.querySelectorAll('.in-tl-item')].map((li) => li.querySelector('a.in-when')?.href ?? null),
        h1: intro.querySelectorAll('h1').length,
      };
    });
    check(s.cards >= 8 && s.cards <= 10, `${s.cards} fact cards`, `${url}: ${s.cards} fact cards (want 8–10)`);
    const allowed = (h) => /^https:\/\/(doi\.org|www\.ipni\.org|ipni\.org|www\.gbif\.org|gbif\.org)\//.test(h) || /\/botanica\/(es\/)?cambios\/$/.test(h);
    const bad = s.links.filter((l) => !l || l.tag !== 'A' || !allowed(l.href) || !/\d/.test(l.text ?? ''));
    check(!bad.length, 'every fact number is a link to its source', `${url}: fact links ${JSON.stringify(bad)}`);
    const badTl = s.tlLinks.filter((h) => !h || !allowed(h));
    check(!badTl.length, 'every timeline year links to its source', `${url}: timeline links ${JSON.stringify(badTl)}`);
    check(Number(s.tlFirst) === EARLIEST && s.tlFirstText === String(EARLIEST),
      `timeline starts at ${EARLIEST}`, `${url}: timeline first year ${s.tlFirst}/${s.tlFirstText}, expected ${EARLIEST}`);
    check(s.h1 === 1, 'intro has exactly one <h1>', `${url}: intro has ${s.h1} <h1>`);
    // "Explore" → explorer at the top and focused.
    await page.click('.in-open .in-cta');
    await page.waitForTimeout(400);
    const top = await explorerTop(page);
    const focused = await page.evaluate(() => document.activeElement?.id);
    check(Math.abs(top) <= 120 && focused === 'explorar', `"Explore" → explorer at ${Math.round(top)} px, focused`,
      `${url}: after Explore, explorer top ${Math.round(top)} px, focus on #${focused}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${locale}-desktop-explore.png` });
    check(!errors.length, '0 console errors', `${url}: ${errors.join(' | ')}`);
    await ctx.close();
  }

  // Reduced motion: everything visible, untransformed.
  {
    const { page, ctx } = await open(url, { reduced: true });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
    await page.waitForTimeout(200);
    const bad = await page.evaluate(() => [...document.querySelectorAll('[data-intro], [data-intro] *')]
      .map((el) => { const cs = getComputedStyle(el); return [el.className?.baseVal ?? el.className, cs.opacity, cs.transform]; })
      .filter(([, o, t]) => o !== '1' || (t !== 'none' && t !== '')));
    check(!bad.length, 'reduced motion: opacity 1, no transform', `${url}: reduced motion ${JSON.stringify(bad.slice(0, 5))}`);
    await ctx.close();
  }

  // Deep link: explorer at the top, no layout shift.
  {
    const { page, ctx, errors } = await open(`${url}?dep=LORETO`);
    await page.waitForTimeout(800);
    const top = await explorerTop(page);
    const cls = await page.evaluate(() => window.__cls);
    const reveal = await page.evaluate(() => { const a = document.querySelector('[data-intro-reveal]'); return a && getComputedStyle(a).display !== 'none'; });
    check(top >= 0 && top <= 120, `?dep=LORETO → explorer at ${Math.round(top)} px`, `${url}?dep=LORETO: explorer top ${Math.round(top)} px`);
    check(cls <= 0.05, `CLS ${cls.toFixed(3)}`, `${url}?dep=LORETO: CLS ${cls.toFixed(3)}`);
    check(reveal, '"About this atlas" link shown', `${url}?dep=LORETO: reveal link hidden`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${locale}-deeplink.png` });
    await page.click('[data-intro-reveal]');
    await page.waitForTimeout(200);
    const cards = await page.evaluate(() => [...document.querySelectorAll('.in-card')].filter((c) => c.getBoundingClientRect().height > 0).length);
    check(cards >= 8, 'reveal link restores the intro', `${url}?dep=LORETO: after reveal ${cards} visible cards`);
    check(!errors.length, '0 console errors (deep link)', `${url}?dep=LORETO: ${errors.join(' | ')}`);
    await ctx.close();
  }

  // Fresh profile: tour waits for the explorer.
  {
    const { page, ctx, errors } = await open(url, { seen: false });
    await page.waitForTimeout(1500);
    const early = await tourOpen(page);
    check(!early, 'tour closed while the intro is in view', `${url}: tour opened over the intro`);
    await page.evaluate(() => document.getElementById('explorar').scrollIntoView());
    await page.waitForTimeout(1200);
    const later = await tourOpen(page);
    check(later, 'tour opens once the explorer is in view', `${url}: tour did not open after scrolling to the explorer`);
    check(!errors.length, '0 console errors (fresh profile)', `${url} fresh: ${errors.join(' | ')}`);
    await ctx.close();
  }

  // 360 px strict viewport: no horizontal overflow (intro fully open, and deep link).
  for (const u of [url, `${url}?dep=LORETO`]) {
    const { page, ctx } = await open(u, { width: 360, height: 780 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(over <= 0, `360 px overflow ${over} px (${u.includes('?') ? 'deep link' : 'intro'})`, `${u}: ${over} px horizontal overflow at 360`);
    if (SHOTS && !u.includes('?')) await page.screenshot({ path: `${SHOTS}/${locale}-360.png`, fullPage: true });
    await ctx.close();
  }
}

await browser.close();
console.log(failures.length ? `\n✗ ${failures.length} failure(s)` : '\n✓ intro gate passed');
process.exit(failures.length ? 1 : 0);
