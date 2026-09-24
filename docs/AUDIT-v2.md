# Botánica v2 — audit (Phase 0)

Baseline commit: `1b97936`. Measured 2026-09-24 on a local build served at `/botanica/` with gzip
(`web/scripts/serve.mjs`), Lighthouse 12.8.2 mobile preset, **median of 3 runs** per page
(`web/scripts/lighthouse.mjs`). Single runs swing ±5 points; every later A/B uses the same method.

## 1. What each page shows today

| Page | Shows | Interaction today |
|---|---|---|
| `/` (Plantae) | Two KPI rows (species, native, introduced, endemic, families, genera · occurrences, % assigned, % unassigned), family treemap (top 40), lifeform bars (top 13), status donut, department choropleth with a 3-metric toggle, "described per year" card | Tooltips; the map's metric toggle. **Nothing filters anything.** |
| `/fungi/` | Same layout for Fungi, with caveats | Same. A separate page, not a toggle. |
| `/especies/` | Substring search over 23 387 names, list (cap 200), detail card with top-6 departments | Search + select. Not linked to the map; the detail can't "show on map". |
| `/filogenia/` | ECharts radial/linear tree kingdom → order → family, one per kingdom, side panel with top departments per order | Zoom/pan/collapse, hover detail. Clicking doesn't filter anything outside the tree. |
| `/tutorial/` | Shared tooltip-tour library (byte-identical to radar-precios' copy) | — |

### Dead or misleading today
- **"Described per year" is an empty placeholder**: `mart_described_per_year` has 0 rows (it waits on IPNI).
  The data exists already in WCVP (`raw_wcvp_names.first_published`) — see §2.
- **Charts don't talk to each other.** The map can't be clicked (`select.disabled`), the treemap
  has `nodeClick: false`, and the bars and donut are display-only.
- **Plantae ↔ Fungi means two page loads**, and `/especies/` has its own separate kingdom toggle.
- **Nothing is linkable.** No state lives in the URL, so a view can't be shared and Back does nothing.
- **Dark-only palette**, Fraunces + IBM Plex Mono from Google Fonts: not the landing's identity
  (Space Grotesk / JetBrains Mono, teal accent, `.light` class, `localStorage.theme`).
- **Spanish only**, with voseo ("Pasá", "Hacé clic") while the landing is EN-default with `/es/`.
- `/especies/` CLS 0.315: the list fills after the index fetch with no reserved height.
- The map's species metric counts **every GBIF name**, not the checklist (see §2 "Reconciliation").

## 2. What the data can actually answer

Source: `data/atlas.duckdb` (read-only), marts in `data/exports/`, indexes in `web/public/data/`.

| Field | Plantae (21 585 spp.) | Fungi (1 802 spp.) |
|---|---|---|
| family / order (APG IV) | 21 585 / 21 585 | 1 776 / 1 772 |
| lifeform (WCVP) | 15 680 (27 % null, shown as "no data") | **0 — not available** |
| native / endemic / introduced | 21 062 / 7 541 / 523 | **not determinable** (no curated distribution) |
| **year described** (WCVP `first_published`) | **21 090 (97.7 %)**, 1753 → 2025 | **not available** |
| ≥ 1 geo-referenced record in a department | 16 035 (74 %) | 1 800 |
| species × department pairs | 83 392 | 3 025 |
| occurrence elevation | 67 % of records | 21 % of records |
| occurrence (collection) year | 95 % of records, 1777 → 2026 | 93 % |

Year described, by quarter century (Plantae): 1750s 541 · 1775 714 · 1800 1 123 · 1825 1 926 ·
1850 1 493 · 1875 1 294 · 1900 1 990 · 1925 2 902 · 1950 1 807 · 1975 2 679 · **2000 4 475** · 2025 146 ·
unknown 495. One species in five known from Peru was described this century.

### Per-department coverage (checklist species with ≥ 1 record · records)

Plantae: UCAYALI 6 541 · 77 631 | AMAZONAS 5 956 · 59 492 | PASCO 5 903 · 223 476 | LORETO 5 821 · 399 410 |
CUSCO 5 769 · 140 158 | SAN MARTIN 4 638 · 44 373 | CAJAMARCA 4 165 · 50 075 | HUANUCO 3 924 · 26 099 |
MADRE DE DIOS 3 774 · 97 763 | JUNIN 3 223 · 34 683 | LA LIBERTAD 1 686 · 13 541 | ANCASH 1 557 · 17 656 |
PUNO 1 434 · 6 825 | PIURA 1 366 · 8 672 | LIMA 1 316 · 21 065 | AREQUIPA 1 281 · 12 224 | AYACUCHO 1 018 · 6 153 |
LAMBAYEQUE 864 · 6 755 | MOQUEGUA 736 · 4 731 | APURIMAC 733 · 5 915 | HUANCAVELICA 585 · 2 939 |
TUMBES 533 · 3 858 | ICA 424 · 2 324 | TACNA 329 · 2 140 | CALLAO 101 · 593

Fungi: CUSCO 488 · 2 012 | LORETO 384 · 4 276 | HUANUCO 309 | JUNIN 249 | SAN MARTIN 249 | LIMA 235 |
… | HUANCAVELICA 2 | MOQUEGUA 1 | **TACNA 0**. The fungal map is mostly holes, and the UI must say so.

The strongest true story in the data: **Loreto has 5× Ucayali's records but fewer species.**
Sampling effort is not richness, and a visitor can now see that by clicking instead of reading a caveat.

### Reconciliation (changes a number on the live map)
`mart_richness_by_department.species` counts `DISTINCT species` over **all** GBIF names in
`fact_occurrence` (24 616 plant names with a department, including names outside the WCVP Peru
checklist). The KPI "21 585 species" counts the **checklist**. v2 derives every species count from
the checklist (`facets-*.json`), so the map and the KPIs count the same universe. Visible effect:
LORETO 7 905 → 5 821, CUSCO 7 778 → 5 769, CALLAO 176 → 101. **Records** (sampling effort) still come
from the mart and are unchanged. A test asserts the unfiltered client aggregates match
`mart_family_composition`, `mart_status` and `mart_lifeform_spectrum` exactly.

### Found while auditing: non-deterministic export
`etl/build_species_index.py` sorted each species' departments by record count only, and SQL
`GROUP BY` order is arbitrary, so ties moved between runs (1 425 rows reordered, 321 with a different
top-6). Fixed with a name tie-break; two consecutive runs are now byte-identical.

### What the data can NOT answer (not built, on purpose)
- Photos, common names, IUCN status: not in the atlas; would need external APIs (CSP, keys).
- Year described for Fungi; lifeform / origin for Fungi.
- Species counts per department **filtered by family and combined with records**: records are
  per occurrence, not in the facet file. Filtered map = species, unfiltered map can also show records.
- A true phylogeny with branch lengths (Open Tree file not versioned): the tree stays a
  **taxonomic** hierarchy and says so.

## 3. Weight today

| Asset | raw | gzip |
|---|---|---|
| `echarts-client` shared chunk (already `echarts/core`, 6 components) | 512 KB | 171 KB |
| per-chart chunks (map 43 KB, treemap 25, line 24, bar 18, pie 17, tree 18) | 145 KB | ~55 KB |
| `species-plantae.json` (search index) | 1 223 KB | 315 KB |
| `species-fungi.json` | 98 KB | 27 KB |
| `peru_departamentos.geojson` (fetched at runtime) | 75 KB | 20 KB |
| Google Fonts (Fraunces + IBM Plex Mono, 3rd-party origin) | — | ~60 KB |
| **new** `facets-plantae.json` / `facets-fungi.json` | 440 / 34 KB | **98 / 9 KB** |

The ECharts chunk is already tree-shaken; its weight is the zrender core plus `VisualMap`, `Legend`,
`Grid`, `Graphic`, `Title` and `Tooltip`. Shrinking it means drawing the simple views without ECharts,
not importing it differently (see §5).

## 4. Lighthouse mobile, baseline (median of 3)

| Page | Perf | A11y | BP | SEO | LCP (s) | TBT (ms) | CLS | Transfer (KB) |
|---|---|---|---|---|---|---|---|---|
| `/` | 63 | 86 | 96 | 100 | 4.20 | 604 | 0.016 | 336 |
| `/fungi/` | 75 | 85 | 96 | 100 | 3.52 | 416 | 0.005 | 330 |
| `/especies/` | 79 | 92 | 100 | 100 | 3.73 | 0 | 0 (single runs up to 0.315) | 412 |
| `/filogenia/` | 64 | 91 | 96 | 100 | 4.16 | 434 | 0.017 | 296 |

Every page misses the 2.0 s LCP budget by about 2×. The causes are the render-blocking Google Fonts
stylesheet (third-party origin, a second connection) and 171 KB gz of ECharts that must parse before any
chart paints. TBT comes from ECharts init on four charts at once. `/especies/` CLS is intermittent:
the list fills after the fetch with no reserved height.

## 5. Plan — questions the atlas should answer, ranked by identity per kilobyte

Each question uses only fields from §2.

| # | Question a visitor asks | How | Cost |
|---|---|---|---|
| 1 | **"What grows in Loreto?"** Click a department → KPIs, families, lifeforms, origin and years all recompute | Facet file (98 KB gz) + a shared URL state; map drawn as build-time SVG | the core; ~100 KB, replaces 171 KB of ECharts on `/` |
| 2 | **"Richness or effort?"** Map metric species ↔ records ↔ species per 1 000 records, with a legend you can brush to select a range | Same SVG, legend = HTML | ~0 KB |
| 3 | **"Where does *X* live?"** Keyboard-first fuzzy search → species drawer (taxonomy path, status, year, departments) → "show on map" | Names index lazy-loaded on first focus (315 KB gz, only when searching) | 0 KB until used |
| 4 | **"When was Peru's flora described?"** A year histogram you can brush, with a "play" that sweeps the decades while the map follows | `year` column; Plantae only, labeled | ~2 KB JS |
| 5 | **"Loreto vs Cusco"**: shared vs exclusive species, side by side | Bitmask AND/XOR over the facet column | ~1 KB JS |
| 6 | **"Where is this family / order?"** Click a family tile or a tree node → the map shows only it | Same state key `fam` / `ord`; tree page gets its own coordinated department strip | ~0 KB on `/`; tree page keeps ECharts |
| 7 | **Plantae ↔ Fungi** as one toggle over the same views, with explicit "not available for fungi" states | `k` state key; `/fungi/` becomes a redirect stub to `./?k=fungi` | ~0 KB |
| 8 | First-visit hints + the existing guided tour, retargeted | Tour library unchanged, strings per locale | ~0 KB |
| — | Elevation band per species | Would add a column (≈ +30 KB gz) and a new view | **deferred**: good story, but the lowest identity per KB here |

## 6. Architecture decisions for Phase 1 (recorded here, detailed in HANDOFF)

- **Explorer = `/` (EN) and `/es/` (ES).** Views: SVG map, family treemap, lifeform bars, origin bar,
  year histogram, KPIs, search/drawer, compare. All read one store and write to it.
- **State in the URL**: `k, dep (≤ 2, comparison), ord, fam, st, lf, y0, y1, sp, m (map metric)`.
  Discrete actions `pushState` (Back undoes them); continuous brushing `replaceState`.
- **Vanilla store + no framework.** Six views over ~10 keys; ECharts is imperative anyway.
  Preact would add a runtime and hydration boundaries without removing any code.
- **No ECharts on the explorer.** Map = GeoJSON projected and simplified to SVG at build time
  (keyboard-focusable paths). Bars and treemap are HTML/SVG buttons, so each gets 44 px targets and
  reflows at 360 px. ECharts stays only on `/filogenia/`, trimmed to `TreeChart` + canvas.
- **Fonts self-hosted** (`@fontsource-variable/space-grotesk`, `/jetbrains-mono`) → no third-party
  origin, CSP stays `'self'`.
