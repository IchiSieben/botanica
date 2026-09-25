/**
 * Explorer client: wires the URL store to the six views.
 *
 * Data flow: event -> store.set() -> URL -> subscribe() -> aggregate() ->
 * views.ts HTML -> morph() into the existing DOM. Morphing (instead of
 * innerHTML) keeps the same elements, so bar transforms transition on the
 * compositor and keyboard focus survives a re-render.
 *
 * Nothing runs per frame: the only timer is the year "play", one step every
 * 700 ms.
 */
import { isGroup, toGroup } from '../lib/growth';
import { createStore, isFiltered, serialize, type State, type Status } from '../lib/store';
import { aggregate, compare, type Facets } from '../lib/facets';
import * as V from '../lib/views';
import { t, fmt, type Locale } from '../lib/i18n';
import { deptName } from '../lib/depts';
import { afterPaint } from '../lib/after-paint';
import { mapZoom } from '../lib/map-zoom';
import { renderDrawer, yearHistogram, type DrawerMap, type DrawerSpecies, type DrawerYearDist } from '../lib/drawer';

interface Config { orderColor: Record<string, string>; records: Record<'plantae' | 'fungi', Record<string, number>>; base: string }
type SpRow = [string, number, number, number, [number, number][], number, number];
interface Names { families: string[]; orders: string[]; depts: string[]; lifeforms: string[]; rows: SpRow[]; meta: { flags: Facets['meta']['flags'] }; byName: Map<string, number> }
type K = 'plantae' | 'fungi';
/** data/protologue-plantae.json: rows aligned with species-plantae.json. */
interface Proto { rows: [ipniId: string, authors: string, acceptedIpniId: string][] }

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

/** Sync `el`'s children to `html` in place when the structure matches;
 *  replace otherwise. Enough of a morph for these flat, keyed views. */
export function morph(el: Element, html: string) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const next = tpl.content;
  if (!sameShape(el, next)) {
    const active = document.activeElement as HTMLElement | null;
    const key = active && el.contains(active) ? focusKey(active) : null;
    el.replaceChildren(...next.childNodes);
    if (key) (el.querySelector(key) as HTMLElement | null)?.focus();
    return;
  }
  syncChildren(el, next);
}

function sameShape(a: ParentNode, b: ParentNode): boolean {
  const x = a.childNodes, y = b.childNodes;
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) {
    if (x[i].nodeName !== y[i].nodeName) return false;
    if (x[i] instanceof Element && !sameShape(x[i] as Element, y[i] as Element)) return false;
  }
  return true;
}

function syncChildren(a: ParentNode, b: ParentNode) {
  const x = a.childNodes, y = b.childNodes;
  for (let i = 0; i < x.length; i++) {
    const o = x[i], n = y[i];
    if (o.nodeType === Node.TEXT_NODE) {
      if (o.textContent !== n.textContent) o.textContent = n.textContent;
      continue;
    }
    if (!(o instanceof Element) || !(n instanceof Element)) continue;
    for (const { name, value } of [...n.attributes]) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
    for (const { name } of [...o.attributes]) if (!n.hasAttribute(name)) o.removeAttribute(name);
    syncChildren(o, n);
  }
}

const FOCUS_KEYS = ['fam', 'lf', 'st', 'decade', 'band', 'clear', 'cmp'];
function focusKey(el: HTMLElement): string | null {
  for (const k of FOCUS_KEYS) {
    const v = el.dataset[k];
    if (v != null) return `[data-${k}="${CSS.escape(v)}"]`;
  }
  return null;
}

export function boot() {
  const root = $('[data-explorer]');
  if (!root) return;
  const locale = (document.documentElement.lang as Locale) || 'en';
  const cfg = JSON.parse($('#ex-config').textContent!) as Config;
  const n = fmt(locale);
  const store = createStore();
  // Pre-v3 links filter by a raw WCVP string (`lf=shrub or tree`); v3 filters by group.
  { const lf = store.get().lf; if (lf && !isGroup(lf)) store.set({ lf: toGroup(lf) }, { push: false }); }
  // The build painted unfiltered Plantae; a shared link's numbers are stale until the data lands.
  if (location.search && serialize(store.get()) !== '') root.classList.add('is-stale');

  // ---- data ----------------------------------------------------------------
  const facetReq = new Map<K, Promise<Facets>>();
  const loadFacets = (k: K) => {
    if (!facetReq.has(k)) {
      facetReq.set(k, fetch(`${cfg.base}data/facets-${k}.json`, { priority: 'low' }).then((r) => {
        if (!r.ok) throw new Error(`${r.status} facets-${k}`);
        return r.json();
      }));
    }
    return facetReq.get(k)!;
  };
  const nameReq = new Map<K, Promise<Names>>();
  const loadNames = (k: K) => {
    if (!nameReq.has(k)) {
      nameReq.set(k, fetch(`${cfg.base}data/species-${k}.json`, { priority: 'low' }).then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} species-${k}`);
        const d = (await r.json()) as Names;
        d.byName = new Map(d.rows.map((row, i) => [row[0], i]));
        return d;
      }));
    }
    return nameReq.get(k)!;
  };
  const facets: Partial<Record<K, Facets>> = {};
  const names: Partial<Record<K, Names>> = {};

  // Local, not in the URL: a legend band highlight is a glance, not a question.
  let band: number | null = null;

  // ---- render ----------------------------------------------------------------
  const el = {
    kpis: $('#kpis'), chips: $('#chips'), families: $('#families'), status: $('#status'),
    lifeforms: $('#lifeforms'), years: $('#years'), legend: $('#legend'), map: $<SVGSVGElement>('#map'),
    readout: $('#readout'), depSelect: $<HTMLSelectElement>('#dep-select'), depDetail: $('#dep-detail'),
    drawer: $('#drawer'), drBody: $('#dr-body'), y0: $<HTMLSelectElement>('#y0'), y1: $<HTMLSelectElement>('#y1'),
    play: $<HTMLButtonElement>('#play'), locked: $('#map-locked'), hint: $('#map-hint'),
    why: $<HTMLDetailsElement>('#dep-why'), mapHowto: $('#cf-map [data-cf-howto]'),
    vp: $('#map-vp'), fs: $<HTMLButtonElement>('#map-fs'), mapFrame: $('#cf-map'),
  };
  const paths = [...el.map.querySelectorAll<SVGPathElement>('path[data-dep]')];
  let lastPaint: V.MapPaint | null = null;

  /** Records and coverage can't be filtered by taxon or year (per-occurrence counts). */
  const metricLocked = (s: State) => !!(s.ord || s.fam || s.st || s.lf || s.y0 != null || s.y1 != null);

  async function render(s: State) {
    root.classList.toggle('is-loading', !facets[s.k]);
    try {
      facets[s.k] ??= await loadFacets(s.k);
      if (s.sp) names[s.k] ??= await loadNames(s.k);
    } catch (e) {
      root.classList.add('is-error');
      console.warn(e);
      return;
    }
    root.classList.remove('is-loading');
    // Let the browser paint the input's own feedback (pressed state, focus ring)
    // before recomputing every view: this keeps a map tap under the INP budget
    // on a 4x-slowed CPU (288 → 88 ms). Also coalesces a burst of states.
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    // A newer state arrived meanwhile: that render wins.
    if (store.get() !== s) return;
    paint(s);
    root.classList.remove('is-stale');
    // The state this DOM shows; tests wait on it instead of on the URL, which runs one frame ahead.
    root.dataset.painted = location.search;
  }

  function paint(s: State) {
    const f = facets[s.k]!;
    const locked = metricLocked(s);
    const eff: State = locked && s.m !== 'species' ? { ...s, m: 'species' } : s;
    const agg = aggregate(f, eff);
    const ctx: V.Ctx = { locale, f, agg, s: eff, orderColor: cfg.orderColor };
    root.dataset.k = s.k;

    morph(el.kpis, V.kpis(ctx));
    morph(el.families, V.families(ctx));
    morph(el.status, V.status(ctx));
    morph(el.lifeforms, V.lifeforms(ctx));
    morph(el.years, V.years(ctx));
    morph(el.chips, chips(s));

    // Controls that mirror the state.
    root.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => press(b, b.dataset.k === s.k));
    root.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) => {
      press(b, b.dataset.m === eff.m);
      b.disabled = locked && b.dataset.m !== 'species';
    });
    el.locked.hidden = !locked || s.m === 'species';
    // The WCVP ∩ GBIF rule (and the Loreto numbers) are about plants.
    el.why.hidden = !(s.dep.length && s.k === 'plantae');
    $('.fungi-only', root).hidden = s.k !== 'fungi';
    el.y0.value = s.y0 != null ? String(s.y0) : '';
    el.y1.value = s.y1 != null ? String(s.y1) : '';
    const noYears = s.k === 'fungi';
    el.y0.disabled = el.y1.disabled = el.play.disabled = noYears;

    paintMap(ctx);
    depPanel(ctx);
    drawer(s, f);
  }

  const press = (b: HTMLElement, on: boolean) => {
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  };

  function paintMap(ctx: V.Ctx) {
    const { s, f } = ctx;
    const sp = s.sp && names[s.k] ? names[s.k]!.byName.get(s.sp) : undefined;
    root.classList.toggle('map-species', sp != null);
    el.mapHowto.textContent = t(locale, sp != null ? 'map.howto.sp' : `map.howto.${s.m}`);
    if (sp != null) {
      // Species mode: where this one species was recorded.
      const mask = f.mask[sp];
      for (const p of paths) {
        const i = f.depts.indexOf(p.dataset.dep!);
        const on = !!((mask >> i) & 1);
        p.setAttribute('class', on ? 'q5' : 'q-1');
        p.setAttribute('aria-pressed', String(s.dep.includes(p.dataset.dep!)));
      }
      el.legend.innerHTML = `<span class="note">${t(locale, 'map.species')}: <i class="sci">${V.esc(s.sp!)}</i></span>`;
      lastPaint = null;
      return;
    }
    const p = V.paintMap(ctx, cfg.records[s.k]);
    lastPaint = p;
    for (const path of paths) {
      const d = path.dataset.dep!;
      const c = p.cls[d] ?? -1;
      const dim = band != null && c !== band;
      const sel = s.dep.includes(d);
      path.setAttribute('class', `q${c}${dim ? ' dim' : ''}${sel ? ' sel' : ''}`);
      path.setAttribute('aria-pressed', String(sel));
      path.setAttribute('aria-label', `${deptName(d)}: ${n(p.values[d] ?? 0)} ${t(locale, `map.m.${s.m}`)}`);
    }
    // Selected departments on top so their outline isn't hidden by neighbours.
    for (const d of s.dep) { const node = paths.find((x) => x.dataset.dep === d); if (node) el.map.appendChild(node); }
    morph(el.legend, V.legend(ctx, p, band));
  }

  function depPanel(ctx: V.Ctx) {
    const { s, f, agg } = ctx;
    el.depSelect.value = s.dep[0] ?? '';
    // visibility, not hidden: dropping the line would move the map up 24 px (CLS on ?dep= links).
    el.hint.style.visibility = s.dep.length > 0 ? 'hidden' : '';
    if (!s.dep.length) {
      el.depDetail.innerHTML = '';
      return;
    }
    const rec = cfg.records[s.k];
    if (s.dep.length === 1) {
      const d = s.dep[0];
      const top = [...agg.byFamily].filter(([i]) => i >= 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const opts = f.depts.filter((x) => x !== d)
        .map((x) => `<option value="${V.esc(x)}">${V.esc(deptName(x))}</option>`).join('');
      morph(el.depDetail, `
        <div class="dep-head"><h4>${V.esc(deptName(d))}</h4>
          <button type="button" class="btn" data-clear="dep">${t(locale, 'dep.clear')}</button></div>
        <p class="dep-nums"><b>${n(agg.total)}</b> ${t(locale, 'dep.species')}${metricLocked(s) ? '' : ` · <b>${n(rec[d] ?? 0)}</b> ${t(locale, 'dep.records')}`}</p>
        ${top.length ? `<p class="label">${t(locale, 'dep.topFamilies')}</p><ol class="toplist">${top.map(([i, v]) =>
          `<li><button type="button" class="linkish" data-fam="${V.esc(f.families[i] ?? '')}">${V.esc(f.families[i] ?? '—')}</button> <span class="mono">${n(v)}</span></li>`).join('')}</ol>` : ''}
        <label class="cmp-pick"><span class="label">${t(locale, 'dep.compare')}</span>
          <select class="btn" data-cmp="pick"><option value="">—</option>${opts}</select></label>`);
      return;
    }
    const [a, b] = s.dep;
    const c = compare(f, s, a, b);
    const tot = Math.max(1, c.onlyA + c.both + c.onlyB);
    const w = (v: number) => ((v / tot) * 100).toFixed(2);
    const fams = (xs: { family: string; species: number }[]) =>
      xs.map((x) => `<li><button type="button" class="linkish" data-fam="${V.esc(x.family)}">${V.esc(x.family)}</button> <span class="mono">${n(x.species)}</span></li>`).join('');
    morph(el.depDetail, `
      <div class="dep-head"><h4>${t(locale, 'cmp.title')}</h4>
        <button type="button" class="btn" data-clear="dep">${t(locale, 'dep.clear')}</button></div>
      <div class="cmp-bar" aria-hidden="true"><i class="a" style="width:${w(c.onlyA)}%"></i><i class="ab" style="width:${w(c.both)}%"></i><i class="b" style="width:${w(c.onlyB)}%"></i></div>
      <dl class="cmp-nums">
        <div><dt><i class="sw a"></i>${t(locale, 'cmp.only')} ${V.esc(deptName(a))}</dt><dd>${n(c.onlyA)}</dd></div>
        <div><dt><i class="sw ab"></i>${t(locale, 'cmp.both')}</dt><dd>${n(c.both)}</dd></div>
        <div><dt><i class="sw b"></i>${t(locale, 'cmp.only')} ${V.esc(deptName(b))}</dt><dd>${n(c.onlyB)}</dd></div>
      </dl>
      <p class="label">${t(locale, 'cmp.exclusive')}</p>
      <div class="cmp-cols"><ol class="toplist">${fams(c.topA)}</ol><ol class="toplist">${fams(c.topB)}</ol></div>`);
  }

  function chips(s: State): string {
    const c: [string, string][] = [];
    const yr = (v: number | null, dflt: string) => (v == null ? dflt : String(v));
    if (s.dep.length) c.push(['dep', s.dep.map(deptName).join(' + ')]);
    if (s.ord) c.push(['ord', s.ord]);
    if (s.fam) c.push(['fam', s.fam]);
    if (s.st) c.push(['st', t(locale, `st.${s.st}`)]);
    if (s.lf) c.push(['lf', V.lfLabel(locale, s.lf)]);
    if (s.y0 != null || s.y1 != null) c.push(['y', `${t(locale, 'year.range')} ${yr(s.y0, '…')}–${yr(s.y1, '…')}`]);
    if (s.sp) c.push(['sp', s.sp]);
    if (!c.length) return `<span class="chip-none">${t(locale, 'filters.none')}</span>`;
    return c.map(([k, label]) =>
      `<button type="button" class="chip" data-clear="${k}" aria-label="${t(locale, 'filters.remove')}: ${V.esc(label)}"><span>${V.esc(label)}</span><b aria-hidden="true">×</b></button>`).join('') +
      (c.length > 1 ? `<button type="button" class="chip clear-all" data-clear="all">${t(locale, 'filters.clear')}</button>` : '');
  }

  // Protologue (author + IPNI ids): plants only, fetched once, on the first drawer open.
  let proto: Proto | null = null;
  let protoReq: Promise<void> | null = null;
  const loadProto = () => {
    protoReq ??= fetch(`${cfg.base}data/protologue-plantae.json`, { priority: 'low' })
      .then((r) => { if (!r.ok) throw new Error(`${r.status} protologue`); return r.json() as Promise<Proto>; })
      .then((d) => { proto = d; drawer(store.get(), facets[store.get().k]!); })
      .catch((e) => { protoReq = null; console.warn(e); });
    return protoReq;
  };

  // Mini department map for the drawer: cloned from the big map's own <path> data
  // (same geometry, no second GeoJSON fetch). Built once, lazily, on first open.
  let drawerMap: DrawerMap | null = null;
  function getDrawerMap(f: Facets): DrawerMap {
    if (!drawerMap) {
      const vb = el.map.getAttribute('viewBox')!.split(/\s+/).map(Number);
      drawerMap = {
        paths: paths.map((p) => ({ name: p.dataset.dep!, d: p.getAttribute('d')! })),
        width: vb[2], height: vb[3],
        facetDepts: f.depts,
      };
    }
    return drawerMap;
  }
  // Year histogram: one per kingdom's facets, cached (not recomputed per drawer open).
  const yearDist = new Map<K, DrawerYearDist | null>();
  function getYearDist(k: K, f: Facets): DrawerYearDist | null {
    if (!yearDist.has(k)) yearDist.set(k, yearHistogram(f.year));
    return yearDist.get(k)!;
  }

  function drawer(s: State, f: Facets) {
    const nm = names[s.k];
    const i = s.sp && nm ? nm.byName.get(s.sp) : undefined;
    if (i == null) {
      if (!el.drawer.hidden) {
        el.drawer.hidden = true;
        root.classList.remove('drawer-open');
      }
      return;
    }
    const r = nm!.rows[i];
    const fam = r[1] >= 0 ? nm!.families[r[1]] : null;
    const ord = r[2] >= 0 ? nm!.orders[r[2]] : null;
    // Growth form: the group from the facets, the raw WCVP string from the species index.
    const group = f.life[i] >= 0 ? f.lifeforms[f.life[i]] : null;
    const raw = r[6] >= 0 ? nm!.lifeforms[r[6]] : null;
    const year = f.year?.[i] || null;
    const plant = s.k === 'plantae';
    if (plant && !proto) void loadProto();
    const genus = r[0].split(' ')[0];
    const sameGenus = nm!.rows
      .filter((row) => row[0] !== r[0] && row[0].split(' ')[0] === genus)
      .map((row) => row[0])
      .slice(0, 12);
    const sp: DrawerSpecies = {
      name: r[0], kingdom: s.k, family: fam, order: ord,
      flags: r[5], flagBits: nm!.meta.flags, records: r[3],
      topDepts: r[4].map(([d, c]) => [deptName(nm!.depts[d]), c]),
      lifeformGroup: group, lifeformRaw: raw, year,
      proto: plant && proto ? { authors: proto.rows[i]?.[1] ?? '', ipniId: proto.rows[i]?.[0] ?? '', acceptedIpniId: proto.rows[i]?.[2] ?? '' } : null,
      deptMask: f.mask[i] ?? null,
      sameGenus,
    };
    const links = {
      mapHref: '#cf-map',
      famHref: fam ? `?${new URLSearchParams({ ...(s.k !== 'plantae' ? { k: s.k } : {}), fam }).toString()}` : null,
      speciesHref: (name: string) => `?${new URLSearchParams({ ...(s.k !== 'plantae' ? { k: s.k } : {}), sp: name }).toString()}`,
    };
    el.drBody.innerHTML = renderDrawer(locale, sp, getDrawerMap(f), plant ? getYearDist(s.k, f) : null, links);
    if (el.drawer.hidden) {
      el.drawer.hidden = false;
      root.classList.add('drawer-open');
      el.drawer.classList.remove('peek');
      $<HTMLElement>('#dr-close').focus({ preventScroll: true });
    }
  }

  // ---- events ------------------------------------------------------------------
  const toggle = <Key extends 'fam' | 'lf' | 'st' | 'ord'>(key: Key, v: State[Key]) =>
    store.set({ [key]: store.get()[key] === v ? null : v } as Partial<State>);

  root.addEventListener('click', (e) => {
    // The drawer's family/same-genus/show-map controls are real <a href> (so a
    // no-JS or middle click still works); everything else stays a <button>.
    const b = (e.target as Element).closest<HTMLElement>('button, [data-dep], a[data-fam], a[data-sp], a[data-act]');
    if (!b || !root.contains(b)) return;
    const d = b.dataset;
    if (d.k) return store.set({ k: d.k as K });
    if (d.m && !(b as HTMLButtonElement).disabled) return store.set({ m: d.m as State['m'] });
    if (d.fam != null) {
      if (b.tagName === 'A') e.preventDefault();
      const s = store.get();
      // From the drawer or a department panel: filter, and close the drawer.
      return store.set({ fam: s.fam === d.fam ? null : d.fam, sp: b.closest('#drawer') ? null : s.sp });
    }
    if (d.sp != null) {
      // Same-genus link in the drawer: select that species, same kingdom.
      e.preventDefault();
      return store.set({ sp: d.sp });
    }
    if (d.lf) return toggle('lf', d.lf);
    if (d.st) return toggle('st', d.st as Status);
    if (d.band) {
      if (!facets[store.get().k]) return;
      band = band === Number(d.band) ? null : Number(d.band);
      return paint(store.get());
    }
    if (d.clear) return clear(d.clear);
    if (d.act === 'show-map') {
      e.preventDefault();
      el.drawer.classList.add('peek');
      el.map.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    if (d.decade && (e as MouseEvent).detail === 0) {
      // Keyboard activation (pointer clicks are handled by the brush below).
      return decadeKey(Number(d.decade), (e as MouseEvent).shiftKey);
    }
  });

  function clear(k: string) {
    if (k === 'all') return store.reset();
    const patch: Partial<State> =
      k === 'dep' ? { dep: [] } : k === 'y' ? { y0: null, y1: null } : ({ [k]: null } as Partial<State>);
    store.set(patch);
  }

  // Map: click/Enter selects, Shift adds a second department (comparison).
  function pickDept(dep: string, add: boolean) {
    const cur = store.get().dep;
    if (add && cur.length && !cur.includes(dep)) return store.set({ dep: [cur[0], dep] });
    if (cur.length === 1 && cur[0] === dep) return store.set({ dep: [] });
    if (cur.includes(dep)) return store.set({ dep: cur.filter((x) => x !== dep) });
    store.set({ dep: [dep] });
  }
  el.map.addEventListener('click', (e) => {
    const p = (e.target as Element).closest<SVGPathElement>('[data-dep]');
    if (p) pickDept(p.dataset.dep!, e.shiftKey || e.metaKey || e.ctrlKey);
  });
  el.map.addEventListener('keydown', (e) => {
    const p = (e.target as Element).closest<SVGPathElement>('[data-dep]');
    if (!p) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pickDept(p.dataset.dep!, e.shiftKey);
      return;
    }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    // Roving tabindex: one tab stop for the whole map, arrows move between departments.
    const order = [...el.map.querySelectorAll<SVGPathElement>('[data-dep]')].sort((a, b) => a.dataset.dep!.localeCompare(b.dataset.dep!));
    const i = order.indexOf(p);
    const next = order[(i + step + order.length) % order.length];
    p.setAttribute('tabindex', '-1');
    next.setAttribute('tabindex', '0');
    next.focus();
  });
  const readout = (p: SVGPathElement | null) => {
    if (!p) { el.readout.innerHTML = '&nbsp;'; return; }
    const d = p.dataset.dep!;
    const s = store.get();
    const v = lastPaint?.values[d];
    const rec = cfg.records[s.k][d] ?? 0;
    el.readout.textContent = lastPaint
      ? `${deptName(d)} · ${n(v ?? 0)} ${t(locale, `map.m.${s.m === 'species' || metricLocked(s) ? 'species' : s.m}`)}${metricLocked(s) ? '' : ` · ${n(rec)} ${t(locale, 'dep.records')}`}`
      : deptName(d);
  };
  // Zoom, pan, fullscreen (lib/map-zoom.ts). Buttons live in the frame's tools.
  const zoom = mapZoom(el.vp, $('#map-zoom'));
  root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.zoom;
    if (a === 'in') zoom.zoomIn();
    else if (a === 'out') zoom.zoomOut();
    else zoom.reset();
  }));
  if (!document.fullscreenEnabled) el.fs.hidden = true;
  el.fs.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.mapFrame.requestFullscreen().catch((e) => console.warn(e));
  });
  document.addEventListener('fullscreenchange', () => {
    const on = document.fullscreenElement === el.mapFrame;
    press(el.fs, on);
    const label = el.fs.dataset[on ? 'on' : 'off']!;
    el.fs.setAttribute('aria-label', label);
    el.fs.title = label;
    requestAnimationFrame(() => zoom.refit());
  });

  el.map.addEventListener('pointerover', (e) => readout((e.target as Element).closest('[data-dep]')));
  el.map.addEventListener('pointerleave', () => readout(null));
  el.map.addEventListener('focusin', (e) => readout((e.target as Element).closest('[data-dep]')));

  el.depSelect.addEventListener('change', () => store.set({ dep: el.depSelect.value ? [el.depSelect.value] : [] }));
  el.depDetail.addEventListener('change', (e) => {
    const sel = e.target as HTMLSelectElement;
    if (sel.dataset.cmp && sel.value) store.set({ dep: [store.get().dep[0], sel.value] });
  });

  // Years: drag across decades to brush a range; click one to select it.
  let brushFrom: number | null = null;
  const decadeAt = (x: number, y: number) => {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-decade]');
    return hit ? Number(hit.dataset.decade) : null;
  };
  el.years.addEventListener('pointerdown', (e) => {
    const d = decadeAt(e.clientX, e.clientY);
    if (d == null || e.button !== 0) return;
    stopPlay();
    const s = store.get();
    if (s.y0 === d && s.y1 === d + 9) {
      store.set({ y0: null, y1: null });
      return;
    }
    brushFrom = d;
    store.set({ y0: d, y1: d + 9 });
  });
  el.years.addEventListener('pointermove', (e) => {
    if (brushFrom == null) return;
    const d = decadeAt(e.clientX, e.clientY);
    if (d == null) return;
    const lo = Math.min(brushFrom, d), hi = Math.max(brushFrom, d);
    store.set({ y0: lo, y1: hi + 9 }, { push: false });
  });
  addEventListener('pointerup', () => { brushFrom = null; });
  addEventListener('pointercancel', () => { brushFrom = null; });
  function decadeKey(d: number, extend: boolean) {
    const s = store.get();
    if (extend && s.y0 != null) return store.set({ y0: Math.min(s.y0, d), y1: Math.max(s.y1 ?? d + 9, d + 9) });
    if (s.y0 === d && s.y1 === d + 9) return store.set({ y0: null, y1: null });
    store.set({ y0: d, y1: d + 9 });
  }
  el.y0.addEventListener('change', () => store.set({ y0: el.y0.value ? Number(el.y0.value) : null }));
  el.y1.addEventListener('change', () => store.set({ y1: el.y1.value ? Number(el.y1.value) : null }));

  // Play: the cumulative flora, decade by decade. A timer, not an animation loop.
  let playTimer: number | undefined;
  function stopPlay() {
    if (playTimer === undefined) return;
    clearTimeout(playTimer);
    playTimer = undefined;
    el.play.textContent = `▶ ${t(locale, 'year.play')}`;
    press(el.play, false);
  }
  // Any change the timer did not make (kingdom, clear all, Back) stops the animation.
  let playing = false;
  store.subscribe(() => { if (!playing && playTimer !== undefined) stopPlay(); });
  const playSet = (patch: Partial<State>, push = false) => { playing = true; store.set(patch, { push }); playing = false; };
  el.play.addEventListener('click', () => {
    if (playTimer !== undefined) return stopPlay();
    press(el.play, true);
    el.play.textContent = `■ ${t(locale, 'year.stop')}`;
    let y1 = V.DECADE_RANGE.first + 9;
    playSet({ y0: null, y1 }, true);
    const step = () => {
      y1 += 10;
      if (y1 > V.DECADE_RANGE.last + 9) {
        stopPlay();
        store.set({ y0: null, y1: null }, { push: false });
        return;
      }
      playSet({ y1 });
      playTimer = window.setTimeout(step, 700);
    };
    playTimer = window.setTimeout(step, 700);
  });

  $('#dr-close').addEventListener('click', () => store.set({ sp: null }));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.drawer.hidden) store.set({ sp: null });
  });

  // ---- search --------------------------------------------------------------------
  const q = $<HTMLInputElement>('#q');
  const list = $<HTMLUListElement>('#q-list');
  let hits: { k: K; i: number }[] = [];
  let active = -1;
  const warm = () => { loadNames('plantae'); loadNames('fungi'); };
  q.addEventListener('focus', warm, { once: true });
  q.addEventListener('pointerenter', warm, { once: true });

  /** Ranked match: prefix of the name, then of any word, then substring, then
   *  in-order letters ("cinoff" finds Cinchona officinalis). Lower is better. */
  function score(name: string, fam: string, needle: string): number {
    const s = name.toLowerCase();
    if (s.startsWith(needle)) return 0;
    if (s.includes(' ' + needle)) return 1;
    if (s.includes(needle)) return 2;
    if (fam.toLowerCase().startsWith(needle)) return 3;
    let j = 0;
    for (let i = 0; i < s.length && j < needle.length; i++) if (s[i] === needle[j]) j++;
    return j === needle.length && needle.length > 2 ? 4 : -1;
  }

  let searchT: number | undefined;
  q.addEventListener('input', () => {
    clearTimeout(searchT);
    searchT = window.setTimeout(runSearch, 90);
  });
  async function runSearch() {
    const needle = q.value.trim().toLowerCase();
    if (!needle) return closeList();
    list.hidden = false;
    q.setAttribute('aria-expanded', 'true');
    if (!names.plantae || !names.fungi) {
      list.innerHTML = `<li class="q-empty">${t(locale, 'search.loading')}</li>`;
      [names.plantae, names.fungi] = await Promise.all([loadNames('plantae'), loadNames('fungi')]);
      if (q.value.trim().toLowerCase() !== needle) return;
    }
    const scored: { k: K; i: number; sc: number; name: string }[] = [];
    for (const k of ['plantae', 'fungi'] as K[]) {
      const nm = names[k]!;
      nm.rows.forEach((r, i) => {
        const sc = score(r[0], r[1] >= 0 ? nm.families[r[1]] : '', needle);
        if (sc >= 0) scored.push({ k, i, sc, name: r[0] });
      });
    }
    scored.sort((a, b) => a.sc - b.sc || a.name.localeCompare(b.name));
    hits = scored.slice(0, 12);
    active = hits.length ? 0 : -1;
    list.innerHTML = hits.length
      ? hits.map((h, j) => {
          const r = names[h.k]!.rows[h.i];
          const fam = r[1] >= 0 ? names[h.k]!.families[r[1]] : '';
          return `<li role="option" id="q-${j}" aria-selected="${j === active}" data-hit="${j}">
            <span class="sci">${V.esc(r[0])}</span><span class="q-fam">${V.esc(fam)}${h.k === 'fungi' ? ` · ${t(locale, 'k.fungi')}` : ''}</span></li>`;
        }).join('') + `<li class="q-hint" aria-hidden="true">${t(locale, 'search.hint')}</li>`
      : `<li class="q-empty">${t(locale, 'search.none')}</li>`;
    q.setAttribute('aria-activedescendant', active >= 0 ? 'q-0' : '');
  }
  function closeList() {
    list.hidden = true;
    q.setAttribute('aria-expanded', 'false');
    q.removeAttribute('aria-activedescendant');
  }
  function choose(j: number) {
    const h = hits[j];
    if (!h) return;
    const name = names[h.k]!.rows[h.i][0];
    closeList();
    q.value = '';
    q.blur();
    store.set({ k: h.k, sp: name });
  }
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!hits.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
      list.querySelectorAll('[role=option]').forEach((li, j) => li.setAttribute('aria-selected', String(j === active)));
      q.setAttribute('aria-activedescendant', `q-${active}`);
      list.querySelector(`#q-${active}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      closeList();
    }
  });
  list.addEventListener('pointerdown', (e) => {
    const li = (e.target as Element).closest<HTMLElement>('[data-hit]');
    if (li) { e.preventDefault(); choose(Number(li.dataset.hit)); }
  });
  q.addEventListener('blur', () => setTimeout(closeList, 120));
  addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(tag)) { e.preventDefault(); q.focus(); }
  });

  // ---- go ------------------------------------------------------------------------
  store.subscribe((s) => { void render(s); });
  // Facets load right after the first paint (the views need them to answer the
  // first click, the build already painted the unfiltered state); names wait for
  // the search box or a ?sp= link.
  void afterPaint().then(() => render(store.get()));
  // Exposed for the gate script and the console, not for the page.
  (window as unknown as { __botanica: unknown }).__botanica = { store, isFiltered };
}
