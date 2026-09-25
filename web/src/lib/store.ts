/**
 * The one shared state of the explorer, kept in the URL.
 *
 * Every view reads `get()` and writes with `set()`. The URL is the source of
 * truth: any view is linkable and Back undoes the last discrete action.
 *
 *   ?k=fungi&dep=LORETO,CUSCO&fam=Orchidaceae&st=endemica&y0=1900&y1=1949
 *
 * Discrete actions (click a department, pick a species) push a history entry;
 * continuous ones (brushing years, typing) replace the current entry, so Back
 * does not have to step through every intermediate value.
 */

import { DEPT_NAME } from './depts.ts';

export type Status = 'endemica' | 'nativa' | 'introducida' | 'nodata';
export type Metric = 'species' | 'records' | 'coverage';
/** Species page only (v3.1): sort key and list/grid view. Kept in `State` so the
 *  page's filters (dep, fam, st) round-trip through the same URL as the explorer. */
export type SpSort = 'name' | 'year' | 'records' | 'family';
export type SpView = 'list' | 'grid';

export interface State {
  /** Kingdom: 'plantae' | 'fungi'. */
  k: 'plantae' | 'fungi';
  /** Selected departments, max 2 (two = comparison). */
  dep: string[];
  ord: string | null;
  fam: string | null;
  st: Status | null;
  lf: string | null;
  /** Year-described range, inclusive. null = open. */
  y0: number | null;
  y1: number | null;
  /** Selected species (scientific name): opens the drawer. */
  sp: string | null;
  /** Map metric. */
  m: Metric;
  /** Species page: sort key (default 'name', omitted from the URL). */
  sort: SpSort;
  /** Species page: list or grid (default 'list', omitted from the URL). */
  view: SpView;
}

export const EMPTY: State = {
  k: 'plantae', dep: [], ord: null, fam: null, st: null, lf: null,
  y0: null, y1: null, sp: null, m: 'species', sort: 'name', view: 'list',
};

const STATUSES: Status[] = ['endemica', 'nativa', 'introducida', 'nodata'];
const METRICS: Metric[] = ['species', 'records', 'coverage'];
const SORTS: SpSort[] = ['name', 'year', 'records', 'family'];
const VIEWS: SpView[] = ['list', 'grid'];

const int = (v: string | null): number | null => {
  if (v == null || !/^\d{4}$/.test(v)) return null;
  return Number(v);
};

/** URLSearchParams -> State. Unknown or malformed values fall back to defaults. */
export function parse(search: string): State {
  const p = new URLSearchParams(search);
  const k = p.get('k') === 'fungi' ? 'fungi' : 'plantae';
  const st = p.get('st') as Status | null;
  const m = p.get('m') as Metric | null;
  const sort = p.get('sort') as SpSort | null;
  const view = p.get('view') as SpView | null;
  return {
    k,
    // Only known departments: the key is shown in the UI, so a crafted ?dep= must not reach the DOM.
    dep: (p.get('dep') ?? '').split(',').map((s) => s.trim().toUpperCase()).filter((d) => d in DEPT_NAME).slice(0, 2),
    ord: p.get('ord') || null,
    fam: p.get('fam') || null,
    st: st && STATUSES.includes(st) ? st : null,
    lf: p.get('lf') || null,
    y0: int(p.get('y0')),
    y1: int(p.get('y1')),
    sp: p.get('sp') || null,
    m: m && METRICS.includes(m) ? m : 'species',
    sort: sort && SORTS.includes(sort) ? sort : 'name',
    view: view && VIEWS.includes(view) ? view : 'list',
  };
}

/** State -> query string, defaults omitted, fixed key order (stable URLs). */
export function serialize(s: State): string {
  const p = new URLSearchParams();
  if (s.k !== 'plantae') p.set('k', s.k);
  if (s.dep.length) p.set('dep', s.dep.join(','));
  if (s.ord) p.set('ord', s.ord);
  if (s.fam) p.set('fam', s.fam);
  if (s.st) p.set('st', s.st);
  if (s.lf) p.set('lf', s.lf);
  if (s.y0 != null) p.set('y0', String(s.y0));
  if (s.y1 != null) p.set('y1', String(s.y1));
  if (s.sp) p.set('sp', s.sp);
  if (s.m !== 'species') p.set('m', s.m);
  if (s.sort !== 'name') p.set('sort', s.sort);
  if (s.view !== 'list') p.set('view', s.view);
  const q = p.toString();
  return q ? `?${q}` : '';
}

/** True when any filter narrows the species set (the map metric is not a filter). */
export const isFiltered = (s: State): boolean =>
  !!(s.dep.length || s.ord || s.fam || s.st || s.lf || s.y0 != null || s.y1 != null);

type Listener = (s: State, prev: State) => void;

/** Browser-side store. Created once per page. */
export function createStore() {
  let state = parse(location.search);
  const listeners = new Set<Listener>();

  const emit = (prev: State) => listeners.forEach((l) => l(state, prev));

  function set(patch: Partial<State>, { push = true } = {}) {
    const prev = state;
    // Switching kingdom clears everything that names a taxon (an order of plants
    // means nothing in the fungi view), then the patch applies: a search hit in the
    // other kingdom sets k and sp in one call and must keep sp.
    const reset = patch.k && patch.k !== prev.k
      ? { ord: null, fam: null, lf: null, st: null, sp: null, y0: null, y1: null } : {};
    const next = { ...state, ...reset, ...patch };
    const url = `${location.pathname}${serialize(next)}${location.hash}`;
    if (url === `${location.pathname}${location.search}${location.hash}`) return;
    state = next;
    history[push ? 'pushState' : 'replaceState'](null, '', url);
    emit(prev);
  }

  addEventListener('popstate', () => {
    const prev = state;
    state = parse(location.search);
    emit(prev);
  });

  return {
    get: () => state,
    set,
    reset: () => set({ ...EMPTY, k: state.k, m: state.m }),
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
