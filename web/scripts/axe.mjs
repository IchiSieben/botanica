// axe-core (WCAG 2 A/AA) over every page, EN + ES, dark + light, 1280 + 360, plus the states
// people use (species picked, grid view, explorer filtered, tree with an order selected).
// axe-core is fetched from jsdelivr once per run and injected (not a dependency).
//
//   node scripts/axe.mjs [port=4400]
//
// Exit code 1 on any violation.
import { chromium } from 'playwright-core';

const port = process.argv[2] ?? '4400';
const BASE = `http://localhost:${port}/botanica/`;
const axeSrc = await (await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js')).text();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

const STATES = [
  ['', 'explore'],
  ['?dep=LORETO&fam=Orchidaceae', 'explore filtered'],
  ['especies/', 'species'],
  ['especies/?sp=Aa+argyrolepis', 'species picked'],
  ['especies/?view=grid&k=fungi', 'species grid fungi'],
  ['filogenia/', 'tree'],
  ['filogenia/?ord=Asparagales', 'tree order'],
  ['cambios/', 'changes'],
];
let total = 0;
for (const loc of ['', 'es/']) {
  for (const theme of ['dark', 'light']) {
    for (const width of [1280, 360]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      await ctx.addInitScript((th) => {
        for (const k of ['botanica', 'botanica-especies', 'botanica-filogenia']) localStorage.setItem(`ic7-tutorial:seen:${k}`, '1');
        localStorage.setItem('theme', th);
      }, theme);
      const page = await ctx.newPage();
      for (const [path, label] of STATES) {
        const [p, q = ''] = path.split('?');
        const url = `${BASE}${loc}${p}${q ? `?${q}` : ''}`;
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        await page.addScriptTag({ content: axeSrc });
        const res = await page.evaluate(async () => {
          // eslint-disable-next-line no-undef
          const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
          return r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        });
        total += res.length;
        console.log(`${res.length ? '✗' : '✓'} ${loc || 'en/'} ${theme} ${width} ${label}${res.length ? '\n    ' + res.join('\n    ') : ''}`);
      }
      await ctx.close();
    }
  }
}
await browser.close();
console.log(total ? `\nAXE FAILED: ${total} violation types` : '\nAXE PASSED');
process.exit(total ? 1 : 0);
