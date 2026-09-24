# HANDOFF — Botánica v2 (explorable atlas)

Unattended run started 2026-09-24. Brief: "from static atlas to an explorable one"
(phases 0–4 + close). Baseline commit `1b97936`.

## State
- [x] Phase 0 · audit → `docs/AUDIT-v2.md`
- [x] Phase 1 · architecture (store + URL, facets, no ECharts on `/`)
- [x] Phase 2 · interactions (map/legend/compare, search→drawer→map, tree→filter, years brush+play, Plantae↔Fungi, tours)
- [x] Phase 3 · identity + mobile (landing tokens/fonts/theme, 360 px, 44 px targets, LCP < 2.0 s, INP < 200 ms)
- [x] Phase 4 · i18n EN/ES (EN at root, ES under /es/, same slugs)
- [x] Close · MIRROR-READY, reviewer (Opus, read-only; findings below)

## Decisions (one line each)
- Spanish numbers group with a narrow no-break space (21 585), matching the repo's Spanish text,
  instead of es-PE's comma.
- Records / coverage map metrics are disabled while a taxon or year filter is on: records are
  per-occurrence and can't be filtered by species attributes (said in the UI).
- Crossfilter convention: each view counts species passing every filter except its own.
- Species counts come from the WCVP checklist (facets), not from all GBIF names, so map = KPIs.
  LORETO drops 7 905 → 5 821 on the map. Records (effort) are unchanged. See AUDIT §2.
- Year axis = **year described**: WCVP `first_published` of the basionym when there is one (original
  description), else of the accepted name. Plantae only. Median moves ~1948 → ~1922 across WCVP; before
  this, 31 % of Peru's plant species were dated by a later transfer to another genus (reviewer finding).
- Facet export aligned row by row with `species-*.json`, no names (98 KB gz); names are lazy-loaded
  on first search focus.
- Species index export made deterministic (tie-break by department name).
- Explorer without ECharts: build-time SVG map + HTML bars/treemap.
  Option B (keep ECharts for everything) was rejected: 171 KB gz shared chunk + ~55 KB per chart,
  canvas targets can't take keyboard focus, and it doesn't reflow to lists at 360 px.
- No Preact/React: a ~60-line store + vanilla views is enough; ECharts (tree page) is imperative anyway.
- Fonts: the landing's Space Grotesk + JetBrains Mono, self-hosted via fontsource (removes Google Fonts).
- Theme: `.light` class on `<html>`, `localStorage.theme` — the same key as the landing, on the same
  origin, so the theme carries over from the landing.

- i18n: EN unprefixed, ES under `/es/`, page slugs kept (`especies/`, `filogenia/`) so existing links
  keep working. Pages are thin wrappers over `src/page-views/*`.
- Language order: `?lang=` (remembered in `ic7.lang`) → `/es/` path → stored choice → navigator.language.
  Only unprefixed pages auto-redirect; `/es/` never does, so there is no loop. Query and hash survive.
- Language switch is one 44 px link naming the other language (fits the 360 px header).
- hreflang en/es/x-default are absolute, built from `site` in astro.config (still a placeholder domain,
  brief §9.1). No canonical until the domain is real.

- Deferred work (data fetches, ECharts mount, tour) starts after the first `largest-contentful-paint`
  entry, fetches at `priority: 'low'` (see `web/src/lib/after-paint.ts` for the measured options).
- The explorer yields one frame before recomputing views, so the tap's own feedback paints first
  (map tap INP 288 → 88 ms at 4x CPU).
- Light-theme contrast: tour accent uses `--accent-strong`, the tour's "next" ink is `--bg` (overrides
  in this demo's Tutorial.astro, the library is untouched), pressed buttons use a lighter tint, and
  zero rows dim only their text.
- Decade columns stay ~10 px wide at 360 px (28 decades). Lighthouse flags target-size; the From/To
  selects beside them are the equivalent control (WCAG 2.5.8 "equivalent" exception).

## Measurements (Lighthouse mobile, median of 3)
| Page | Baseline 1b97936 | Phase 1 |
|---|---|---|
| `/` | 63 · LCP 4.20 · TBT 604 · 336 KB | 98 · LCP 2.28 · TBT 0 · 206 KB |
| `/especies/` | 79 · LCP 3.73 · 412 KB | 83 · LCP 3.17 · 388 KB (CLS 0.205, fix in Phase 3) |
| `/filogenia/` | 64 · LCP 4.16 · TBT 434 · 296 KB | 80 · LCP 3.06 · TBT 185 · 229 KB |
| `/filogenia/` after tree coordination | | 89 · LCP 2.78 · TBT 344 · 251 KB (facets fetched only on first selection) |
| `/especies/` after shared state | | 92 · LCP 3.19 · TBT 0 · CLS 0 · 394 KB |

After Phase 4 (EN at root, ES under /es/):

| Page | EN | ES |
|---|---|---|
| explore | 97 · LCP 2.43 · TBT 0 · 208 KB | 97 · LCP 2.31 · 209 KB |
| species | 93 · LCP 3.18 · CLS 0 · 394 KB | 93 · LCP 3.18 · 394 KB |
| tree | 93 · LCP 2.58 · TBT 188 · 252 KB | 88 · LCP 2.64 · TBT 315 · 253 KB |

After Phase 3 (median of 5):

| Page | EN | ES |
|---|---|---|
| explore | 99 · a11y 96 · LCP 1.84 · TBT 0 · 209 KB | 99 · LCP 1.82 |
| species | 100 · a11y 100 · LCP 1.52 · 395 KB | 100 · LCP 1.52 |
| tree | 95 · a11y 100 · LCP 1.68 · TBT 188 · 253 KB | 96 · LCP 1.68 · TBT 182 |

INP at 4x CPU (gate): map tap 64 · family 24 · search keys 48 · decade 32 · tree 72 · species keys 80 ms.
Every page is lighter than baseline: 336→209, 412→395, 296→253 KB.

## Gates tooling
- `node web/scripts/serve.mjs <dir> <port>` — serves `<dir>` at `/botanica/` with gzip.
- `CHROME_PATH=<playwright chromium> RUNS=3 node web/scripts/lighthouse.mjs <port> <out>` — median of 3.
- `npm test` (web/) — unfiltered client aggregates == ETL marts, crossfilter, URL round-trip.
- `npm run gate` (web/, needs `npm run serve`) — console errors per page and locale, 360 px overflow
  (strict viewport), 44 px touch targets (touch emulation), every tour target resolves, and
  interactions: map → KPIs/families/years, family → map, Back, search → drawer → map, decade → map,
  fungi → explicit "not available", tree → department view; language: ?lang=, stored
  choice, switch keeps filters, no bounce, es-PE browser → /es/, /es/ never redirects;
  INP with CDP 4x CPU on map tap, family tap, decade tap, search keystrokes, tree tap, species keystrokes. Env: `LOCALES`, `ROOT_LOCALE`, `TREE=0`.
- CHROME_PATH used here: `%LOCALAPPDATA%\ms-playwright\chromium-1243\chrome-win64\chrome.exe`.

## Tried and failed
- LCP: deferring the species index to one frame after boot, or to load + idle, or low priority alone:
  no change (3.2 s). Low priority + after load: 1.5–3.1 s, a race with Chrome's first paint. Fixed by
  waiting for the first LCP entry.
- Deferring the species index fetch until `document.fonts.ready` to speed up the lede's LCP: 3.18 vs 3.19 s, no gain, reverted.
- Douglas–Peucker on closed GeoJSON rings: zero-length baseline, every path collapsed. Seed with the farthest point.
- Measuring 360 px overflow under Playwright mobile emulation: Chrome widens the layout viewport and hides
  the overflow. The gate measures overflow in a strict viewport, touch targets under emulation.
- The "other families" tail as a treemap tile took a third of the area; it is now a caption.

## Reviewer findings (Opus, read-only, over 1b97936..HEAD)
Applied:
1. Cross-kingdom search lost the species (store reset applied after the patch) → reset first, gate covers it.
2. Year described used the accepted name, not the basionym → ETL fixed, note in EN/ES updated.
3. Play timer kept writing after kingdom/clear/Back → any change the timer did not make stops it.
4. Legend click before data threw → guarded.
5. Shared links showed national numbers until data landed → `.is-stale` dims KPIs and grid until the first paint.
6. Fungi with no family produced a "—" tile filtering to zero → excluded from family rankings.
7. Species page lost keyboard focus on pick → only aria-pressed flips.
8. With storage blocked, the switch could bounce back to ES → switch also carries `?lang=`.
9. Tree leaked a ResizeObserver per re-mount → disconnected with the chart; failed facet fetch no longer cached.
10. Records shown next to filtered species counts → hidden while a taxon/year filter is on.
11. `../` links broke without trailing slash → built from BASE_URL + locale.
Not applied: `esc` and the species-detail HTML are duplicated across explorer / species page (refactor
not asked for; small, noted here).

## MIRROR-READY

Build: `cd web && npm run build` → mirror **`Botanica/web/dist/`** into `Landing/public/botanica/`
(replace the folder's contents; old `_astro/*` hashes are no longer referenced).

```
index.html                     EN explorer
es/index.html                  ES explorer
especies/index.html            EN species finder
es/especies/index.html         ES species finder
filogenia/index.html           EN tree
es/filogenia/index.html        ES tree
fungi/index.html               redirect stub → ?k=fungi (keeps old links alive)
favicon.svg
_astro/*                       17 hashed JS/CSS/font files (self-hosted fonts, no Google Fonts)
data/facets-plantae.json       fetched by the explorer (98 KB gz)
data/facets-fungi.json
data/species-plantae.json      fetched on search / species page
data/species-fungi.json
data/peru_departamentos.geojson  build-time only; not fetched, safe to omit
tutorial/tutorial.js · tutorial.css · (library, byte-identical to radar-precios)
```

`.htaccess`: **no change needed.** The landing's CSP already allows everything used: inline scripts
('unsafe-inline' is present), same-origin fetches (`connect-src 'self'`), self-hosted fonts. No external
image or API. Directory URLs (`/botanica/es/`) resolve to `index.html` with Apache's defaults.

## Open questions (for the owner)
- The landing's ES project card links `/botanica/`; the demo then picks EN or ES from the browser
  language. To send ES readers straight to Spanish, change `demoUrl`/`localPath` in
  `Landing/src/content/projects/es/botanica.md` to `/botanica/es/` (not done: Landing is read-only here).
- hreflang URLs use the placeholder `site` (`atlas-botanico.example`) from astro.config; set it with the
  real domain (brief §9.1). The landing card says `ichisieben.dev`.
- Dark-theme contrast was not audited by Lighthouse (it runs light); tokens are the landing's.
