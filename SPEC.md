# SPEC — Botánica v3.1 (clarity, tree, species)

Contract for release **v3.1.0**. Brief: owner prompt of 2026-09-25 ("v3.1"). Baseline `4cb9cb3`
(v3.0.0 = `5de89ac`). The v3.0 contract is in git history (`git show 5de89ac:SPEC.md`).

## Inputs
- `docs/RESEARCH-PERU.md` — the owner's dossier (2026-09-24). Source of every non-own figure.
  Link check 2026-09-25: 53/56 URLs resolve. BHL `bibliography/194092` and iNaturalist answer 403 to
  automated clients (use the archive.org copy for Brako & Zarucchi 1993); Conosur resolves only over
  `http://`. Facts marked ⚠️ in the dossier are **not shown** on the page.
- `data/atlas.duckdb` (local only, open `read_only`), `web/public/data/*.json` (ETL export).

## Outputs
0. **Dossier items skipped in v3.0**
   - Intro facts: 8–10 in total, mixing own-data facts with un-flagged dossier facts. Each shows its
     number with a link to its source (DOI or URL), and nothing is shown without a citation. The
     Libro Rojo 27.9 % sits beside our 34.9 %, with the reason they differ (other taxonomy, other
     date; dossier §1 #5–6).
   - Timeline from 1777 to 2026, built from the dossier's §2 rows (not the ⚠️ ones) plus our computed
     milestones.
   - `ROADMAP.md`: dossier §5, copied as it is.
1. **Filter clarity**
   - A question sentence above the explorer reads every active filter in plain language and ends with
     `→ <count>`.
   - At 0 results, an empty state lists what removing each filter would return.
   - Every chart has one line saying it ignores its own filter.
   - Panels whose content changed get a brief highlight, compositor-only.
   - Department detail: the top families come from the same filtered set as its count, or it says
     which set they use. No "0 species" beside "Poaceae 20".
   - Map legend: when the scale is rescaled to the filtered maximum, it says so ("scale 0–2 of 5
     species").
   - One tour step shows a filter and explains the crossfilter behaviour.
2. **Tree**
   - The linear view becomes the default.
   - Radial is replaced by a zoomable sunburst: angle = species, click to zoom, breadcrumb, same clade
     palette.
   - Optional 3D view, a port of the approach in Armonía Viva's galaxy (Three.js, orbit/zoom),
     re-written, not copied. It is lazy-loaded; tier 0/1 devices and `prefers-reduced-motion` get the
     sunburst instead.
   - HANDOFF explains why the plant radial looked sparse, written before radial is removed.
   - The tree lede names clades.
   - At 1440×900, the tree, the orders list and the species-per-department bars read in one glance.
3. **Species**
   - Species page: virtual scrolling (no 200 cap), list/grid toggle, sort options, and filters for
     endemic, department and family.
   - The Plants/Fungi toggle updates the count (bug).
   - Drawer (the explorer's, and the species page's detail through the same renderer):
     - mini department map;
     - the species' position on the year-described timeline;
     - same-genus species;
     - IPNI, GBIF and POWO links;
     - photo and threat slots inside the render template, for session B.
4. **Housekeeping**
   - `window.__phylo` is absent in production builds.
   - A gate for map pinch-zoom.
   - Merged worktrees deleted (done at `30b3009`).
   - Tag `v3.1.0`.

## Invariants
- Gates stay green: `npm test`, `npm run gate`, `npm run gate:v3` (+ the v3.1 gates), `check:dois`,
  axe dark 0 violations, 0 console errors / CSP violations live, 0 px overflow at 360,
  Lighthouse mobile ≥ 90 on every page.
- No ECharts on `/`. Three.js only as a lazy chunk of the tree page, never in the initial bundle.
- Existing URLs and URL state keep working. `?view=radial` (if present) maps to the sunburst.
- Every DOI or URL the page cites resolves (`check:dois` for DOIs, curl for URLs).

## Out of scope
- Photos and threat data (session B: DS 043, GBIF media). The slots only.
- GBIF backbone → COL XR migration (dossier §0): recorded as an open item in HANDOFF.
