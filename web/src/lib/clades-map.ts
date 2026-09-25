/**
 * BUILD TIME ONLY. Places every order of the tree under its intermediate groups:
 *
 *   Plantae: etl/mappings/clades_apg4_ppg1_v1.csv  (order, clade_path, source)
 *            clade_path is ' > '-separated from the top (APG IV / PPG I). Row order
 *            is the APG IV / PPG I linear sequence and sets the order of siblings.
 *   Fungi:   etl/mappings/fungi_order_ranks_v1.csv  (order, phylum, class, ...)
 *            majority phylum/class per order among GBIF records (etl/build_fungi_ranks.py).
 *
 * An order in the data with no row fails the build: a silent fallback would put
 * a real order in the wrong place, or nowhere.
 */
import cladesCsv from '../../../etl/mappings/clades_apg4_ppg1_v1.csv?raw';
import fungiCsv from '../../../etl/mappings/fungi_order_ranks_v1.csv?raw';
import type { Rank, TreeNode } from './tree-model';

export const CLADES_FILE = 'etl/mappings/clades_apg4_ppg1_v1.csv';
export const FUNGI_FILE = 'etl/mappings/fungi_order_ranks_v1.csv';

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

interface Step { name: string; rank: Rank }
interface Placement { path: Step[]; seq: number }

function placements(kingdom: 'Plantae' | 'Fungi'): Map<string, Placement> {
  const out = new Map<string, Placement>();
  if (kingdom === 'Plantae') {
    parseCsv(cladesCsv).forEach((r, seq) => {
      const path = r.clade_path.split('>').map((s) => s.trim()).filter(Boolean).map((name) => ({ name, rank: 'clade' as const }));
      out.set(r.order, { path, seq });
    });
  } else {
    parseCsv(fungiCsv).forEach((r, seq) => {
      const path: Step[] = [];
      if (r.phylum) path.push({ name: r.phylum, rank: 'phylum' });
      if (r.class) path.push({ name: r.class, rank: 'class' });
      out.set(r.order, { path, seq });
    });
  }
  return out;
}

export interface OrderIn {
  name: string;
  color: string;
  families: { name: string; value: number }[];
  unplaced?: boolean;
}

/**
 * kingdom → groups (clade / phylum › class) → order → family.
 * `label` turns a group's canonical name into the page's label (clade names are
 * localised; phylum and class names are Latin and pass through).
 */
export function buildTree(kingdom: 'Plantae' | 'Fungi', orders: OrderIn[], label: (s: Step) => string): TreeNode {
  const place = placements(kingdom);
  const missing = orders.filter((o) => !o.unplaced && !place.has(o.name)).map((o) => o.name);
  if (missing.length) {
    throw new Error(`[clades] ${missing.length} ${kingdom} order(s) in the tree data have no row in ${kingdom === 'Plantae' ? CLADES_FILE : FUNGI_FILE}: ${missing.join(', ')}`);
  }

  const root: TreeNode = { id: kingdom, name: kingdom, value: 0, meta: { rank: 'kingdom', key: kingdom }, children: [] };
  const seqOf = new Map<TreeNode, number>();
  const UNPLACED_SEQ = Number.MAX_SAFE_INTEGER;

  for (const o of orders) {
    let cursor = root;
    const p = o.unplaced ? { path: [], seq: UNPLACED_SEQ } : place.get(o.name)!;
    for (const step of p.path) {
      const id = `${cursor.id}/${step.name}`;
      let next = cursor.children!.find((c) => c.id === id);
      if (!next) {
        next = { id, name: label(step), value: 0, meta: { rank: step.rank, key: step.name }, children: [] };
        cursor.children!.push(next);
      }
      seqOf.set(next, Math.min(seqOf.get(next) ?? UNPLACED_SEQ, p.seq));
      cursor = next;
    }
    const id = `${cursor.id}/${o.unplaced ? '~unplaced' : o.name}`;
    const node: TreeNode = {
      id,
      name: o.name,
      value: o.families.reduce((s, f) => s + f.value, 0),
      itemStyle: { color: o.color },
      meta: { rank: 'order', key: o.unplaced ? '' : o.name, ...(o.unplaced ? { unplaced: true } : {}) },
      children: [...o.families]
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
        .map((f) => ({
          id: `${id}/${f.name}`, name: f.name, value: f.value, itemStyle: { color: o.color },
          meta: { rank: 'family' as const, key: f.name, ...(o.unplaced ? {} : { parent: o.name }) },
        })),
    };
    seqOf.set(node, p.seq);
    cursor.children!.push(node);
  }

  // Groups carry the sum of their children; siblings sort by the CSV's linear
  // sequence (plants) or by size (fungi: the GBIF file is alphabetical). The
  // unplaced bucket always goes last.
  const settle = (n: TreeNode): number => {
    if (n.meta.rank === 'order') return n.value;
    n.value = (n.children ?? []).reduce((s, c) => s + settle(c), 0);
    n.children?.sort((a, b) => {
      const ua = a.meta.unplaced ? 1 : 0, ub = b.meta.unplaced ? 1 : 0;
      if (ua !== ub) return ua - ub;
      if (kingdom === 'Plantae') return (seqOf.get(a) ?? 0) - (seqOf.get(b) ?? 0);
      return b.value - a.value || a.name.localeCompare(b.name);
    });
    return n.value;
  };
  settle(root);
  return root;
}

/**
 * Orders grouped for the accessible list, in tree order. Plants: by the order's
 * parent clade (heading = the clade path). Fungi: by phylum (a heading per class
 * would be 40 headings). Within a group, orders by species, largest first.
 */
export function orderGroups(root: TreeNode, byPhylum: boolean): { label: string; orders: TreeNode[] }[] {
  const groups = new Map<string, { label: string; orders: TreeNode[] }>();
  const walk = (n: TreeNode, chain: TreeNode[]) => {
    if (n.meta.rank === 'order') {
      const g = byPhylum ? chain.slice(0, 1) : chain;
      const key = g.map((c) => c.id).join('|');
      if (!groups.has(key)) groups.set(key, { label: g.map((c) => c.name).join(' › '), orders: [] });
      groups.get(key)!.orders.push(n);
      return;
    }
    for (const c of n.children ?? []) walk(c, n.meta.rank === 'kingdom' ? chain : [...chain, n]);
  };
  walk(root, []);
  const list = [...groups.values()];
  for (const g of list) g.orders.sort((a, b) => Number(!!a.meta.unplaced) - Number(!!b.meta.unplaced) || b.value - a.value);
  // Unplaced (no heading) last.
  return list.sort((a, b) => Number(a.label === '') - Number(b.label === ''));
}
