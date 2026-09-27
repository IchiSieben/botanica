// v3.2 B6 gate: the way back to the portfolio.
//   Every page, EN and ES: a nav with "← IchiSieben" to the landing's Botánica page and a link
//   to the landing home, as same-origin root paths; 44 px targets on touch; nothing wider
//   than 360 px; visible at the top on load (the intro's scroll snap must not skip it).
//   node scripts/gate-back.mjs [port=4400]
import { chromium } from 'playwright-core';

const port = process.argv[2] ?? '4400';
const BASE = `http://localhost:${port}/botanica/`;
const PAGES = ['', 'especies/', 'filogenia/', 'cambios/'];
const failures = [];
const check = (c, good, bad) => { if (c) console.log(`  ✓ ${good}`); else { failures.push(bad ?? good); console.log(`  ✗ ${bad ?? good}`); } };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

for (const loc of ['en', 'es']) {
  const pre = loc === 'en' ? '' : 'es/';
  const home = loc === 'en' ? '/' : '/es/';
  for (const path of PAGES) {
    const url = `${BASE}${pre}${path}`;
    console.log(`\n${loc} /${path}`);
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('ic7-tutorial:seen') ? '1' : g.call(this, k); }; });
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    if (!res || res.status() >= 400) { check(false, '', `${url}: HTTP ${res?.status()}`); await ctx.close(); continue; }
    const m = await page.evaluate(() => {
      const nav = document.querySelector('nav.ic7');
      if (!nav) return null;
      const links = [...nav.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim(), name: a.textContent.replace(/\s+/g, ' ').trim(), h: a.getBoundingClientRect().height }));
      return { links, first: document.body.firstElementChild?.nextElementSibling === nav || document.querySelector('a.skip + nav.ic7') === nav,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        top: Math.round(nav.getBoundingClientRect().top), y: scrollY };
    });
    if (!m) { check(false, '', `${url}: no nav.ic7`); await ctx.close(); continue; }
    const [back, homeLink] = m.links;
    check(back?.href === `${home}projects/botanica/` && /^←\s*IchiSieben/.test(back.text), `← IchiSieben → ${back?.href}`, `${url}: back link ${JSON.stringify(back)}`);
    check(homeLink?.href === home, `home link → ${homeLink?.href}`, `${url}: home link ${JSON.stringify(homeLink)}`);
    check(m.links.every((l) => l.h >= 44), 'targets ≥ 44 px on touch', `${url}: link heights ${m.links.map((l) => Math.round(l.h)).join(', ')}`);
    check(m.first, 'strip sits right after the skip link', `${url}: strip is not the first thing after the skip link`);
    check(m.top === 0 && m.y === 0, 'strip visible at the top on load (no snap past it)', `${url}: strip top ${m.top}, scrollY ${m.y}`);
    check(m.over <= 0, 'no horizontal overflow at 360', `${url}: ${m.over}px overflow at 360`);
    await ctx.close();
  }
}
await browser.close();
console.log(failures.length ? `\nBACK GATE FAILED: ${failures.length}` : '\nBACK GATE PASSED');
process.exit(failures.length ? 1 : 0);
