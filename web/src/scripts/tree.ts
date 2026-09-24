/**
 * Tree page client. Same URL store as the explorer (k, ord, fam), three views:
 * the ECharts tree, the accessible order list, and species per department
 * (from the explorer's facet columns). Any of them selects; all of them follow.
 */
import type { ECharts } from 'echarts/core';
import { createStore, serialize, EMPTY, type State } from '../lib/store';
import { aggregate, type Facets } from '../lib/facets';
import { t, fmt, type Locale } from '../lib/i18n';
import { deptName } from '../lib/depts';

interface Node { name: string; value: number; meta: { rank: string; parent?: string }; children?: Node[]; itemStyle?: { color: string } }
type K = 'plantae' | 'fungi';
interface Tree { chart: ECharts | null; layout: 'radial' | 'orthogonal' }

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function bootTree() {
  const locale = (document.documentElement.lang as Locale) || 'en';
  const n = fmt(locale);
  const base = import.meta.env.BASE_URL;
  const store = createStore();
  const roots = new Map<K, HTMLElement>();
  document.querySelectorAll<HTMLElement>('[data-phylo-root]').forEach((r) => roots.set(r.dataset.k as K, r));
  const trees = new Map<K, Tree>();
  const facets = new Map<K, Promise<Facets>>();
  const loadFacets = (k: K) => {
    if (!facets.has(k)) facets.set(k, fetch(`${base}data/facets-${k}.json`).then((r) => r.json()));
    return facets.get(k)!;
  };
  const treeData = new Map<K, Node[]>();
  const dataOf = (k: K) => {
    if (!treeData.has(k)) treeData.set(k, JSON.parse(roots.get(k)!.querySelector('[data-tree]')!.textContent!));
    return treeData.get(k)!;
  };

  async function mountChart(k: K) {
    const root = roots.get(k)!;
    const tr = trees.get(k) ?? { chart: null, layout: 'radial' as const };
    trees.set(k, tr);
    const { echarts, tokens } = await import('../lib/echarts-tree');
    const el = root.querySelector<HTMLElement>('.chart-phylo')!;
    // ECharts mutates the data it's given (collapse state): hand it a copy.
    const data = JSON.parse(JSON.stringify(dataOf(k))) as Node[];
    const T = tokens();
    const maxV = Math.max(...(data[0].children ?? []).map((c) => c.value));
    const radius = (v: number) => 3 + Math.sqrt(v / maxV) * 9;
    const radial = tr.layout === 'radial';
    tr.chart?.dispose();
    const chart = echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption({
      textStyle: { fontFamily: T.font, color: T.fg },
      tooltip: {
        trigger: 'item', backgroundColor: T.surface, borderColor: T.border,
        textStyle: { color: T.fg, fontFamily: T.font, fontSize: 12 },
        formatter: (p: { name: string; data: Node }) => `<b>${esc(p.name)}</b><br/>${n(p.data.value)} ${t(locale, 'kpi.species')}`,
      },
      series: [{
        type: 'tree', data, layout: tr.layout, roam: true, symbol: 'circle',
        symbolSize: (_: unknown, p: { data: Node }) => radius(p.data?.value ?? 1),
        initialTreeDepth: 1,
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
        emphasis: { focus: 'descendant', itemStyle: { borderColor: T.accent, borderWidth: 2 } },
        expandAndCollapse: true,
        animationDuration: reduced() ? 0 : 400,
        animationDurationUpdate: reduced() ? 0 : 400,
      }],
    });
    chart.on('click', (p) => {
      const d = p.data as unknown as Node;
      const s = store.get();
      if (d.meta.rank === 'order') store.set({ ord: s.ord === d.name && !s.fam ? null : d.name, fam: null });
      else if (d.meta.rank === 'family') store.set({ fam: s.fam === d.name ? null : d.name, ord: d.meta.parent ?? null });
      else store.set({ ord: null, fam: null });
    });
    new ResizeObserver(() => chart.resize()).observe(el);
    tr.chart = chart;
    el.dataset.ready = '1';
  }

  // Charts mount when visible: the page paints without waiting for ECharts.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      void mountChart((e.target as HTMLElement).closest<HTMLElement>('[data-phylo-root]')!.dataset.k as K);
    }
  }, { rootMargin: '200px' });

  for (const [k, root] of roots) {
    root.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((b) =>
      b.addEventListener('click', () => {
        root.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
        trees.set(k, { chart: trees.get(k)?.chart ?? null, layout: b.dataset.layout as Tree['layout'] });
        void mountChart(k);
      }),
    );
    root.querySelector('[data-reset]')?.addEventListener('click', () => void mountChart(k));
    root.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>('[data-ord], [data-fam]');
      if (!b || b.disabled) return;
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
        trees.set(k, { chart: null, layout: 'radial' });
        io.observe(root.querySelector('.chart-phylo')!);
      }
    }
    document.querySelectorAll<HTMLButtonElement>('[data-kset]').forEach((b) => {
      const on = b.dataset.kset === s.k;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const root = roots.get(s.k)!;
    root.querySelectorAll<HTMLButtonElement>('[data-ord]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ord === s.ord)));

    // Families of the selected order, as chips (pick one to narrow further).
    const famBox = root.querySelector<HTMLElement>('[data-fams]')!;
    const order = s.ord ? dataOf(s.k)[0].children?.find((o) => o.name === s.ord) : undefined;
    famBox.innerHTML = order
      ? `<p class="label">${t(locale, 'tree.families')} ${esc(order.name)}</p><div class="fam-chips">${(order.children ?? [])
          .map((f) => `<button type="button" data-fam="${esc(f.name)}" aria-pressed="${f.name === s.fam}"><span>${esc(f.name)}</span> <span class="mono">${n(f.value)}</span></button>`)
          .join('')}</div>`
      : '';

    const group = s.fam ?? s.ord;
    root.querySelector('[data-side-title]')!.textContent = `${t(locale, 'tree.depts')} · ${group ?? t(locale, 'tree.all')}`;
    const q: State = { ...EMPTY, k: s.k, ord: s.ord, fam: s.fam };
    root.querySelector<HTMLAnchorElement>('[data-open]')!.href = `../${serialize(q)}`;

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

  store.subscribe((s) => void render(s));
  void render(store.get());
}
