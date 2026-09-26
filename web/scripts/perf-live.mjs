// Cold-visit waterfall (v3.2 B1). Fresh browser context per run, HTTP cache
// disabled over CDP, optional Lighthouse-like mobile throttling (150 ms RTT,
// 1.6 Mbps down, 750 kbps up, 4x CPU).
//
// Measures, from navigation start:
//   species  → first `#sp-viewport [data-i]` row, then the Fungi toggle → first fungi row
//   tree     → first `[data-ready] canvas` of the tree
// and logs every request: status, encoded bytes, content-encoding, cache-control,
// TTFB, and whether it was the CDN's "Checking your browser" challenge.
//
//   node scripts/perf-live.mjs <base-url> [throttle=both|on|off] [runs=1] [out.json]
//   e.g. node scripts/perf-live.mjs https://ichisieben.dev/botanica/ both 2 perf.json
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'https://ichisieben.dev/botanica/';
const MODE = process.argv[3] ?? 'both';
const RUNS = Number(process.argv[4] ?? 1);
const OUT = process.argv[5];
const modes = MODE === 'both' ? [false, true] : [MODE === 'on'];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function run(path, throttle, script) {
  const ctx = await browser.newContext({
    viewport: throttle ? { width: 412, height: 823 } : { width: 1440, height: 900 },
    // A desktop Chrome UA. The CDN challenge still fires (curl with this UA gets it too).
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });
  await ctx.addInitScript(() => {
    for (const k of ['botanica-especies', 'botanica-filogenia', 'botanica']) localStorage.setItem(`ic7-tutorial:seen:${k}`, '1');
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (throttle) {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const reqs = new Map();
  let t0 = null;
  cdp.on('Network.requestWillBeSent', (e) => {
    t0 ??= e.timestamp;
    reqs.set(e.requestId, { url: e.request.url, start: e.timestamp, redirectFrom: e.redirectResponse?.status });
  });
  cdp.on('Network.responseReceived', (e) => {
    const r = reqs.get(e.requestId); if (!r) return;
    const h = Object.fromEntries(Object.entries(e.response.headers).map(([k, v]) => [k.toLowerCase(), v]));
    r.status = e.response.status;
    r.enc = h['content-encoding'] ?? '';
    r.cc = h['cache-control'] ?? '';
    r.type = (h['content-type'] ?? '').split(';')[0];
    r.ttfb = Math.round((e.response.timing?.receiveHeadersEnd ?? 0) - (e.response.timing?.sendStart ?? 0));
    r.proto = e.response.protocol;
    r.cdn = h['x-hcdn-cache-status'] ?? h['x-litespeed-cache'] ?? h['x-cache'] ?? '';
    r.len = h['content-length'] ?? '';
  });
  cdp.on('Network.loadingFinished', (e) => {
    const r = reqs.get(e.requestId); if (!r) return;
    r.bytes = e.encodedDataLength; r.end = e.timestamp;
  });
  const t = await script(page, BASE + path);
  const doc = [...reqs.values()].find((r) => r.url === BASE + path && r.status === 200);
  if (doc && t0 != null) t.docStartMs = Math.round((doc.start - t0) * 1000);
  await page.waitForTimeout(300);
  const list = [...reqs.values()].map((r) => ({
    url: r.url.replace(BASE, ''), status: r.status, bytes: r.bytes, enc: r.enc, cc: r.cc, type: r.type, ttfb: r.ttfb, proto: r.proto, cdn: r.cdn,
    startMs: Math.round((r.start - t0) * 1000), endMs: r.end ? Math.round((r.end - t0) * 1000) : null,
    challenge: r.status === 403,
  }));
  await ctx.close();
  return { path, throttle, ...t, requests: list };
}

const firstName = (page) => page.evaluate(() => document.querySelector('#sp-viewport [data-i] .sci')?.textContent ?? null);
// "Usable": the count shows a number, i.e. the index is parsed and search/sort/filters work.
const usable = () => /^\d/.test(document.getElementById('sp-count')?.textContent ?? '');
const species = async (page, url) => {
  const t = {};
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForSelector('#sp-viewport [data-i]', { timeout: 180_000 });
  t.firstRowMs = Date.now() - t0;
  await page.waitForFunction(usable, null, { timeout: 180_000 });
  t.usableMs = Date.now() - t0;
  const plantFirst = await firstName(page);
  // A fungus row must replace the plant rows: `dataset.sk` flips before the data lands.
  const switched = (prev) => document.documentElement.dataset.sk === 'fungi'
    && /^\d/.test(document.getElementById('sp-count')?.textContent ?? '')
    && document.querySelector('#sp-viewport [data-i] .sci')?.textContent !== prev;
  const t1 = Date.now();
  await page.click('[data-kingdom="fungi"]');
  await page.waitForFunction(switched, plantFirst, { timeout: 180_000 });
  t.fungiColdMs = Date.now() - t1;
  const fungiFirst = await firstName(page);
  await page.click('[data-kingdom="plantae"]');
  await page.waitForFunction((prev) => document.documentElement.dataset.sk === 'plantae'
    && document.querySelector('#sp-viewport [data-i] .sci')?.textContent !== prev, fungiFirst);
  const t2 = Date.now();
  await page.click('[data-kingdom="fungi"]');
  await page.waitForFunction(switched, plantFirst);
  t.fungiWarmMs = Date.now() - t2;
  return t;
};

const tree = async (page, url) => {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForSelector('[data-ready="1"] canvas', { timeout: 180_000, state: 'attached' });
  return { treePaintMs: Date.now() - t0 };
};

const results = [];
for (const throttle of modes) {
  for (let i = 0; i < RUNS; i++) {
    for (const [p, s] of [['especies/', species], ['filogenia/', tree]]) {
      try {
        const r = await run(p, throttle, s);
        results.push(r);
        const nums = Object.entries(r).filter(([k, v]) => typeof v === 'number').map(([k, v]) => `${k}=${v}`).join(' ');
        console.log(`\n## ${p} throttle=${throttle} run=${i + 1}: ${nums}`);
        for (const q of r.requests) {
          console.log(`  ${String(q.startMs).padStart(6)}→${String(q.endMs ?? '-').padStart(6)} ms ${q.status ?? '---'} ${String(q.bytes ?? '').padStart(8)} B ttfb=${q.ttfb ?? '-'} ${q.enc || 'identity'} ${q.proto ?? ''} cc="${q.cc}" cdn=${q.cdn || '-'}${q.challenge ? ' CHALLENGE' : ''} ${q.url.slice(0, 80)}`);
        }
      } catch (e) {
        console.log(`\n## ${p} throttle=${throttle} run=${i + 1}: FAILED ${e.message.split('\n')[0]}`);
        results.push({ path: p, throttle, error: e.message });
      }
    }
  }
}
if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2));
await browser.close();
