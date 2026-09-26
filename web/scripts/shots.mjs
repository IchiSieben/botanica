// Screenshots for the v3.2 evidence: pages × widths × themes, plus 360 px overflow.
//
//   node scripts/shots.mjs <port> <outDir> <name>=<path>[@<action>] ...
//   actions: pick (click the 3rd species row), grid (grid view), fungi
//   e.g. node scripts/shots.mjs 4400 ../evidence/v3.2 species=especies/ species-pick=especies/@pick
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [port = '4400', out = 'shots', ...specs] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const WIDTHS = (process.env.WIDTHS ?? '1440,1024,390').split(',').map(Number);
const THEMES = (process.env.THEMES ?? 'light,dark').split(',');
const HEIGHT = Number(process.env.HEIGHT ?? 900);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
let bad = 0;
for (const spec of specs) {
  const [name, rest] = spec.split('=');
  const [path, action] = rest.split('@');
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: width <= 400 ? 844 : HEIGHT }, colorScheme: theme, deviceScaleFactor: 1 });
      await ctx.addInitScript((th) => {
        for (const k of ['botanica', 'botanica-especies', 'botanica-filogenia']) localStorage.setItem(`ic7-tutorial:seen:${k}`, '1');
        localStorage.setItem('theme', th);
      }, theme);
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${port}/botanica/${path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      if (action === 'pick') { await page.click('#sp-viewport [data-i]:nth-child(3)'); await page.waitForTimeout(600); }
      if (action === 'grid') { await page.click('[data-view="grid"]'); await page.waitForTimeout(400); }
      if (action === 'fungi') { await page.click('[data-kingdom="fungi"]'); await page.waitForTimeout(800); }
      if (process.env.SCROLL) { await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), process.env.SCROLL); await page.waitForTimeout(400); }
      const file = `${out}/${name}-${width}-${theme}.png`;
      await page.screenshot({ path: file, fullPage: !!process.env.FULL });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) { bad++; console.log(`✗ ${file}: ${over}px horizontal overflow`); } else console.log(`✓ ${file}`);
      await ctx.close();
    }
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
