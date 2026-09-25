// Lighthouse mobile over every page of a served build, median of N runs per page
// (single runs swing +-5 points; the gate compares medians).
//
//   RUNS=3 node scripts/lighthouse.mjs <port> <outDir> [page ...]
//
// Set CHROME_PATH to Playwright's Chromium so no system Chrome is needed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [port = '4400', out = 'lh', ...rest] = process.argv.slice(2);
const pages = rest.length ? rest : ['', 'fungi/', 'especies/', 'filogenia/'];
const RUNS = Number(process.env.RUNS ?? 3);
mkdirSync(out, { recursive: true });

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function once(url, file) {
  // Chrome on Windows sometimes fails to launch (temp-profile lock): retry twice.
  for (let attempt = 0; ; attempt++) {
    try {
      run(url, file);
      break;
    } catch (e) {
      if (attempt >= 2) throw e;
    }
  }
  return read(file);
}

function run(url, file) {
  const t0 = Date.now();
  try {
    lighthouse(url, file);
  } catch (e) {
    // On Windows chrome-launcher can fail to delete its temp profile (EBUSY) AFTER the report
    // was written: the run itself succeeded, so keep a report written by this attempt.
    if (!(existsSync(file) && statSync(file).mtimeMs >= t0)) throw e;
  }
}

function lighthouse(url, file) {
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['-y', 'lighthouse@12', url, '--quiet', '--output=json', `--output-path=${file}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--chrome-flags="--headless=new --no-sandbox"'],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
}

function read(file) {
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const a = r.audits;
  return {
    perf: Math.round(r.categories.performance.score * 100),
    a11y: Math.round(r.categories.accessibility.score * 100),
    bp: Math.round(r.categories['best-practices'].score * 100),
    seo: Math.round(r.categories.seo.score * 100),
    lcp: +(a['largest-contentful-paint'].numericValue / 1000).toFixed(2),
    tbt: Math.round(a['total-blocking-time'].numericValue),
    cls: +a['cumulative-layout-shift'].numericValue.toFixed(3),
    kb: Math.round(a['total-byte-weight'].numericValue / 1024),
  };
}

const rows = [];
for (const page of pages) {
  const url = `http://localhost:${port}/botanica/${page}`;
  const slug = page.replace(/\W+/g, '_') || 'index';
  const runs = Array.from({ length: RUNS }, (_, i) => once(url, join(out, `${slug}.${i}.json`)));
  const row = { page: `/${page}` };
  for (const k of Object.keys(runs[0])) row[k] = median(runs.map((r) => r[k]));
  rows.push(row);
}
console.table(rows);
writeFileSync(join(out, 'summary.json'), JSON.stringify(rows, null, 2));
