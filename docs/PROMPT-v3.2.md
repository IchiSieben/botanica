# Botánica v3.2 — fast on a cold visit, one glance per section, a species view worth looking at (Opus, unattended)

UNATTENDED: owner pre-approves commits and pushes in THIS repo (`Portfolio/Botanica`) after each
item's gates pass. Mirror to the landing only at the end, as in v3.1 (separate Landing worktree,
pull first, never touch another session's uncommitted work). Do not stop to ask; record
questions under "Open questions" in HANDOFF and continue. At ~300k tokens of context: update
HANDOFF, commit what is green, stop with a summary.

Start: `HANDOFF.md` (v3.1.0 state), `SPEC.md`, `ROADMAP.md`, `docs/AUDIT-v2.md`, `git log -20`.

## Owner review of the live site (2026-09-26), condensed
- The **Taxonomy tree** is now the best part: linear and sunburst are "brutal", 3D is very
  interesting. Keep their character.
- **Species (Plants and Fungi) is the weakest part.** In a cold incognito visit the list took
  close to a minute to appear ("loading the index…"), and switching to Fungi is slow again. The
  list and grid look cheap: name, family and count run together with no spacing
  ("Aa argyrolepisOrchidaceae·"), grey blocks, the grid scrolls sideways, text is clipped. The
  detail panel needs scrolling before it says anything.
- The tree also takes a while to show on first open.
- **One glance per section.** On a wide screen there is a large empty gap before "Peru, by the
  numbers"; each block should be readable whole without hunting for it. The timeline "Names
  through the centuries" is long: consider two columns on wide screens. "How the atlas works"
  is the model: everything at once.
- **Filter colours feel wrong.** Selecting a department tints every panel turquoise, with a pink
  flash first. If colour signals a selection, it should be the selected thing's own colour, or
  no panel tint at all.
- **3D tree:** he can look but not interact. He wants to click nodes, see their names, light up
  a branch (like Armonía Viva lights notes).
- **Reset** in the tree does not clear his selection. Going back to the start should be obvious.
- **No way back to the portfolio.** Every page needs a link to ichisieben.dev.

Local Lighthouse in v3.1 says `especies` LCP 1.78 s. The owner's cold live visit says ~1 minute.
Both can be true: that gap is the first thing to explain.

## Items, in order (one commit each)

**B1 · Cold-visit speed, measured live.**
- Measure on `https://ichisieben.dev/botanica/…` with a fresh profile, cache disabled, mobile
  throttling and no throttling: time to first species row, to Fungi after the toggle, to the tree
  first paint. Record bytes, `content-encoding`, `cache-control`, TTFB and any challenge/redirect
  per request (the Landing HANDOFF mentions a CDN challenge note: check whether JSON requests hit
  it). Write the waterfall to `docs/PERF-v3.2.md` before changing code.
- Then fix what the waterfall shows. Likely levers, use only what the evidence supports:
  compressed JSON (brotli/gzip, served with the right headers from the Landing `.htaccess` — list
  the exact lines needed in HANDOFF), a small first chunk (the first screen of rows) with the
  full index streamed or loaded in a Web Worker, parsing off the main thread, per-kingdom files
  so Fungi does not wait on Plants, long-lived caching with hashed file names, prefetch of the
  tree data when the user hovers its nav link.
- Budgets (live, cold, mobile throttle): first species row < 2.5 s, Fungi switch < 1 s after its
  data is cached, tree first paint < 2.5 s. Record before/after in `docs/PERF-v3.2.md`.

**B2 · Species list, grid and detail, redesigned.**
- Row: scientific name in italics, family and order as a quiet second line, records and year as
  small aligned figures, a thin order-colour mark (same palette as the tree). Real spacing and
  separators in the markup, not only in CSS, so screen readers and copy-paste read
  "Aa argyrolepis — Orchidaceae — 3 records".
- Grid: cards that never scroll sideways or clip text; each card shows name, family, a tiny
  department-presence mark and the endemic badge.
- Detail panel: sticky beside the list on wide screens, a bottom sheet on phones; the first
  screen shows name, taxonomy path, status, year, records and the mini map without scrolling.
  Fix "Shrubs and subshrubsWCVP: shrub" (missing separator).
- Gate: screenshots at 1440, 1024, 390 in light/dark into `evidence/v3.2/`, no horizontal
  scroll at 360, axe 0 violations.

**B3 · One glance per section.**
- Intro, "Peru, by the numbers", timeline, "How the atlas works": each fits one viewport at
  1440×900 and 2560×1080 (ultrawide) and reads whole. Remove the dead gap before the numbers.
  Timeline in two columns from ~1280 px wide, one column below.
- Scrolling lands on sections: `scroll-snap-type: y proximity` (never `mandatory`), off under
  reduced motion.
- Explorer: KPIs, map, families and origin visible together at 1440×900; "How to read this"
  collapses to one line with an expand control after the first visit.

**B4 · Selection colour that means something.**
- Find what tints the panels and what causes the pink flash (record it in HANDOFF).
- Remove the whole-panel tint. Show the active filter with the chip plus an outline on the
  selected element; where a colour is used, it is that element's own colour (the family's order
  colour, the department's map colour). Changed panels may still flash once, compositor-only,
  in a neutral tone.

**B5 · The tree: reset, and a 3D you can touch.**
- "Reset" clears the selection and the view (back to the kingdom); add "Clear selection" in the
  breadcrumb. Write `?view=` back to the URL (known gap).
- 3D: hover or tap a node → its name and species count; click → selects it exactly like the
  linear tree (side panels follow) and lights its branch while dimming the rest; labels always
  on for the largest nodes. Keep it opt-in, lazy, tier ≥ 2, still under reduced motion.
- Sunburst: label an arc only when it has room; no overlapping text.

**B6 · Way back to the portfolio.**
- Header link on every page: "← IchiSieben" to `/projects/botanica/` (the ficha), plus the
  landing home. Same in ES. Same-origin paths, no external request.

## Constraints
- Base path `/botanica/`, relative. CSP of the landing: `'self'` plus Google Fonts; anything else
  goes to "Open questions" with the exact CSP line it needs.
- No new data sources in this run (photos, threat, COL XR stay in their own sessions).

## Gates for every item
Build · `astro check` 0 errors · `npm test` · `npm run gate` · axe dark/light 1280+360 EN+ES ·
360 px overflow · Lighthouse mobile A/B vs the item's baseline, never below it · for B1 the live
cold measurements above · for B5 a Playwright script that resets, clicks a 3D node and asserts
the side panels changed.

## Close
Tag v3.2.0, `MIRROR-READY` in HANDOFF with the build folder, file list and any `.htaccess`
lines. Mirror to the landing as in v3.1 and verify live. Opus read-only reviewer over the whole
diff; apply its findings or record why not. In the final chat message, list the **visible**
changes first, in plain Spanish. Kill only the processes you started.
