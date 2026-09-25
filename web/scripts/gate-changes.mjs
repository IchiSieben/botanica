// Commit gate for /cambios/ and /es/cambios/ (Playwright):
//   - both pages return 200, exactly one <h1>, an <article id="v3.0.0">
//   - canonical + hreflang point at the real domain
//   - the language switch lands on the other locale's changes page
//   - zero console errors
//   - 0 px horizontal overflow at 360 width (strict viewport, no isMobile)
//   - no link with an empty href
//
//   node scripts/gate-changes.mjs [port=4420]
//
// Needs a served build (scripts/serve.mjs). Exit code 1 on any failure.
import { chromium } from 'playwright-core';

const port = process.argv[2] ?? '4420';
const BASE = `http://localhost:${port}/botanica/`;
const SITE = 'https://ichisieben.dev/botanica/';

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function open(url, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 780 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const resp = await page.goto(url, { waitUntil: 'networkidle' });
  return { page, ctx, errors, status: resp?.status() ?? 0 };
}

const PAGES = [
  { locale: 'en', path: 'cambios/', other: 'es' },
  { locale: 'es', path: 'es/cambios/', other: 'en' },
];

for (const p of PAGES) {
  const url = `${BASE}${p.path}`;
  console.log(`\n${p.locale} ${url}`);
  const { page, ctx, errors, status } = await open(url);

  status === 200 ? ok(`200 ${url}`) : fail(`${url}: status ${status}`);

  const h1Count = await page.locator('h1').count();
  h1Count === 1 ? ok('exactly one <h1>') : fail(`${url}: ${h1Count} <h1> elements, expected 1`);

  const v3 = await page.locator('#v3\\.0\\.0').count();
  v3 === 1 ? ok('article#v3.0.0 present') : fail(`${url}: article#v3.0.0 not found`);
  // Structure, not just presence: 3 sections and no raw-markdown notes block (ES headings, wrapped items).
  const [secs, items, notes] = await page.$eval('article[id="v3.0.0"]', (a) => [a.querySelectorAll('h3').length, a.querySelectorAll('li').length, a.querySelectorAll('.changelog-notes').length]);
  secs === 3 && items >= 10 && notes === 0 ? ok(`v3.0.0: ${secs} sections, ${items} items, no notes`) : fail(`${url}: v3.0.0 has ${secs} sections, ${items} items, ${notes} notes`);

  const canonical = await page.getAttribute('link[rel=canonical]', 'href');
  const expectedCanonical = `${SITE}${p.path}`;
  canonical === expectedCanonical
    ? ok(`canonical = ${canonical}`)
    : fail(`${url}: canonical ${canonical}, expected ${expectedCanonical}`);

  const hrefEn = await page.getAttribute('link[rel=alternate][hreflang=en]', 'href');
  const hrefEs = await page.getAttribute('link[rel=alternate][hreflang=es]', 'href');
  hrefEn === `${SITE}cambios/` ? ok(`hreflang en = ${hrefEn}`) : fail(`${url}: hreflang en ${hrefEn}, expected ${SITE}cambios/`);
  hrefEs === `${SITE}es/cambios/` ? ok(`hreflang es = ${hrefEs}`) : fail(`${url}: hreflang es ${hrefEs}, expected ${SITE}es/cambios/`);

  const emptyHrefs = await page.$$eval('a', (as) => as.filter((a) => a.getAttribute('href') === '').map((a) => a.outerHTML));
  emptyHrefs.length === 0 ? ok('no link with an empty href') : fail(`${url}: ${emptyHrefs.length} links with empty href`);

  errors.length ? errors.forEach((e) => fail(`${url}: ${e}`)) : ok('no console errors');

  // Language switch lands on the other locale's changes page.
  await page.click('#lang-switch');
  await page.waitForURL((u) => u.pathname.endsWith(`/${p.other === 'es' ? 'es/cambios/' : 'cambios/'}`) || u.pathname.endsWith(p.other === 'es' ? '/es/cambios' : '/cambios'));
  const afterSwitch = new URL(page.url()).pathname;
  const expectedPath = p.other === 'es' ? '/botanica/es/cambios/' : '/botanica/cambios/';
  afterSwitch.replace(/\/?$/, '/') === expectedPath
    ? ok(`lang switch -> ${afterSwitch}`)
    : fail(`${url}: lang switch went to ${afterSwitch}, expected ${expectedPath}`);

  await ctx.close();

  // Strict viewport at 360 (no isMobile emulation, so Chrome doesn't widen the layout viewport).
  const { page: page360, ctx: ctx360 } = await open(url, 360);
  const over = await page360.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  over > 0 ? fail(`${url}: ${over}px horizontal overflow at 360`) : ok('no overflow at 360');
  await ctx360.close();
}

await browser.close();
console.log(failures.length ? `\nGATE FAILED: ${failures.length}` : '\nGATE PASSED');
process.exit(failures.length ? 1 : 0);
