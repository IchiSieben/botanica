# Changelog

All notable changes to Botánica are documented here. Format:
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). Versioning:
[Semantic Versioning](https://semver.org/).

## [3.1.0] - 2026-09-25

### Added
- The intro now mixes the atlas's own figures with cited facts from the research dossier
  (megadiversity, altitude range, protected areas, epiphytes, undescribed Amazonian trees), and
  shows the Red Book's 27.9 % endemism beside the atlas's 34.9 % with the reason they differ.
  Every number links to its source.
- A timeline from 1777 (Ruiz, Pavón and Dombey) to 2026, with cited historical milestones and
  milestones computed from the checklist.
- `ROADMAP.md`, the expansion plan, one country per version.
- A sentence above the explorer that reads every active filter in plain language and gives the
  result count; each part can be removed on its own.
- When a combination returns nothing, the explorer lists what removing each filter would return.
- Every chart says that it ignores its own filter, and panels that changed flash briefly.
- The map legend says when its scale is rescaled to the filtered maximum.
- A tour step that explains how filters work together.
- A zoomable sunburst in the taxonomy tree (click to zoom, breadcrumb to go back), and an optional
  3D view on capable devices, loaded only when chosen.
- The species page lists every species with virtual scrolling, in a list or a grid, with sort
  options and filters for endemic species, department and family.
- The species panel now has a small department map, the species' place on the year-described
  timeline, other species of the same genus, and links to IPNI, GBIF and POWO.

### Changed
- The taxonomy tree opens in the linear view, and its introduction names the clades.
- The tree, the orders list and the species-per-department bars fit in one screen at 1440×900.
- The department panel's top families come from the same filtered species as its count.
- The species page introduction follows the Plants/Fungi toggle.

### Removed
- The radial tree view (replaced by the sunburst; old links open the sunburst).

## [3.0.0] - 2026-09-24

### Added
- An intro screen on `/` and `/es/`: 8–10 facts about Peru's flora and fungi, each a number
  computed from the atlas's own data with a link back to its source, plus a short timeline of
  milestones and a plain-language note on how the atlas works (checklist vs. records).
- A "how to read this" line, a legend with units, and a source line (dataset + DOI/version) on
  every chart: map, families, origin, growth form, years, and the taxonomy tree.
- Nine growth-form groups (tree, shrub, herb, geophyte, climber, epiphyte, succulent, aquatic,
  parasite, plus other) mapped from the checklist's raw lifeform text, shown as a filterable
  facet with the original wording kept as a tooltip.
- Intermediate clades in the taxonomy tree for plants (lycophytes, ferns, gymnosperms,
  angiosperms, monocots, eudicots, and their sub-groups) and phylum → class for fungi.
- Fullscreen, zoom in/out/reset, and expand-all/collapse-all controls on the taxonomy tree.
- Zoom (buttons, wheel, pinch) and pan (drag) on the department map, plus a fullscreen view and
  a legend with a dedicated "no records" swatch.
- A changelog page at `/cambios/` and `/es/cambios/`, generated at build time from this file and
  from git tags, linking each version to its commit or tag on GitHub.

### Changed
- Tightened the one-glance explorer layout: at 1440×900, the map, KPIs, families and origin
  panels now fit within 900 px of the explorer section, with growth form and years below.
- The department KPI now reads "species with GBIF records in <department>" and explains, next to
  the number, that species counts come from the checklist crossed with GBIF records (for
  example, Loreto: 7,905 → 5,821), matching what the map already showed since v2.
- The header's language and theme controls now show an icon, visible text and a label together,
  and still fit at 360 px wide.
- The species drawer states each species' taxonomy path, status, year described (linking the
  original description) and departments, with an empty slot reserved for photos in a later
  release.

### Fixed
- Clicking a group in the taxonomy list now correctly highlights, expands and centers that
  branch in the tree (it previously could point at the wrong node).
- Links with a department (`?dep=`) no longer shift the explorer while web fonts load.

## [2.0.0] - 2026-09-24

### Added
- A fully explorable atlas: click a department, a family, a growth form, an origin or a decade
  and every view on the page updates together, with the choice kept in the shareable URL.
- A build-time SVG map of Peru's departments on the home page, replacing the earlier chart
  library there for a lighter, more accessible first screen.
- Search that opens a species drawer with its details, and a taxonomy tree that filters the rest
  of the explorer when a group is selected.
- A years brush with a "play" control to watch species accumulate over time, decade by decade.
- A Plantae ↔ Fungi kingdom switch, with fungi-specific caveats shown where the data is thin.
- An opening tour on each page, and full English/Spanish translations (English at the root,
  Spanish under `/es/`).
- Self-hosted fonts (no external font requests) and a lighter home page (LCP under 2 seconds on
  mobile).

### Changed
- Numbers, layout and interaction were rebuilt for mobile: 360 px wide with no horizontal
  overflow, touch targets sized for fingers, and pages that stay fast on a mid-range phone.

## [1.0.0] - 2026-09-22

### Added
- First public release: a static atlas of the plant and fungus species recorded in Peru, built
  from WCVP (Kew) and GBIF open data.
- A species finder at `/especies/` with client-side search over more than 23,000 species.
- Bilingual (English/Spanish) documentation and a verified, reproducible data pipeline.
