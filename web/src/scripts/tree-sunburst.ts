/**
 * Sunburst view of the taxonomy tree (v3.1 item 2): replaces the radial tree.
 * Pure data/option shaping only — ECharts wiring, click routing to the store,
 * and the HTML breadcrumb live in scripts/tree.ts (same split the linear tree
 * already uses between here-shaped data and tree.ts's chart-driving code).
 *
 * Angle is proportional to species count (ECharts sunburst's own rule: a
 * node's sweep is its `value` over its siblings' sum). `sort` is pinned to a
 * stable no-op so the APG IV / PPG I sequence (etl/mappings' row order, baked
 * in by clades-map.ts' `settle`) survives instead of ECharts' default
 * largest-first, which would scramble it.
 *
 * Zoom: ECharts' own `nodeClick: 'rootToNode'` — click a sector to make it the
 * new root (smooth built-in animation), click the innermost ring to go back to
 * its parent. That covers the pointer; the keyboard path is the HTML
 * breadcrumb in tree.ts, built from `pathIndex` below and driven by the
 * `sunburstRootToNode` action, so both stay in sync.
 */
import { GROUP_RANKS, ink, type TreeNode } from '../lib/tree-model';

export interface Tokens { fg: string; muted: string; border: string; surface: string; accent: string; font: string }

/** id -> its ancestor chain (root..node inclusive), for the breadcrumb and for
 *  walking "up one level" from any id. */
export function pathIndex(root: TreeNode): Map<string, TreeNode[]> {
  const out = new Map<string, TreeNode[]>();
  const walk = (n: TreeNode, chain: TreeNode[]) => {
    const path = [...chain, n];
    out.set(n.id, path);
    for (const c of n.children ?? []) walk(c, path);
  };
  walk(root, []);
  return out;
}

/** ECharts sunburst `data`: one recursive node per TreeNode, coloured like the
 *  linear tree (group ranks grey, orders/families their clade/order colour),
 *  with the exact selected node (if any) ringed in the accent colour and a
 *  label ink that keeps AA against its own sector. */
export function sunburstData(root: TreeNode, T: Tokens, focus?: string | null): Record<string, unknown>[] {
  const rec = (x: TreeNode): Record<string, unknown> => {
    const group = x.meta.rank === 'kingdom' || GROUP_RANKS.has(x.meta.rank);
    const color = group ? T.muted : x.itemStyle?.color ?? T.muted;
    const selected = focus != null && x.id === focus;
    const item: Record<string, unknown> = {
      id: x.id,
      name: x.name,
      value: x.value,
      meta: x.meta,
      itemStyle: { color, borderColor: selected ? T.accent : T.surface, borderWidth: selected ? 3 : 1 },
      label: { color: ink(color) },
    };
    if (x.children?.length) item.children = x.children.map(rec);
    return item;
  };
  return [rec(root)];
}

/** Stable "don't reorder" comparator: ECharts' sort defaults to descending by
 *  value, which would break the APG IV / PPG I linear sequence. */
const noSort = () => 0;

export function seriesOption(T: Tokens, reduced: boolean): Record<string, unknown> {
  return {
    id: 'sunburst',
    type: 'sunburst',
    radius: ['14%', '94%'],
    center: ['50%', '52%'],
    sort: noSort,
    nodeClick: 'rootToNode',
    itemStyle: { borderColor: T.surface, borderWidth: 1 },
    label: {
      color: T.fg, fontFamily: T.font, fontSize: 10, minAngle: 7,
      overflow: 'truncate', silent: false,
    },
    emphasis: { focus: 'ancestor' },
    highlightPolicy: 'descendant',
    stateAnimation: { duration: 0 },
    animationDuration: reduced ? 0 : 400,
    animationDurationUpdate: reduced ? 0 : 300,
  };
}
