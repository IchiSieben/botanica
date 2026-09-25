/**
 * Growth-form groups (brief v3 item 5). Source of truth: etl/mappings/growth_form_groups_v1.csv
 * (raw WCVP lifeform_description -> group), bundled as text at build time. Facets carry the
 * group; the species index keeps the raw WCVP string, shown as the tooltip.
 */
import csv from '../../../etl/mappings/growth_form_groups_v1.csv?raw';

export const GROUPS = ['tree', 'shrub', 'herb', 'geophyte', 'climber', 'epiphyte', 'succulent', 'aquatic', 'parasite', 'other'] as const;
export type Group = (typeof GROUPS)[number];
export const MAPPING_VERSION = 'growth_form_groups_v1';

const RAW = new Map<string, { group: Group; n: number }>();
for (const line of csv.trim().split(/\r?\n/).slice(1)) {
  // raw_wcvp,group,n_species_peru,rule — raw strings may be quoted when they hold a comma.
  const m = line.match(/^(?:"((?:[^"]|"")*)"|([^,]*)),([^,]+),(\d+),/);
  if (m) RAW.set((m[1] ?? m[2]).replace(/""/g, '"'), { group: m[3] as Group, n: Number(m[4]) });
}

export const isGroup = (v: string | null): v is Group => !!v && (GROUPS as readonly string[]).includes(v);
/** A pre-v3 link may carry a raw WCVP string (`?lf=shrub or tree`): map it to its group. */
export const toGroup = (v: string | null): Group | null => (isGroup(v) ? v : v ? RAW.get(v)?.group ?? null : null);
/** The most common raw WCVP strings of a group (national counts), for tooltips. */
export function rawOf(g: string, top = 4): string[] {
  return [...RAW.entries()].filter(([, x]) => x.group === g).sort((a, b) => b[1].n - a[1].n).slice(0, top).map(([k]) => k);
}
export const rawCount = (): number => RAW.size;
