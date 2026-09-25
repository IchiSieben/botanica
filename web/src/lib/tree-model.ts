/**
 * Shape of the taxonomy tree shared by the build (PhyloTree.astro) and the
 * client (scripts/tree.ts). No data here: safe to import from the browser.
 */
export type Rank = 'kingdom' | 'clade' | 'phylum' | 'class' | 'order' | 'family';

/** Ranks above order: drawn in a neutral colour, opened by clicking them. */
export const GROUP_RANKS: ReadonlySet<Rank> = new Set<Rank>(['clade', 'phylum', 'class']);

export interface TreeNode {
  /** Path of canonical names from the kingdom, '/'-joined: unique within a kingdom. */
  id: string;
  /** Label on the page (clade names are localised; Latin names are not). */
  name: string;
  /** Species recorded in Peru; groups carry the sum of their children. */
  value: number;
  meta: {
    rank: Rank;
    /** Canonical name: the CSV's clade name, or the Latin name. */
    key: string;
    /** Parent order of a family (the store's `ord` when a family is picked). */
    parent?: string;
    unplaced?: boolean;
  };
  itemStyle?: { color: string };
  children?: TreeNode[];
}

/**
 * Symbol diameter in px. One scale across ranks (largest non-root node = 18 px),
 * so a clade and an order of the same size look the same; the legend's sample
 * circles use this same function.
 */
export const nodeSize = (value: number, max: number): number =>
  4 + 14 * Math.sqrt(Math.max(0, value) / Math.max(1, max));

/** Legend samples: powers of ten up to the largest non-root node. */
export const sizeSamples = (max: number): number[] => {
  const top = Math.pow(10, Math.floor(Math.log10(Math.max(10, max))));
  return [top / 100, top / 10, top].filter((v) => v >= 1);
};

/** Relative luminance of a `#rrggbb` colour (same formula as lib/views.ts' treemap). */
function lum(hex: string): number {
  const m = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((o) => {
    const v = parseInt(m.slice(o, o + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white, whichever contrasts more with the fill: used for sunburst sector
 *  labels (dark sectors get white text, light sectors get black), same rule as the
 *  explorer's treemap tiles. */
export const ink = (hex: string): string => {
  const l = lum(hex);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? '#ffffff' : '#000000';
};
