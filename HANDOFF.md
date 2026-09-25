# HANDOFF — Botánica v2 (explorable atlas)

## Why the plant radial looked sparse (v3.1)

Root cause: `defaultOpen` (scripts/tree.ts, `indexOf`) opens a node only if **at least one of
its children is itself a group rank** (`clade`/`phylum`/`class`, `tree-model.ts` `GROUP_RANKS`).
A node whose children are all `order` stays closed at first paint, drawn as one grey dot.

- **Plants** (`etl/mappings/clades_apg4_ppg1_v1.csv`, 73 orders): the clade hierarchy is
  shallow and lopsided. Root → 4 top clades (Lycophytes, Ferns, Gymnosperms, Angiosperms); only
  Angiosperms has clade children (ANA grade, Magnoliids, Monocots, Eudicots) so it is the only
  one of the 4 that opens; of those 4, only Eudicots has clade children of its own (Superrosids,
  Superasterids) so it is the only one that opens again. Every other clade — Lycophytes (3
  orders), Ferns (11), Gymnosperms (4), ANA grade (1), Magnoliids (4), Monocots (9),
  Superrosids (18), Superasterids (17) — holds only `order` children and stays closed.
  **First-paint node count: 15** (4 top clades + Angiosperms' 4 children + Eudicots' 7
  children), of which only **6 are coloured order dots** (Chloranthales, plus Ranunculales,
  Proteales, Buxales, Gunnerales, Dilleniales under Eudicots); the other 67 of 73 orders sit
  inside 8 closed grey dots.
- **Fungi** (`etl/mappings/fungi_order_ranks_v1.csv`, 136 orders, 8 phyla, 40 classes): every
  phylum's children are classes (a group rank), so **all 8 phyla open by default**, revealing
  **all 40 classes** as first-paint dots (classes themselves stay closed, since their children
  are orders). **First-paint node count: 48** (8 phyla + 40 classes), triple the plant tree's 15,
  none of them coloured (order dots only appear on click).

So the difference is not the data (plants have fewer orders, 73 vs 136, but that is not what a
viewer sees), the initial zoom/fit, or radial label culling (labels are truncated at a fixed
108 px width in both, no nodes are hidden by layout) — it is that `defaultOpen`'s one-hop rule
happens to cascade two levels deep for fungi (phylum → class, uniform) and mostly one level or
less for plants (most clades contain orders directly, only the Angiosperms → Eudicots spine
cascades). Confirmed by reading the CSVs directly (`cut -d, -f2 clades_apg4_ppg1_v1.csv | sort
-u | uniq -c`, `cut -d, -f2,3 fungi_order_ranks_v1.csv | sort -u | wc -l`), not by eyeballing
the render. This does not change with the sunburst (angle is proportional to species count
regardless of open/closed state, so the plant sunburst reads full even where the old radial
looked empty) — recorded here because SPEC asks for the explanation before radial is removed.


## v3.0.0 LIVE (2026-09-25 03:18 UTC) — contract: SPEC.md
- https://ichisieben.dev/botanica/ · /es/ · /botanica/cambios/ · /botanica/es/cambios/
- Botanica `5de89ac` = tag **v3.0.0** (also v1.0.0 → 1b97936, v2.0.0 → 04e07e8; annotated, pushed).
  Landing `26d4253` mirrors it; Hostinger build `01a0d691-1c23-7080-9273-e712c27836ab` completed.
- **Dossier `docs/RESEARCH-PERU.md` NOT FOUND** (disk, Drive by name and full text, Gmail, Notion).
  Partial: item 1 ships own-data facts only (no dossier facts, no 1777 anchor); item 10 ships without
  `ROADMAP.md`. Both land when the dossier exists (SPEC "Out of scope").
- Item 4, Loreto 7,905 → 5,821: since v2 a species counts in a department only if it is in the WCVP
  checklist for Peru AND has a GBIF record there; v1 counted every GBIF name (AUDIT-v2 §2). The KPI
  now reads "species with GBIF records in <dep>" and says so beside the number.
- Gates (local, 4400): `npm test` 17/17 · `npm run gate` · `npm run gate:v3` (intro, explorer, tree,
  changes) · `npm run check:dois` 8/8 · astro check 0. `gate.mjs` waits on `[data-explorer]
  [data-painted]` (render yields a frame for INP, so the URL runs one frame ahead of the DOM).
- Lighthouse mobile, median of 3 (local): perf 96–100 on /, ?dep=LORETO, especies, filogenia, cambios
  (EN+ES); a11y 96–100; BP/SEO 100. CLS ?dep=LORETO 0.047 (the treemap re-layout; was 0.085 before
  preloading JetBrains Mono and keeping the map hint's line).
- Live smoke 62/62 (under the real CSP, cache-busted): v2 checks + IPNI protologue link in the drawer,
  /cambios/ with 3 sections and 3 tag links, hostile `?dep=` inert, fungi tree mounts after a click.
  Live HTML == Landing `dist` by sha256 (the Landing build strips comments, so it differs from
  `web/dist`; JSON and tutorial files match `web/dist`).
- axe dark (WCAG 2 A/AA), live, 1280 + 360, EN + ES, 56 states (v2 states + intro scrolled, map
  zoomed, tree expanded, /cambios/, light theme): 0 violations. Two script flags are not defects: the
  pixel sampler reads 1.69:1 on the pressed "species" button with the map zoomed (a screenshot shows
  no overlap, `.map-vp` clips), and "LIGHT!" is the light-theme state asserting dark on purpose.
- Reviewer (Opus, read-only, f8aacb6..642cc40): 12 findings, all applied in `5de89ac` — incl. a script
  injection via `?dep=` (now whitelisted + escaped), a blank fungi tree after a kingdom switch, and
  `/es/cambios/` rendering raw markdown. Regression checks added to the gates.
- Known, not fixed: the tree's ECharts canvas is not axe-checkable; `window.__phylo` ships as a test
  hook (read-only); the tree lede still says "órdenes y familias" although clades now show; the fungi
  source line lives in the legend slot (CSS swaps it by `data-k`); the drawer rebuilds `#dr-body`
  with innerHTML, so session B must render the photo inside that template, not append to
  `[data-photo-slot]` after the fact. `Portfolio/shared/changelog/` is not under git (like
  `shared/tutorial`): the vendored copy in `web/src/lib/changelog/` is the versioned one.

## v2 LIVE (2026-09-24)
- https://ichisieben.dev/botanica/ (EN) · https://ichisieben.dev/botanica/es/ (ES)
- Botanica `04e07e8` (site + canonical + AA treemap ink), mirrored by Landing `43fb9bc`
  (git auto-deploy, Hostinger build `01a0d597-a573-73f7-8fc5-41284b18b9d7` completed 22:45 UTC).
- Live smoke, cache-busted, under the real CSP: 44/44 — every page 200, 0 console errors,
  0 CSP violations, 0 HTTP ≥ 400, fonts 2/2 same-origin, map click (LORETO) changes KPIs +
  families + years, search → drawer, EN↔ES switch keeps `?dep=`, 0 px overflow at 360 (strict
  viewport) on all 6 pages. Canonical/hreflang live point at ichisieben.dev/botanica/ and /es/.
- axe dark (WCAG 2 A/AA), live, 1280 + 360, EN + ES: 0 violations on first paint AND in the states
  people use: tour open (explore, tree), drawer (`?sp=`), `?dep=LORETO&fam=Orchidaceae`, zero rows
  (`?dep=TUMBES&y0=2010&y1=2019`), `?k=fungi` (+ dep), species page pick, tree with an order selected.
  axe `incomplete` nodes were pixel-sampled (text hidden, viewport screenshot, only nodes visible by
  hit-test): worst 4.51:1 (drawer ✕ `#dr-close`). Not checked: the ECharts canvas on the tree page.
- Cache: HTML and `data/*.json` have no Cache-Control (hCDN `DYNAMIC` + ETag); the new version showed
  without a bust and every unhashed file matched `dist` by sha256 after deploy. `_astro/*`, `tutorial/*`
  and `favicon.svg` get `max-age=604800` — fine for hashed `_astro`, but a changed `tutorial/*` could
  stay stale up to 7 days for returning visitors. If stale JSON is ever seen, the fix is a narrow
  `<If "%{REQUEST_URI} =~ m#^/botanica/(data/|tutorial/|.*\.html$|.*/$)#">Header set Cache-Control "no-cache"</If>`
  in the landing's `.htaccess` (not added: no evidence of staleness).
- Live testing gotcha: after many headless runs, Hostinger's CDN answers headless Chromium's first
  document request with a 403 challenge and reloads ~3.5 s later (curl, even with a HeadlessChrome UA,
  gets 200; real users are not affected). A test that clicks right after `networkidle` can land on the
  reloaded, not-yet-booted page — wait until `performance.now() > 2500` before interacting.
- Privacy sweep of the mirror (`sis|ogti|gob.pe|ghp_|github_pat_|AKIA|yoichi@`): only botanical
  names (Sisymbrium, Sistotremataceae).
- Redeploy: `cd web && npm run build`, replace `Landing/public/botanica/` with `web/dist/`
  (git rm + copy, check tracked = on disk), push the Landing.

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
- hreflang en/es/x-default and a per-locale canonical are absolute, built from `site` in astro.config
  (`https://ichisieben.dev` since `04e07e8`).
- Treemap tile ink is black or white, whichever contrasts more with the fill (was a fixed luminance cut
  with near-black/near-white inks: the palette's #4E79A7 failed AA with both). Dark axe 26 → 0.

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
cambios/index.html             EN changelog (v3; from CHANGELOG.md + git tags)
es/cambios/index.html          ES changelog (from CHANGELOG.es.md)
fungi/index.html               redirect stub → ?k=fungi (keeps old links alive)
favicon.svg
_astro/*                       18 hashed JS/CSS/font files (self-hosted fonts, no Google Fonts)
data/facets-plantae.json       fetched by the explorer (98 KB gz)
data/facets-fungi.json
data/species-plantae.json      fetched on search / species page
data/species-fungi.json
data/protologue-plantae.json   fetched when the species drawer opens (v3: IPNI id + authors)
data/peru_departamentos.geojson  build-time only; not fetched, safe to omit
tutorial/tutorial.js · tutorial.css · (library, byte-identical to radar-precios)
```

`.htaccess`: **no change needed.** The landing's CSP already allows everything used: inline scripts
('unsafe-inline' is present), same-origin fetches (`connect-src 'self'`), self-hosted fonts. No external
image or API. Directory URLs (`/botanica/es/`) resolve to `index.html` with Apache's defaults.

## Open questions (for the owner)
- None. (The ES card now links `/botanica/es/`, done in Landing `43fb9bc`.)
- hreflang URLs use the placeholder `site` (`atlas-botanico.example`) from astro.config; set it with the
  real domain (brief §9.1). The landing card says `ichisieben.dev`.
- Dark-theme contrast was not audited by Lighthouse (it runs light); tokens are the landing's.
