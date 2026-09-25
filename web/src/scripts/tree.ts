/**
 * Tree page client. Same URL store as the explorer (k, ord, fam), three views:
 * the ECharts tree, the accessible order list, and species per department
 * (from the explorer's facet columns). Any of them selects; all of them follow.
 *
 * v3: the store drives the chart as well (it was one-way before). The expansion
 * state lives HERE, not in ECharts: every render hands ECharts the whole data with
 * an explicit `collapsed` flag per node (`expandAndCollapse: false`), because
 * ECharts rebuilds its tree from the option on every setOption and its own
 * click-toggle would fight the store. A selection:
 *   1. opens every ancestor of the node (and the order itself),
 *   2. bakes the highlight into the data (a programmatic `highlight` would be
 *      wiped by the next hover-out),
 *   3. centres and zooms on the node's layout point,
 *   4. sets `data-focus="<name>"` on the chart element once ECharts is `finished`.
 * With nothing selected (first paint, Reset, clearing, collapse all) the camera fits
 * the visible nodes; opening or closing a group keeps that node where it was.
 */
import type { ECharts } from 'echarts/core';
import { createStore, serialize, EMPTY, type State } from '../lib/store';
import { aggregate, type Facets } from '../lib/facets';
import { t, fmt, localePath, type Key, type Locale } from '../lib/i18n';
import { deptName } from '../lib/depts';
import { afterPaint } from '../lib/after-paint';
import { GROUP_RANKS, nodeSize, type TreeNode } from '../lib/tree-model';

type K = 'plantae' | 'fungi';
type Layout = 'radial' | 'orthogonal';
type Tokens = ReturnType<typeof import('../lib/echarts-tree').tokens>;

/** Zoom used when centring a selection (1 = whole visible tree fits). */
const FOCUS_ZOOM = 2;
/** Largest zoom a "fit the visible tree" view may use (few nodes would blow up). */
const FIT_MAX = 2.5;
const ZOOM_STEP = 1.5;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 12;

interface Index {
  root: TreeNode;
  byId: Map<string, TreeNode>;
  parent: Map<string, string>;
  orders: Map<string, string>;
  families: Map<string, string>;
  maxV: number;
  /** Open by default: every node that still has groups (clade/phylum/class) below it. */
  defaultOpen: string[];
  allOpen: string[];
}

interface Tree {
  layout: Layout;
  expanded: Set<string> | null;
  chart: ECharts | null;
  ro?: ResizeObserver;
  size?: string;
  mounting?: Promise<void>;
  /** Node id the chart is highlighting and centred on. */
  focusId: string | null;
  /** Race token: only the latest selection may touch the chart. */
  seq: number;
  /** Counter for `pending`; separate from `seq` so a re-centre never cancels a selection. */
  tick: number;
  /** Token of the centring waiting for ECharts' `finished` (0 = none). */
  pending: number;
}

// --- ECharts internals we read (not part of the typed public API) -------------
interface Vec { x: number; y: number }
interface ZrEl { parent?: { x: number; y: number } | null; transformCoordToGlobal(x: number, y: number): number[] }
interface ModelNode { isExpand: boolean; children: ModelNode[] }
interface SeriesDataLike {
  tree: { root: ModelNode };
  count(): number;
  getRawDataItem(i: number): { id?: string } | undefined;
  getItemLayout(i: number): Vec | undefined;
  getItemGraphicEl(i: number): ZrEl | undefined;
}
interface ViewLike { getDefaultCenter(): number[]; getZoom(): number; pointToData(p: number[]): number[]; dataToPoint(p: number[]): number[] }
interface SeriesLike { getData(): SeriesDataLike; coordinateSystem?: ViewLike; layoutInfo?: { x: number; y: number; width: number; height: number }; get(k: string): unknown }
const seriesOf = (chart: ECharts): SeriesLike | undefined =>
  (chart as unknown as { getModel(): { getSeriesByIndex(i: number): SeriesLike | undefined } }).getModel().getSeriesByIndex(0);

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Resolve after the next paint: the tap's own feedback shows before chart work. */
const afterNextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export function bootTree() {
  const locale = (document.documentElement.lang as Locale) || 'en';
  const n = fmt(locale);
  const base = import.meta.env.BASE_URL;
  const store = createStore();
  const roots = new Map<K, HTMLElement>();
  document.querySelectorAll<HTMLElement>('[data-phylo-root]').forEach((r) => roots.set(r.dataset.k as K, r));
  const trees = new Map<K, Tree>();
  const treeOf = (k: K): Tree => {
    if (!trees.has(k)) trees.set(k, { layout: 'radial', expanded: null, chart: null, focusId: null, seq: 0, tick: 0, pending: 0 });
    return trees.get(k)!;
  };
  const chartEl = (k: K) => roots.get(k)!.querySelector<HTMLElement>('.chart-phylo')!;

  const facets = new Map<K, Promise<Facets>>();
  const loadFacets = (k: K) => {
    if (!facets.has(k)) facets.set(k, fetch(`${base}data/facets-${k}.json`, { priority: 'low' }).then((r) => {
      if (!r.ok) { facets.delete(k); throw new Error(`facets-${k}: ${r.status}`); }
      return r.json();
    }));
    return facets.get(k)!;
  };

  const indexes = new Map<K, Index>();
  const indexOf = (k: K): Index => {
    if (indexes.has(k)) return indexes.get(k)!;
    const [root] = JSON.parse(roots.get(k)!.querySelector('[data-tree]')!.textContent!) as TreeNode[];
    const ix: Index = { root, byId: new Map(), parent: new Map(), orders: new Map(), families: new Map(), maxV: 1, defaultOpen: [], allOpen: [] };
    const walk = (x: TreeNode, parent?: TreeNode) => {
      ix.byId.set(x.id, x);
      if (parent) { ix.parent.set(x.id, parent.id); ix.maxV = Math.max(ix.maxV, x.value); }
      if (x.meta.rank === 'order' && !x.meta.unplaced) ix.orders.set(x.meta.key, x.id);
      if (x.meta.rank === 'family') ix.families.set(x.meta.key, x.id);
      if (x.children?.length) {
        ix.allOpen.push(x.id);
        if (x.children.some((c) => GROUP_RANKS.has(c.meta.rank))) ix.defaultOpen.push(x.id);
        x.children.forEach((c) => walk(c, x));
      }
    };
    walk(root);
    indexes.set(k, ix);
    return ix;
  };

  let echartsMod: Promise<typeof import('../lib/echarts-tree')> | null = null;
  let T: Tokens;

  // --- data handed to ECharts: expansion + highlight baked in ------------------
  function chartData(k: K, tr: Tree) {
    const ix = indexOf(k);
    const focus = tr.focusId;
    const path = new Set<string>();
    for (let id: string | undefined = focus ?? undefined; id; id = ix.parent.get(id)) path.add(id);
    const inBranch = (id: string) => focus != null && (id === focus || id.startsWith(`${focus}/`));
    const rec = (x: TreeNode): Record<string, unknown> => {
      const group = x.meta.rank === 'kingdom' || GROUP_RANKS.has(x.meta.rank);
      const color = group ? T.muted : x.itemStyle?.color ?? T.muted;
      const kids = x.children?.length ? x.children : null;
      const open = !!kids && tr.expanded!.has(x.id);
      const item: Record<string, unknown> = { id: x.id, name: x.name, value: x.value, meta: x.meta };
      // A ring marks a closed group: something to open.
      let itemStyle: Record<string, unknown> = kids && !open ? { color, borderColor: T.fg, borderWidth: 1.5 } : { color };
      if (focus) {
        if (path.has(x.id)) {
          itemStyle = { color, borderColor: T.accent, borderWidth: x.id === focus ? 3 : 2 };
          item.lineStyle = { color: T.accent, width: 2, opacity: 1 };
          if (x.id === focus) item.label = { fontWeight: 'bold', fontSize: 12 };
        } else if (!inBranch(x.id)) {
          itemStyle = { ...itemStyle, opacity: 0.3 };
          item.lineStyle = { opacity: 0.3 };
          item.label = { color: T.muted };
        }
      }
      item.itemStyle = itemStyle;
      // Only the visible part goes to ECharts: it rebuilds its whole tree on every
      // setOption, so hidden branches would cost time for nothing (4x CPU: the
      // re-centring setOption went from ~80-130 ms to ~15-85 ms).
      if (kids) { item.collapsed = !open; if (open) item.children = kids.map(rec); }
      return item;
    };
    return [rec(ix.root)];
  }

  function seriesOption(k: K, tr: Tree) {
    const ix = indexOf(k);
    const radial = tr.layout === 'radial';
    return {
      id: 'tree', type: 'tree', layout: tr.layout, roam: true, symbol: 'circle',
      symbolSize: (_: unknown, p: { data: TreeNode }) => (p.data?.meta?.rank === 'kingdom' ? 18 : nodeSize(p.data?.value ?? 1, ix.maxV)),
      // Expansion is ours (see the header); ECharts must not toggle on click.
      expandAndCollapse: false,
      // The label ring lives outside the tree's radius: padding sized for the
      // nodes alone clips the bottom names against the container.
      top: radial ? '18%' : '3%', bottom: radial ? '18%' : '3%',
      left: radial ? '16%' : '12%', right: radial ? '16%' : '24%',
      lineStyle: { color: T.border, width: 1, curveness: 0.45 },
      label: {
        color: T.fg, fontSize: 10, fontFamily: T.font, position: radial ? 'right' : 'left',
        align: radial ? undefined : 'right', overflow: 'truncate', width: 108, ellipsis: '…',
      },
      leaves: { label: { position: 'right', align: 'left', fontSize: 9, overflow: 'truncate', width: 92, ellipsis: '…' } },
      // Hover: no symbol scaling and no state tween (the canvas still repaints).
      emphasis: { focus: 'descendant', scale: false, itemStyle: { borderColor: T.accent, borderWidth: 2 } },
      stateAnimation: { duration: 0 },
      scaleLimit: { min: ZOOM_MIN, max: ZOOM_MAX },
      animationDuration: reduced() ? 0 : 400,
      animationDurationUpdate: reduced() ? 0 : 300,
    };
  }

  const setSeries = (chart: ECharts, patch: Record<string, unknown>) =>
    chart.setOption({ series: [{ id: 'tree', ...patch }] } as never);

  // --- geometry ------------------------------------------------------------------
  // ECharts' tree view draws a point q of its group as
  //   pixel(q) = (q - center) * zoom + defaultCenter
  // where q = layout point + the inner group's offset (TreeView's _mainGroup, the
  // symbols' parent) and defaultCenter is the centre of the visible layout's bbox
  // (coord/View.js: the raw transform is the identity for trees). Solving for
  // `center` puts any q at any pixel V: center = q - (V - defaultCenter) / zoom.
  // scripts/gate-tree.mjs checks the drawn symbol, not this formula.
  const chartCentre = (chart: ECharts) => [chart.getWidth() / 2, chart.getHeight() / 2];

  function findIndex(data: SeriesDataLike, id: string): number {
    for (let i = 0, c = data.count(); i < c; i++) if (data.getRawDataItem(i)?.id === id) return i;
    return -1;
  }

  function geometry(chart: ECharts) {
    const sm = seriesOf(chart);
    const view = sm?.coordinateSystem;
    if (!sm || !view) return null;
    const data = sm.getData();
    let M: number[] | null = null;
    for (let i = 0, c = data.count(); i < c && !M; i++) {
      const g = data.getItemGraphicEl(i)?.parent;
      if (g) M = [g.x, g.y];
    }
    if (!M) {
      const li = sm.layoutInfo ?? { x: 0, y: 0, width: 0, height: 0 };
      M = sm.get('layout') === 'radial' ? [li.x + li.width / 2, li.y + li.height / 2] : [li.x, li.y];
    }
    return { sm, view, data, M };
  }

  /** The node's point in the view group (q), or null when it is not laid out (hidden). */
  function pointQ(chart: ECharts, id: string): number[] | null {
    const g = geometry(chart);
    if (!g) return null;
    const i = findIndex(g.data, id);
    const L = i >= 0 ? g.data.getItemLayout(i) : undefined;
    return L && !Number.isNaN(L.x) ? [L.x + g.M[0], L.y + g.M[1]] : null;
  }

  function cameraFor(chart: ECharts, q: number[], zoom: number, V = chartCentre(chart)) {
    const view = geometry(chart)?.view;
    if (!view) return null;
    const d = view.getDefaultCenter();
    return { center: [q[0] - (V[0] - d[0]) / zoom, q[1] - (V[1] - d[1]) / zoom], zoom };
  }

  /** Camera that fits every visible node, leaving room for the labels around them. */
  function fitCamera(chart: ECharts, layout: Layout) {
    const g = geometry(chart);
    if (!g) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0, c = g.data.count(); i < c; i++) {
      const L = g.data.getItemLayout(i);
      if (!L || Number.isNaN(L.x) || !g.data.getItemGraphicEl(i)) continue;
      x0 = Math.min(x0, L.x); x1 = Math.max(x1, L.x); y0 = Math.min(y0, L.y); y1 = Math.max(y1, L.y);
    }
    if (!Number.isFinite(x0)) return null;
    const W = chart.getWidth(), H = chart.getHeight();
    // Radial labels point outwards on every side; linear ones sit left of inner
    // nodes and right of leaves.
    const pad = layout === 'radial'
      ? { l: Math.min(96, W * 0.16), r: Math.min(96, W * 0.16), t: Math.min(80, H * 0.13), b: Math.min(80, H * 0.13) }
      : { l: Math.min(120, W * 0.24), r: Math.min(110, W * 0.22), t: Math.min(24, H * 0.05), b: Math.min(24, H * 0.05) };
    const aw = Math.max(40, W - pad.l - pad.r), ah = Math.max(40, H - pad.t - pad.b);
    const zoom = Math.min(FIT_MAX, Math.max(ZOOM_MIN, Math.min(aw / Math.max(1, x1 - x0), ah / Math.max(1, y1 - y0))));
    const q = [(x0 + x1) / 2 + g.M[0], (y0 + y1) / 2 + g.M[1]];
    return cameraFor(chart, q, zoom, [pad.l + aw / 2, pad.t + ah / 2]);
  }

  // --- selection → chart -------------------------------------------------------------
  function targetOf(k: K, s: State): string | null {
    const ix = indexOf(k);
    return (s.fam && ix.families.get(s.fam)) || (s.ord && ix.orders.get(s.ord)) || null;
  }

  function markFocused(k: K, token: number) {
    const tr = treeOf(k);
    if (tr.pending !== token || !tr.focusId) return;
    tr.pending = 0;
    chartEl(k).dataset.focus = indexOf(k).byId.get(tr.focusId)!.meta.key;
  }

  function centreOnFocus(k: K) {
    const tr = treeOf(k);
    const chart = tr.chart;
    if (!chart || !tr.focusId) return;
    const token = ++tr.tick;
    const q = pointQ(chart, tr.focusId);
    tr.pending = token;
    // 'finished' can fire inside setOption when nothing animates: arm first.
    setTimeout(() => markFocused(k, token), reduced() ? 0 : 1200);
    setSeries(chart, (q && cameraFor(chart, q, FOCUS_ZOOM)) || {});
  }

  async function syncFocus(k: K, s: State, { now = false } = {}) {
    // get, not treeOf: creating the hidden kingdom's entry here would make render() skip
    // io.observe for it, and that tree would never mount (blank after a kingdom switch).
    const tr = trees.get(k);
    if (!tr?.chart) return; // mountChart syncs when it is done
    const token = ++tr.seq;
    if (!now) await afterNextPaint();
    if (token !== tr.seq || !tr.chart) return;
    const el = chartEl(k);
    const target = s.k === k ? targetOf(k, s) : null;
    if (!target) {
      tr.pending = 0;
      if (!tr.focusId && !el.dataset.focus) return;
      tr.focusId = null;
      delete el.dataset.focus;
      // Same expansion, so the layout (and the fit) of the current render holds.
      setSeries(tr.chart, { data: chartData(k, tr), ...fitCamera(tr.chart, tr.layout) });
      return;
    }
    if (target === tr.focusId && el.dataset.focus) return;
    const ix = indexOf(k);
    for (let id = ix.parent.get(target); id; id = ix.parent.get(id)) tr.expanded!.add(id);
    if (ix.byId.get(target)!.children?.length) tr.expanded!.add(target);
    tr.focusId = target;
    tr.pending = 0;
    delete el.dataset.focus;
    // 1. relayout with the path open, 2. read the node's layout point, 3. centre.
    setSeries(tr.chart, { data: chartData(k, tr) });
    centreOnFocus(k);
  }

  function relayout(k: K) {
    const tr = treeOf(k);
    if (tr.chart) setSeries(tr.chart, { data: chartData(k, tr) });
  }

  function fit(k: K) {
    const tr = treeOf(k);
    const cam = tr.chart && fitCamera(tr.chart, tr.layout);
    if (cam) setSeries(tr.chart!, cam);
  }

  async function mountChart(k: K) {
    const tr = treeOf(k);
    echartsMod ??= import('../lib/echarts-tree');
    const { echarts, tokens } = await echartsMod;
    const el = chartEl(k);
    tr.ro?.disconnect();
    tr.chart?.dispose();
    T = tokens();
    tr.expanded ??= new Set(indexOf(k).defaultOpen);
    tr.focusId = null;
    tr.pending = 0;
    delete el.dataset.focus;
    const chart = echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption({
      textStyle: { fontFamily: T.font, color: T.fg },
      tooltip: {
        trigger: 'item', backgroundColor: T.surface, borderColor: T.border,
        textStyle: { color: T.fg, fontFamily: T.font, fontSize: 12 },
        formatter: (p: { name: string; data: TreeNode }) =>
          `<b>${esc(p.name)}</b> · ${t(locale, `tree.rank.${p.data.meta.rank}` as Key)}<br/>${n(p.data.value)} ${t(locale, 'kpi.species')}`,
      },
      series: [{ ...seriesOption(k, tr), data: chartData(k, tr) }],
    } as never);
    const cam = fitCamera(chart, tr.layout);
    if (cam) setSeries(chart, cam);
    chart.on('click', (p) => {
      const d = p.data as unknown as TreeNode;
      const s = store.get();
      const rank = d.meta.rank;
      if (rank === 'kingdom') store.set({ ord: null, fam: null });
      else if (GROUP_RANKS.has(rank) || d.meta.unplaced) toggle(k, d.id);
      else if (rank === 'order') store.set({ ord: s.ord === d.meta.key && !s.fam ? null : d.meta.key, fam: null });
      else if (rank === 'family') store.set({ fam: s.fam === d.meta.key ? null : d.meta.key, ord: d.meta.parent ?? null });
    });
    chart.on('finished', () => { if (tr.pending && tr.chart === chart) markFocused(k, tr.pending); });
    tr.ro = new ResizeObserver(() => {
      const size = `${el.clientWidth}x${el.clientHeight}`;
      if (size === tr.size) return;
      tr.size = size;
      chart.resize();
      // Entering full screen (or rotating a phone) keeps the selection centred,
      // or the whole visible tree fitted.
      if (tr.focusId && el.dataset.focus) centreOnFocus(k);
      else fit(k);
    });
    tr.size = `${el.clientWidth}x${el.clientHeight}`;
    tr.ro.observe(el);
    tr.chart = chart;
    el.dataset.ready = '1';
    await syncFocus(k, store.get(), { now: true });
  }

  /** Idempotent: the observer, a list click or a tool button may all ask first. */
  const mount = (k: K) => (treeOf(k).mounting ??= mountChart(k));
  const remount = (k: K) => (treeOf(k).mounting = mountChart(k));

  function toggle(k: K, id: string) {
    const tr = treeOf(k);
    const chart = tr.chart;
    if (!tr.expanded || !chart) return;
    // The clicked node stays where it was on screen while its branch opens or closes.
    const g = geometry(chart);
    const q0 = pointQ(chart, id);
    const at = g && q0 ? g.view.dataToPoint(q0) : null;
    const zoom = g?.view.getZoom() ?? 1;
    if (tr.expanded.has(id)) tr.expanded.delete(id);
    else tr.expanded.add(id);
    // Closing an ancestor hides the selected node: it is no longer "in focus".
    if (tr.focusId?.startsWith(`${id}/`) && !tr.expanded.has(id)) delete chartEl(k).dataset.focus;
    relayout(k);
    const q1 = pointQ(chart, id);
    const cam = at && q1 ? cameraFor(chart, q1, zoom, at) : null;
    if (cam) setSeries(chart, cam);
  }

  // Charts mount when visible: the page paints without waiting for ECharts.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-phylo-root]')!.dataset.k as K;
      void afterPaint().then(() => mount(k));
    }
  }, { rootMargin: '200px' });

  const fsLabel = () => {
    for (const root of roots.values()) {
      const b = root.querySelector<HTMLButtonElement>('[data-fs]');
      if (!b) continue;
      const on = document.fullscreenElement === root.querySelector('.phylo-frame');
      const label = (on ? b.dataset.onLabel : b.dataset.offLabel) ?? '';
      b.setAttribute('aria-label', label);
      b.title = label;
      b.toggleAttribute('data-on', on);
    }
  };
  document.addEventListener('fullscreenchange', fsLabel);

  for (const [k, root] of roots) {
    root.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((b) =>
      b.addEventListener('click', () => {
        root.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
        treeOf(k).layout = b.dataset.layout as Layout;
        void remount(k);
      }),
    );
    // Reset = fit the whole visible tree again (expansion and selection stay).
    root.querySelector('[data-reset]')?.addEventListener('click', async () => {
      await mount(k);
      fit(k);
    });
    root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) =>
      b.addEventListener('click', async () => {
        await mount(k);
        const chart = treeOf(k).chart;
        const view = chart && seriesOf(chart)?.coordinateSystem;
        if (!chart || !view) return;
        // Zoom about the middle of the canvas: keep the point under it in place.
        const z = view.getZoom();
        const z2 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, b.dataset.zoom === 'in' ? z * ZOOM_STEP : z / ZOOM_STEP));
        const V = chartCentre(chart);
        const q = view.pointToData(V);
        const d = view.getDefaultCenter();
        setSeries(chart, { center: [q[0] - (V[0] - d[0]) / z2, q[1] - (V[1] - d[1]) / z2], zoom: z2 });
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-expand]').forEach((b) =>
      b.addEventListener('click', async () => {
        await mount(k);
        const tr = treeOf(k);
        if (!tr.chart) return;
        const ix = indexOf(k);
        const all = b.dataset.expand === 'all';
        tr.expanded = new Set(all ? ix.allOpen : [ix.root.id]);
        relayout(k);
        if (all && tr.focusId) centreOnFocus(k);
        else { tr.pending = 0; delete chartEl(k).dataset.focus; fit(k); }
      }),
    );
    const fsBtn = root.querySelector<HTMLButtonElement>('[data-fs]');
    const frame = root.querySelector<HTMLElement>('.phylo-frame');
    if (fsBtn && frame) {
      if (!document.fullscreenEnabled) fsBtn.hidden = true;
      fsBtn.addEventListener('click', () => {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void frame.requestFullscreen().catch(() => {});
      });
    }
    root.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>('[data-ord], [data-fam]');
      if (!b || b.disabled) return;
      void mount(k);
      const s = store.get();
      if (b.dataset.ord != null) store.set({ ord: s.ord === b.dataset.ord ? null : b.dataset.ord, fam: null });
      else store.set({ fam: s.fam === b.dataset.fam ? null : b.dataset.fam! });
    });
  }

  document.querySelectorAll<HTMLButtonElement>('[data-kset]').forEach((b) =>
    b.addEventListener('click', () => store.set({ k: b.dataset.kset as K })),
  );

  async function render(s: State) {
    for (const [k, root] of roots) {
      const on = k === s.k;
      root.hidden = !on;
      if (on && !trees.has(k)) {
        treeOf(k);
        io.observe(chartEl(k));
      }
    }
    document.querySelectorAll<HTMLButtonElement>('[data-kset]').forEach((b) => {
      const on = b.dataset.kset === s.k;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const root = roots.get(s.k)!;
    const ix = indexOf(s.k);
    const famNode = s.fam ? ix.byId.get(ix.families.get(s.fam) ?? '') : undefined;
    const ord = s.ord ?? famNode?.meta.parent ?? null;
    root.querySelectorAll<HTMLButtonElement>('[data-ord]').forEach((b) => b.setAttribute('aria-pressed', String(!!ord && b.dataset.ord === ord)));
    // A selection made in the chart or by the URL scrolls the list (not the page) to it.
    requestAnimationFrame(() => {
      const pressed = root.querySelector<HTMLElement>('[data-ord][aria-pressed="true"]');
      const box = root.querySelector<HTMLElement>('.ord-list');
      if (!pressed || !box) return;
      const b = pressed.getBoundingClientRect(), c = box.getBoundingClientRect();
      if (b.top < c.top || b.bottom > c.bottom) box.scrollTop += b.top - c.top - (c.height - b.height) / 2;
    });

    // Families of the selected order, as chips (pick one to narrow further).
    const famBox = root.querySelector<HTMLElement>('[data-fams]')!;
    const order = ord ? ix.byId.get(ix.orders.get(ord) ?? '') : undefined;
    famBox.innerHTML = order
      ? `<p class="label">${t(locale, 'tree.families')} ${esc(order.name)}</p><div class="fam-chips">${(order.children ?? [])
          .map((f) => `<button type="button" data-fam="${esc(f.name)}" aria-pressed="${f.name === s.fam}"><span>${esc(f.name)}</span> <span class="mono">${n(f.value)}</span></button>`)
          .join('')}</div>`
      : '';

    const group = s.fam ?? s.ord;
    root.querySelector('[data-side-title]')!.textContent = `${t(locale, 'tree.group')}: ${group ?? t(locale, 'tree.all')}`;
    const q: State = { ...EMPTY, k: s.k, ord: s.ord, fam: s.fam };
    root.querySelector<HTMLAnchorElement>('[data-open]')!.href = `${localePath(locale)}${serialize(q)}`;

    // Nothing selected: the build already rendered the whole-kingdom bars.
    if (!s.ord && !s.fam && !facets.has(s.k)) return;
    const f = await loadFacets(s.k);
    if (store.get() !== s) return;
    const agg = aggregate(f, q);
    const rows = f.depts.map((d, i) => [d, agg.byDept[i]] as const).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, rows[0][1]);
    const color = order?.itemStyle?.color;
    root.querySelector('[data-depts]')!.innerHTML = rows
      .map(([d, v]) => `<li><span>${esc(deptName(d))}</span><i style="transform:scaleX(${(v / max).toFixed(3)})${color ? `;--c:${color}` : ''}"></i><b>${n(v)}</b></li>`)
      .join('');
  }

  store.subscribe((s) => {
    void render(s);
    for (const k of roots.keys()) void syncFocus(k, s);
  });
  void render(store.get());

  // Test hook (scripts/gate-tree.mjs): read-only views of what the canvas draws.
  const hook = (k: K) => {
    const series = () => (treeOf(k).chart ? seriesOf(treeOf(k).chart!) : undefined);
    const pointOf = (id: string | null) => {
      const sm = series();
      if (!sm || !id) return null;
      const data = sm.getData();
      const i = findIndex(data, id);
      const g = i >= 0 ? data.getItemGraphicEl(i) : undefined;
      if (!g) return null;
      const [x, y] = g.transformCoordToGlobal(0, 0);
      const r = chartEl(k).getBoundingClientRect();
      return { x: r.left + x, y: r.top + y };
    };
    return {
      focusPoint: () => pointOf(treeOf(k).focusId),
      /** Drawn position of any node, by canonical name (order, family, clade, phylum...). */
      nodePoint: (key: string) => pointOf([...indexOf(k).byId.values()].find((x) => x.meta.key === key)?.id ?? null),
      zoom: () => series()?.coordinateSystem?.getZoom() ?? null,
      visible: () => {
        const sm = series();
        if (!sm) return null;
        const count = (m: ModelNode): number => (m.isExpand ? m.children.reduce((s, c) => s + 1 + count(c), 0) : 0);
        return count(sm.getData().tree.root);
      },
    };
  };
  (window as unknown as { __phylo: Record<K, ReturnType<typeof hook>> }).__phylo = { plantae: hook('plantae'), fungi: hook('fungi') };
}
