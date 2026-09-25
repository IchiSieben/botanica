# SPEC — Botánica v3-A (story, one-glance layout, interaction)

Contract for release **v3.0.0**. Brief: owner prompt of 2026-09-24 ("v3-A"). Baseline `f8aacb6`.

## Inputs
- `data/atlas.duckdb` (local, not in git): WCVP names (`raw_wcvp_names`: `ipni_id`, `first_published`,
  `basionym_plant_name_id`), `peru_species`, `dim_taxon`, `gbif_fungi_clean` (`phylum`, `class`, `order`).
- `web/public/data/{species,facets}-{plantae,fungi}.json` (ETL export, reproducible byte for byte at `f8aacb6`).
- `docs/RESEARCH-PERU.md` — the owner's research dossier. **Not found on this machine or in Drive on
  2026-09-24.** Items that need it (dossier facts in the intro, the 1777 timeline anchor, `ROADMAP.md`)
  ship with our own data only, and a visible slot for the rest (see Out of scope).

## Outputs (one line per brief item)
1. **Intro** — first screen of `/` and `/es/`, then "Explore" (anchor `#explorar`). 8–10 facts, each a
   number computed from our data with a link to its source (dataset DOI / WCVP / IPNI); a timeline of
   milestones derived from WCVP `first_published` + our release dates; "how the atlas works" (WCVP +
   GBIF, records ≠ richness). Scroll-driven motion = CSS `animation-timeline: view()` on `transform`
   only (an opacity fade put entering text below AA), inside `@supports` and `prefers-reduced-motion: no-preference`; otherwise static.
   A URL that carries explorer state (`?dep=`, `?sp=`, …) or `#explorar` lands on the explorer.
2. **One-glance explorer** — at 1440×900 the bottoms of `#kpis`, `#map`, `#families` and `#status`
   (origin) are ≤ 900 px once the explorer section is at the top of the viewport. Growth form and
   years sit below. < 1024 px keeps the current stacked layout.
3. **Chart frame** — every chart (map, families, origin, growth form, years, tree, tree's department
   bars) has: a "How to read this" line, a legend with units, a source line (dataset + DOI/version).
4. **Department label** — with a department selected, the KPI reads "species with GBIF records in
   <dep>"; a note explains that since v2 counts come from the WCVP checklist ∩ GBIF records
   (Loreto 7,905 → 5,821). Same explanation in HANDOFF.
5. **Growth form groups** — `etl/mappings/growth_form_groups_v1.csv` (`raw_wcvp,group`) maps all WCVP
   `lifeform_description` strings in the export to 9 groups: tree, shrub, herb, geophyte, climber,
   epiphyte, succulent, aquatic, parasite (+ `other`). Facets carry groups; the species index keeps
   the raw string, shown as the tooltip (`title`) wherever a group label is shown for one species.
   A test fails if any exported raw string is unmapped.
6. **Taxonomy tree** — list click → the tree highlights, expands and centres/zooms that branch
   (bug fix). Fullscreen, zoom in/out/reset, expand all/collapse all. Plants: intermediate clades
   from `etl/mappings/clades_apg4_ppg1_v1.csv` (order → lycophytes / ferns / gymnosperms /
   angiosperms › ANA grade, magnoliids, monocots, eudicots › superrosids / superasterids).
   Fungi: phylum › class from GBIF. List hover is compositor-only (transform/opacity).
7. **Map** — zoom (buttons, wheel, pinch) and pan (drag) as a CSS transform on the SVG; fullscreen;
   legend with units per metric and a "no records" swatch.
8. **Header** — "Language: ES | EN" and "Theme: light/dark", each icon + visible text + aria-label;
   fits 360 px.
9. **Species drawer** — taxonomy path, status, year described linking the protologue
   (`https://www.ipni.org/n/{ipni_id}`, basionym's IPNI id when there is one, as for the year),
   departments, and an empty photo slot `[data-photo-slot]` for session B.
10. **Changes** — `CHANGELOG.md` (+ `CHANGELOG.es.md`), `/cambios/` and `/es/cambios/` generated at
    build time from them and git tags; reusable as `Portfolio/shared/changelog/` (zero-dependency,
    vendored like `shared/tutorial`). Tag `v3.0.0` (and retro-tag `v1.0.0`, `v2.0.0`).
    `ROADMAP.md`: blocked on the dossier (§5).

## Invariants
- No ECharts on `/` (AUDIT-v2). No new runtime dependency.
- Gates stay green: `npm test`, `npm run gate` + `npm run gate:v3` (intro, explorer, tree, changes), axe dark 0 violations, 0 console
  errors / CSP violations live, 0 px overflow at 360, Lighthouse mobile ≥ 90 on every page.
- Every figure on the page comes from our data or the dossier, with its citation; every DOI cited is
  checked against `https://doi.org/api/handles/<doi>` (`responseCode: 1`).
- Existing URLs and URL state keep working (`?dep= ?fam= ?ord= ?lf= ?sp= ?k=`, `/fungi/`).

## Out of scope (this release)
- Dossier facts, the 1777 Ruiz & Pavón anchor and `ROADMAP.md` until `docs/RESEARCH-PERU.md` exists.
- Photos (session B). Branch lengths / dated phylogeny.
