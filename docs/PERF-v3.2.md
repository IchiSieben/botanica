# PERF v3.2 — cold visit, measured live

Tool: `web/scripts/perf-live.mjs` (Playwright Chromium, a fresh context per run, HTTP cache
disabled over CDP, desktop Chrome UA). "Throttled" = Lighthouse-like mobile: 150 ms RTT,
1.6 Mbps down, 750 kbps up, 4× CPU, 412×823. Times are from navigation start. Raw logs and
JSON: `evidence/v3.2/perf-live-*.{txt,json}`.

## Before (v3.1.0 live, 2026-09-26 ~17:40 UTC)

| Run | First species row | Fungi, cold | Fungi, cached | Tree first paint |
|---|---|---|---|---|
| no throttle #1 | **38.1 s** | 0.94 s | 0.12 s | 15.5 s |
| no throttle #2 | 6.3 s | 0.53 s | 0.81 s | 16.8 s |
| mobile throttle | **13.6 s** | 0.92 s | 0.57 s | 8.2 s |

Budgets (cold, throttled): first row < 2.5 s, Fungi cached < 1 s, tree < 2.5 s. All three miss,
the first one by 5×.

### Waterfall, species page, no throttle #1 (the "one minute" visit)

```
     0→   543 ms 403    3 KB  CHALLENGE especies/            (hCDN "Checking your browser")
   572→   899 ms 200    1 KB  /hcdn-cgi/jschallenge
  4563→  5307 ms 200    1 KB  /hcdn-cgi/jschallenge-validate
  5312→  5847 ms 200   14 KB  especies/                     cc=""  hCDN DYNAMIC
  5558→  7330 ms 200    4 KB  _astro/SpeciesBrowser…js      max-age=604800  MISS
  7591→  9485 ms 200   16 KB  _astro/after-paint…js         (static import, one hop later)
  9534→ 37608 ms 200  423 KB  data/species-plantae.json    cc=""  DYNAMIC  br  → 28 s
  9534→ 37074 ms 200   95 KB  data/facets-plantae.json     cc=""  DYNAMIC  br  TTFB 16.9 s
```

Same file, same page, run #2 a few minutes later: `species-plantae.json` 311 KB in 0.4 s.

### What the waterfall shows

1. **The CDN challenge costs 4–5.5 s before any byte of the page.** Every fresh profile gets a
   `403` "Checking your browser before accessing" page, a JS challenge, a ~3 s wait and a reload.
   It hits the **document**, not the JSON: once the challenge cookie is set, `data/*.json` goes
   through (curl without the cookie gets the 403 for JSON too). This is a Hostinger CDN setting
   (hPanel), not code; see HANDOFF "Open questions". Budgets below are reported both from the
   challenged navigation and from the real document request.
2. **The data files are not cacheable, so every cold visit goes to the origin.** `data/*.json`
   has no `Cache-Control`, the CDN marks it `DYNAMIC` (never cached at the edge) and compresses it
   on the fly: the same 1.2 MB file came back as 423 KB in one run and 311 KB in the next
   (different brotli level per request). In run #1 the origin took 16.9 s to first byte for the
   facets and 28 s to stream the index. That is the owner's "close to a minute". `_astro/*`
   (`max-age=604800`) is cached at the edge (`HIT` after the first visitor).
3. **The first row waits for the whole index.** Nothing is drawn until `species-plantae.json`
   (1.2 MB raw) **and** `facets-plantae.json` (450 KB raw) are both downloaded and parsed, and
   the fetch starts only after the first paint (`afterPaint`), two module hops after the HTML.
4. **Then ~3.8 s of main thread at 4× CPU** (throttled run: data done at 9.8 s, first row at
   13.6 s). Node on this machine: JSON parse of both files ~230 ms, and `buildOrder()` sorts the
   21,585 rows three times with `localeCompare` (records ~77 ms, family ~72 ms, year) on every
   kingdom load, even though only one sort is ever shown. ×4 ≈ 1.8 s, plus filters and DOM.
5. **Fungi is not prefetched.** It is small (27 + 8 KB br) and switching costs one round trip to
   the origin plus parse; cold 0.5–0.9 s.
6. **Tree:** HTML → `Tree…js` → `after-paint…js` → `echarts-tree…js` (154 KB br) is a chain of
   three sequential requests after the document, and the ECharts import only starts after the
   first paint and the IntersectionObserver. Throttled: document at 4.7 s (after the challenge),
   ECharts done at 7.4 s, paint 8.2 s → 3.5 s after the real document.

### Levers chosen (only what the evidence supports)

| Evidence | Lever |
|---|---|
| 2 | Content-hashed data file names (`data/species-plantae.<hash>.json`) + `Cache-Control: public, max-age=31536000, immutable` from a `/botanica/.htaccess`, so the CDN can serve them from the edge and return visits skip the network. Unhashed copies stay for old pages mid-deploy. |
| 3 | The first screen of rows (Plants, by name) is rendered into the HTML at build time: the first row paints with the document, no JSON needed. The index loads behind it. |
| 3 | The index fetch starts at script start, not after the first paint (the SSR rows are the paint). |
| 4 | Sort orders are computed on demand (only the active one), with an `Intl.Collator` and an index tie-break (rows are already in name order), not three eager `localeCompare` sorts. |
| 5 | The other kingdom is prefetched when the browser is idle after the first one is ready. |
| 6 | The tree page starts the ECharts chunk download at boot, in parallel with the first paint (the mount still waits for it), and the tree's nav link prefetches the tree page on hover/focus. |

Not used, and why: a Web Worker for parsing (the SSR rows take the first row off the parse path;
a worker would pay a structured clone of the same size back on the main thread); brotli/gzip
headers (already `br` on every file); per-kingdom files (already split).

### A/B while building B1 (local `dist`, Lighthouse mobile, median of 3, same busy machine)

The machine was loaded by other processes (VS Code at ~100 % CPU), so absolute numbers sit
below the v3.1 HANDOFF medians; both sides were measured back to back.

| Page | v3.1 base (`e18bf72`) | B1, fetches at boot | B1 as shipped |
|---|---|---|---|
| `/especies/` | 88 · LCP 1.74 · TBT 122 · CLS 0 | 85 · **LCP 3.73** | **99** · LCP 1.98 · TBT 0 · CLS 0 |
| `/filogenia/` | 91 · LCP 1.84 · TBT 304 · CLS 0.077 | 89 · **LCP 2.80** | **94** · LCP 1.82 · TBT 256 · CLS 0 |
| `/` | 86 · LCP 1.90 · TBT 439 · CLS 0.022 | — | **96** · LCP 1.86 · TBT 183 · CLS 0 |

Starting the index fetch and the ECharts import at boot put them back in the LCP path (the same
result HANDOFF "Tried and failed" records for v2), so both stay behind `afterPaint()`. The
ECharts import now starts right after the paint instead of after the paint *and* the
IntersectionObserver.

## Per item (local `dist`, Lighthouse mobile, median of 3)

The build machine ran at 100 % CPU for the whole session (VS Code processes, not ours), so TBT
and INP swing by hundreds of milliseconds between identical runs. Where a single run looked
like a regression, the item was re-measured **interleaved** with the baseline on the same
machine, and that pair is the number that counts.

| Item | Page | Result | Baseline / note |
|---|---|---|---|
| B2 | `/especies/` | 99 · LCP 1.89 · CLS 0 | B1 99 |
| B2 | `/es/especies/` | 93 · CLS 0.081 | v3.1 same CLS (font swap in the lede) |
| B3 | `/` · `/es/` | 96 · 98 | B1 96 |
| B3 | `/filogenia/` | 93 · CLS 0.073 | intermittent tool-row wrap, also in v3.1; fixed in B5 |
| B5 | `/filogenia/` · `/es/filogenia/` | 96 · 94, CLS 0 | B3 93 |
| B5 | tree order-list tap (INP gate) | median 160 / 128 ms | B3, interleaved: 160 / 104 ms |
| B4 | `/` | 97 | B3 96 |
| B4 | `/es/` | 90 (first run 52, TBT 856) | v3.1, interleaved: 88 |
| B6 | `/especies/` | 99 | B2 99 |
| B6 | `/filogenia/` · `/es/filogenia/` | 98 · 97, CLS 0 | B5 96 · 94 (after stacking the tree header below 600 px: the web font wrapped it after load, CLS 0.055) |
| B6 | `/` · `/es/` | 96 · 98 | v3.1, interleaved: 99 · 94 (TBT 175/120 vs 35/225: each side wins one page; read as noise) |

### Still to measure: live, after the mirror

The budgets of B1 (first species row < 2.5 s, Fungi switch < 1 s cached, tree first paint
< 2.5 s, cold, mobile throttle) are about the live site: the CDN challenge and the origin's
DYNAMIC JSON are not reproducible locally. `node web/scripts/perf-live.mjs
https://<domain>/botanica/ both 3 evidence/v3.2/perf-live-after.json` once the Landing mirror is
pushed (see HANDOFF MIRROR-READY), and whether hCDN now serves `data/*.<hash>.json` with
`immutable` (`x-hcdn-cache-status: HIT` on the second visit).

### Release build (v3.2.0, after the review fixes)

| Page | Perf | LCP | TBT | CLS |
|---|---|---|---|---|
| `/` | 99 | 1.86 | 35 | 0 |
| `/es/` | 99 | 1.87 | 90 | 0 |
| `/especies/` | 99 | 1.83 | 0 | 0 |
| `/filogenia/` | 96 | 1.82 | 196 | 0 |

v3.1 base on the same machine the same day: `/` 86–99, `/especies/` 88, `/filogenia/` 91.
