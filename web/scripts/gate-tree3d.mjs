// v3.2 B5 gate: reset, clear selection, `?view=` write-back, and the interactive 3D tree.
//   1. Linear: a URL selection + Reset -> no ord/fam in the URL, side panel back to the
//      whole kingdom, crumb hidden.
//   2. "Clear selection" in the crumb clears a list selection.
//   3. Picking a view writes `?view=`; a reload opens that view.
//   4. 3D: labels are on for the largest nodes; hovering a node shows its name and
//      species count; clicking it selects (URL + side panels change) and lights its branch;
//      Reset clears it again.
//   5. 0 console errors.
// Needs the test build (window.__phylo): `node scripts/gate-tree3d.mjs 4401`.
import { chromium } from 'playwright-core';

const port = process.argv[2] ?? '4401';
const BASE = `http://localhost:${port}/botanica/`;
const failures = [];
const check = (c, good, bad) => { if (c) console.log(`  ✓ ${good}`); else { failures.push(bad ?? good); console.log(`  ✗ ${bad ?? good}`); } };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function open(path) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => {
    for (const k of ['botanica', 'botanica-filogenia']) localStorage.setItem(`ic7-tutorial:seen:${k}`, '1');
    localStorage.setItem('ic7.tier', '2'); // 3D is opt-in at tier >= 2
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  return { ctx, page, errors };
}
const R = '#phylo-plantae';
const side = (page) => page.$eval(`${R} [data-side-title]`, (e) => e.textContent.trim());
const depts = (page) => page.$eval(`${R} [data-depts]`, (e) => e.innerHTML);
const qs = (page, key) => new URL(page.url()).searchParams.get(key);
const ready = (page) => page.waitForSelector(`${R} .chart-phylo[data-ready="1"]`, { timeout: 20_000 });

// 1-2. Linear: Reset and Clear selection.
{
  console.log('\nlinear: reset + clear selection');
  const { ctx, page, errors } = await open('filogenia/?ord=Poales');
  await page.$eval(`${R} .chart-phylo`, (e) => e.scrollIntoView());
  await ready(page);
  check(await page.$eval(R, (r) => r.hasAttribute('data-selected')), 'a URL selection shows the crumb');
  check(await page.$(`${R} [data-clear]`) != null, 'crumb carries "Clear selection"');
  await page.click(`${R} [data-reset]`);
  await page.waitForTimeout(400);
  check(qs(page, 'ord') == null && qs(page, 'fam') == null, 'Reset removes ord/fam from the URL', `Reset left ${page.url()}`);
  check(/whole kingdom/.test(await side(page)), 'Reset puts the side panel back on the whole kingdom', `side after Reset: ${await side(page)}`);
  check(!(await page.$eval(R, (r) => r.hasAttribute('data-selected'))), 'crumb hidden with nothing selected');
  await page.click(`${R} [data-ord="Malpighiales"]`);
  await page.waitForTimeout(300);
  check(qs(page, 'ord') === 'Malpighiales', 'list click selects');
  await page.focus(`${R} [data-clear]`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.activeElement?.hasAttribute('data-reset')), 'focus moves to Reset after Clear selection (keyboard)', `focus after Clear: ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80))}`);
  check(qs(page, 'ord') == null && /whole kingdom/.test(await side(page)), 'Clear selection clears it', `after Clear: ${page.url()}`);
  check(!errors.length, 'no console errors', `console errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// 3-4. 3D.
{
  console.log('\n3D: view write-back, labels, hover, click selects, reset');
  const { ctx, page, errors } = await open('filogenia/');
  await page.$eval(`${R} .chart-phylo`, (e) => e.scrollIntoView());
  await ready(page);
  await page.click(`${R} [data-view="sunburst"]`);
  await page.waitForTimeout(300);
  check(qs(page, 'view') === 'sunburst', '?view=sunburst written', `URL after sunburst: ${page.url()}`);
  // No-op store writes on a foreign ?view= must not stack Back entries (v3.2 review #2).
  const h0 = await page.evaluate(() => history.length);
  for (let i = 0; i < 2; i++) await page.click('[data-kset="plantae"]');
  await page.waitForTimeout(200);
  const h1 = await page.evaluate(() => history.length);
  check(h1 === h0 && qs(page, 'view') === 'sunburst', 'no-op clicks add no history entry and keep ?view=', `history ${h0} → ${h1}, URL ${page.url()}`);
  await page.click(`${R} [data-view="3d"]`);
  await page.waitForSelector(`${R} .chart-phylo canvas`, { timeout: 20_000 });
  await page.waitForFunction(() => window.__phylo?.plantae.point3d('Poales') != null, null, { timeout: 20_000 });
  await page.waitForTimeout(400);
  check(qs(page, 'view') === '3d', '?view=3d written', `URL after 3D: ${page.url()}`);
  const labels = await page.$$eval(`${R} .t3-label`, (ls) => ls.filter((l) => l.style.visibility !== 'hidden' && l.textContent).length);
  check(labels >= 5, `${labels} always-on labels for the largest nodes`, `only ${labels} 3D labels visible`);

  const beforeSide = await side(page), beforeDepts = await depts(page);
  const pt = await page.evaluate(() => window.__phylo.plantae.point3d('Poales'));
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(300);
  const tip = await page.$eval(`${R} .t3-tip`, (t) => ({ hidden: t.hidden, text: t.textContent }));
  check(!tip.hidden && /\d/.test(tip.text), `hover shows "${tip.text}"`, `hover tooltip: hidden=${tip.hidden} text="${tip.text}"`);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(600);
  const picked = qs(page, 'ord');
  check(!!picked, `3D click selected ?ord=${picked}`, `3D click did not select (URL ${page.url()})`);
  const afterSide = await side(page);
  check(afterSide !== beforeSide && picked && afterSide.includes(picked), `side title follows: "${afterSide}"`, `side title did not change: "${afterSide}"`);
  await page.waitForFunction((b) => document.querySelector('#phylo-plantae [data-depts]').innerHTML !== b, beforeDepts, { timeout: 5000 }).catch(() => {});
  check((await depts(page)) !== beforeDepts, 'department bars follow the 3D click', 'department bars unchanged after the 3D click');
  check(await page.$eval(`${R} .chart-phylo`, (e) => e.dataset.focus ?? '') === picked, 'chart data-focus is the picked order');
  // First visit ("How to read this" open): the explorer link must carry the selection (v3.2 review #1).
  const openEx = await page.$eval(`${R} a[data-open-ex]`, (a) => a.getAttribute('href'));
  check(openEx.includes(`ord=${picked}`), `"Open in explorer" carries ?ord=${picked}`, `"Open in explorer" href is ${openEx}`);
  const dim = await page.$$eval(`${R} .t3-label.dim`, (ls) => ls.length);
  check(dim > 0, `the rest dims (${dim} labels dimmed)`, 'no label dimmed after selecting a branch');

  await page.click(`${R} [data-reset]`);
  await page.waitForTimeout(400);
  check(qs(page, 'ord') == null && /whole kingdom/.test(await side(page)), '3D Reset clears the selection', `3D Reset left ${page.url()}`);
  check(await page.$$eval(`${R} .t3-label.dim`, (ls) => ls.length) === 0, '3D Reset un-dims every label');
  check(!errors.length, 'no console errors', `console errors: ${errors.join(' | ')}`);

  await page.reload({ waitUntil: 'networkidle' });
  const view = await page.$eval(R, (r) => r.dataset.view);
  check(view === '3d', 'reload keeps the 3D view', `reload opened view=${view}`);
  await ctx.close();
}

await browser.close();
console.log(failures.length ? `\nTREE3D GATE FAILED: ${failures.length}` : '\nTREE3D GATE PASSED');
process.exit(failures.length ? 1 : 0);
