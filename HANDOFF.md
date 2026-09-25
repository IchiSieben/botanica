# HANDOFF — Botánica (explorable atlas) · current: v3.1.0

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


## v3.1.0 — release state (2026-09-25) — contract: SPEC.md (v3.1)

**LIVE (2026-09-25 09:40 UTC).** Landing `367c20d` mirrors tag v3.1.0 (`web/dist` from
`f70542c`, 38 tracked = 38 on disk); `7d62b0d` allowlists the public `.gob.pe` sources the intro
cites (SERNANP, MINCETUR, BNP) in Landing's public-audit. Hostinger build
`01a0d7ef-10ad-707d-ba75-791e7eb22539` completed. Landing pre-push: build + public-audit 0,
check 0 errors, linkcheck 0, i18n-leaks 0, smoke 0 errors / 11 routes. Live smoke 72/72 (v3 checks
+ question bar, `/cambios/` v3.1.0, `?view=radial` → sunburst, species grid, drawer POWO/GBIF/IPNI,
photo/threat slots). Live axe dark, 72 states: 0 violations. XSS probe live: 0 hits (9 params × 5
pages + `sort`/`view`/`q`/`end` × 3 pages). Live files == Landing `dist` (modulo CRLF of a Windows
checkout); every non-HTML file byte-identical to `web/dist`.
The mirror was committed from a separate Landing worktree because another session had
uncommitted gallery work in `Landing/`; that working tree was not touched.

Items 0–4 delivered on main; worktrees for each item merged and removed (`git worktree list`
shows only main). Release commit tagged **v3.1.0** (see "LIVE" below once deployed).

- **Item 0 (dossier):** 10 intro facts (4 own-data, 6 from `docs/RESEARCH-PERU.md`, each with its
  source) and a 12-row timeline 1777 → 2026. `ROADMAP.md` from dossier §5. **Excluded on purpose**
  (dossier marks them ⚠️ or unverifiable): facts #4, #10, #12, the Humboldt 1802 row, the Brack
  year; 1753 dropped as out of scope for Peru. URL check: 53/56 resolve; BHL `bibliography/194092`
  and iNaturalist answer 403 to bots, Conosur only over http. Brako & Zarucchi cited via archive.org.
- **Item 1 (filter clarity):** question bar, zero-results state with per-filter "without X → n",
  crossfilter note per chart, compositor-only flash on changed panels, department detail families
  from the same filtered set (`facets.ts familyCounts`), rescale note in the map legend, tour step.
- **Item 2 (tree):** linear default, zoomable sunburst (radial retired, `?view=radial` → sunburst),
  lazy 3D (see sections below), clade-aware lede, one-glance layout at 1440×900.
- **Item 3 (species):** virtual list/grid, sort, endemic/department/family filters; drawer with
  mini map, year-described position, same-genus, IPNI/GBIF/POWO links, photo + threat slots
  inside the render template (`src/lib/drawer.ts`) for session B.
- **Toggle bug (item 3):** NOT reproducible as a count bug — `#sp-count` and the explorer KPIs
  already followed the kingdom. What stayed frozen was the species page **lede**, which had both
  kingdoms' numbers typed into i18n. Fixed (`f6c6094`): kingdom-aware lede, numbers from
  `mart_kpis`.
- **Item 4:** `window.__phylo` only in the `PUBLIC_TEST_HOOKS=1` build (`dist-test/`, 0 hits in
  `dist/`); `scripts/gate-pinch.mjs` (CDP touch + synthetic pointer replay for one-finger lift).
- **Reviewer (Opus, read-only, v3.1 diff):** 12 findings, no high severity, security pass. All
  applied (`2b37efc`, `f70542c`): species Enter crash, filter dropdowns after populate, keyboard
  focus/active row, `aria-rowcount`, dossier wording (ANP/ACR/ACP, "thought to remain
  undescribed"), false panel flashes + forced reflow, 3D mount race + `attachResize`, 3D render
  on demand + material disposal + `forceContextLoss`, expedition dated 1777–1788, v3.1.0 in the
  releases fact, deterministic `ORDER BY` for accepted IPNI ids (ETL re-run: exports byte-identical).
- **Gates (local, quiet machine):** `astro check` 0 errors (tsconfig now excludes `dist-test`,
  whose bundles crashed the checker's heap) · `npm test` all pass · `check:dois` 13/13 ·
  intro, explorer, tree (4401), changes, pinch, clarity, species, `npm run gate`: all pass ·
  axe dark 1280+360 EN+ES: 0 violations (only the two known script flags).
- **Lighthouse mobile, median of 3 (local `dist`, 4400):** perf / a11y / LCP / TBT / CLS —
  `/` 98/97/1.88 s/103/0 · `?dep=LORETO` 99/97/1.86/90/0.047 · `especies` 99/100/1.78/28/0 ·
  `filogenia` 96/100/1.71/184/0.077 · `cambios` 99/96/1.39/4/0 · `es/` 98/97/1.83/93/0 ·
  `es/?dep=LORETO` 97/97/1.86/145/0.047 · `es/especies` 97/100/1.83/48/0.081 ·
  `es/filogenia` 93/100/1.68/273/0.075 · `es/cambios` 100/96/1.38/36/0. BP and SEO 100 everywhere.
  `es/especies` CLS 0.081 vs 0 in EN: not investigated, under the 0.1 budget.
- **Measurement hygiene:** an orphaned `find / -iname *research*peru*` from the v3-A dossier
  search ran ~4 h at ~65 % CPU (stopped by PID). Earlier Lighthouse tries in this session showed
  `?dep=LORETO` at 47–89 with a 41 s "last visual change": contention (that `find`, other
  sessions' Python jobs, my own probes), not code. Clean single run: 95 with last visual change 2.35 s.
  `scripts/lighthouse.mjs` now keeps a report written before chrome-launcher's EBUSY cleanup error.
  From Git Bash, page args get MSYS path mangling (`/` → `C:/Program Files/Git/`): run it from PowerShell.
- **Agent INP flakiness:** the item agents saw INP failures in `gate.mjs` while 4 worktrees built
  and tested at once. On main with a quiet machine it passes (search keystrokes ~40 ms). Machine
  contention, not code; the 700 ms numbers recorded by the tree agent are not a regression.

### Open items / known gaps
- **COL XR backbone migration** (dossier §0): out of scope for v3.1; the atlas still uses WCVP as
  backbone for plants. Decide before v4.
- **Photos and threat status** (session B): slots exist in the drawer template, no data yet.
- **`ATLAS_DUCKDB_PATH`** (`etl/config.py`) redirects every ETL script, including the ones that
  WRITE to the DuckDB file — pointing it at a copy for a read-only run is safe, pointing it at
  another project's DB is not.
- The tree's canvases (ECharts, WebGL) are not axe-checkable; the orders list and bars are the
  accessible path.
- `?view=` is read at boot, not written back to the URL.
- 3D chunk: 547 KB raw / 137 KB gzip, only fetched on opt-in at tier ≥ 2 without reduced motion.

## window.__phylo (test hook) — v3.1

Gated behind `import.meta.env.PUBLIC_TEST_HOOKS` (`web/src/scripts/tree.ts`, the very last lines
of `bootTree()`): the whole hook-building block is behind an early `return` when that env var is
falsy. `npm run build` (production, `dist/`) never sets it, so the hook does not exist there —
verified by grepping every `.html`/`.js` in `dist/` for the literal string `__phylo` (0 hits,
also wired into `scripts/gate-tree.mjs`'s first check). `npm run build:test`
(`scripts/build-test.mjs`) sets `PUBLIC_TEST_HOOKS=1` and builds into `dist-test/` instead
(gitignored) — that is the only build the hook exists in. `npm run serve:test` serves it on 4401.
`gate:v3`'s tree step now points at 4401 (`gate-tree.mjs 4401`); every other v3 gate still runs
against the production `dist` on 4400/4412, which never carries the hook. The hook itself grew
two v3.1 fields: `view()` (which chart is mounted) and `crumbLength()`/`sunRoot()` (sunburst
zoom depth and breadcrumb length), read the same read-only way the linear tree's `zoom()` /
`nodePoint()` / `visible()` already were.

## 3D tree: port decision (v3.1)

**Ported (the approach, re-written, no code shared between repos):** an orbit-controlled
Three.js scene where nodes sit on rings and a raycaster resolves clicks — the same idea as
Armonía Viva's galaxy (`MusicTheory/src/modules/galaxy`, `src/engine/galaxy.ts`).

**Not ported:** React Three Fiber. This app has no other React anywhere; pulling in R3F for one
optional view would add a second UI framework for ~200 lines an imperative Three.js scene
already does directly (`web/src/scripts/tree-3d.ts`), so it is vanilla `three` + its
`OrbitControls` example module. Also not ported: the galaxy's particle/spiral starfield
rendering — `tree-3d.ts` places nodes on depth rings with angle proportional to species (the
same rule the sunburst uses) plus a small per-id-hashed vertical jitter for a "loose galaxy"
read, not a procedural star system.

**Gating:** enabled only at `tier >= 2` (`web/src/lib/tier.ts`) AND no
`prefers-reduced-motion: reduce`; the button is `disabled` with a stated reason
(`tree.view3dOff`) rather than hidden, so it is discoverable but explained. `import('./tree-3d')`
only fires when the button is clicked — verified in `scripts/gate-tree.mjs` ("3D is lazy and
gated by tier + reduced motion": no `tree-3d` request before the click, the chunk requested
after).

**Lazy chunk size** (`web/dist/_astro/`, v3.1 build): `tree-3d.*.js` — **546,982 bytes raw,
136.81 KB gzip** (`three` core + `OrbitControls`, tree-shaken by Vite; no other view imports this
file). It never ships in the initial bundle or in any page but `/filogenia/`, and even there
only after the user opts in.

**Side effect on the always-loaded tree chunk:** `echarts-tree.*.js` (linear + sunburst, shared
with the tree page since v3) grew from ~200 KB gzip range (v3.0, TreeChart only) to
**473,711 bytes raw, 159.70 KB gzip** after adding `SunburstChart`. This chunk is still lazy
(mounted on intersection, after the page's first paint), so it should not move LCP, but it adds
to the tree page's total transferred KB and its TBT — see the Lighthouse re-run below.

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
