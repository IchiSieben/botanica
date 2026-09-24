/**
 * View renderers: (aggregates, state) -> HTML string.
 *
 * Pure and DOM-free, so the build renders the first paint with them (no layout
 * shift, content without JS) and the browser re-renders with the same code on
 * every state change. Each clickable thing is a real <button> with a data-*
 * attribute naming the state key it writes; one delegated listener in
 * explorer.ts turns clicks into store.set().
 *
 * Bars grow with `transform: scaleX()` (compositor-only, CONCEPT-v2 law 1).
 */
import { DECADE0, DECADES, type Aggregates, type Facets } from './facets';
import type { State, Status } from './store';
import { t, fmt, type Locale } from './i18n';

export interface Ctx {
  locale: Locale;
  f: Facets;
  agg: Aggregates;
  s: State;
  /** order name -> colour (from the ETL, same as the tree page). */
  orderColor: Record<string, string>;
}

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);
export { esc };

const isFungi = (c: Ctx) => c.s.k === 'fungi';

export function naFungi(locale: Locale): string {
  return `<p class="na">${t(locale, 'na.fungi')}</p>`;
}

// ---- KPIs ---------------------------------------------------------------
export function kpis(c: Ctx): string {
  const n = fmt(c.locale), a = c.agg;
  const items: [string, string][] = [
    [n(a.total), t(c.locale, 'kpi.species')],
    [n(a.families), t(c.locale, 'kpi.families')],
    [n(a.orders), t(c.locale, 'kpi.orders')],
  ];
  if (!isFungi(c)) {
    items.push([n(a.endemic), t(c.locale, 'kpi.endemic')]);
    items.push([a.medianYear ? String(a.medianYear) : '—', t(c.locale, 'kpi.median')]);
  } else {
    items.push([n(a.withRecords), t(c.locale, 'kpi.withRecords')]);
  }
  return items.map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
}

// ---- Families: squarified treemap ---------------------------------------
interface Tile { key: string; label: string; value: number; color: string; order: string }

/** Bruls et al. squarify into a W×H box; returns rects in box units. */
function squarify(values: number[], W: number, H: number) {
  const total = values.reduce((s, v) => s + v, 0) || 1;
  const areas = values.map((v) => (v / total) * W * H);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  let x = 0, y = 0, w = W, h = H, i = 0;
  const worst = (row: number[], side: number) => {
    const s = row.reduce((a, b) => a + b, 0);
    const mx = Math.max(...row), mn = Math.min(...row);
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  while (i < areas.length) {
    const side = Math.min(w, h);
    const row = [areas[i]];
    let j = i + 1;
    while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) row.push(areas[j++]);
    const s = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      const cw = s / h;
      let cy = y;
      for (const a of row) { out.push({ x, y: cy, w: cw, h: a / cw }); cy += a / cw; }
      x += cw; w -= cw;
    } else {
      const ch = s / w;
      let cx = x;
      for (const a of row) { out.push({ x: cx, y, w: a / ch, h: ch }); cx += a / ch; }
      y += ch; h -= ch;
    }
    i = j;
  }
  return out;
}

/** Relative luminance, to pick dark or light text on a tile. */
function lum(hex: string): number {
  const m = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((o) => {
    const v = parseInt(m.slice(o, o + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const famOrderCache = new WeakMap<Facets, Map<number, number>>();
/** family index -> order index, built once per facet file. */
function famOrder(f: Facets): Map<number, number> {
  let m = famOrderCache.get(f);
  if (!m) {
    m = new Map();
    for (let i = 0; i < f.fam.length; i++) if (!m.has(f.fam[i])) m.set(f.fam[i], f.ord[i]);
    famOrderCache.set(f, m);
  }
  return m;
}

const TOP_FAMILIES = 24;
const TM_W = 100, TM_H = 62.5; // 16:10

export function families(c: Ctx): string {
  const n = fmt(c.locale);
  const rows = [...c.agg.byFamily].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return `<p class="na">${t(c.locale, 'search.none')}</p>`;
  const total = rows.reduce((s, [, v]) => s + v, 0);
  const tiles: Tile[] = rows.slice(0, TOP_FAMILIES).map(([i, v]) => {
    const fam = c.f.families[i] ?? '—';
    const ordIdx = famOrder(c.f).get(i) ?? -1;
    const order = c.f.orders[ordIdx] ?? '—';
    return { key: fam, label: fam, value: v, order, color: c.orderColor[order] ?? '#566b61' };
  });
  const rest = rows.slice(TOP_FAMILIES);
  // A selected family outside the top 24 still gets its own tile.
  if (c.s.fam && !tiles.some((x) => x.key === c.s.fam)) {
    const hit = rest.find(([i]) => c.f.families[i] === c.s.fam);
    if (hit) tiles.push({ key: c.s.fam, label: c.s.fam, value: hit[1], order: '', color: '#566b61' });
  }
  const restSum = rest.filter(([i]) => c.f.families[i] !== c.s.fam).reduce((s, [, v]) => s + v, 0);
  // The long tail is a caption, not a tile: as a tile it took a third of the
  // area and squeezed the families people actually click.
  const all = [...tiles];
  const caption = restSum
    ? `<p class="tm-rest note">+${n(rest.length)} ${t(c.locale, 'fam.others')} · ${n(restSum)} ${t(c.locale, 'kpi.species')}</p>`
    : '';

  const rects = squarify(all.map((x) => x.value), TM_W, TM_H);
  return `<div class="tm-box">${all
    .map((tile, i) => {
      const r = rects[i];
      const pct = ((tile.value / total) * 100).toFixed(1);
      const style = `left:${((r.x / TM_W) * 100).toFixed(2)}%;top:${((r.y / TM_H) * 100).toFixed(2)}%;` +
        `width:${((r.w / TM_W) * 100).toFixed(2)}%;height:${((r.h / TM_H) * 100).toFixed(2)}%;` +
        (tile.color ? `--c:${tile.color};--tc:${lum(tile.color) > 0.3 ? '#0d1117' : '#f6f8fa'};` : '') +
        `--share:${(tile.value / rows[0][1]).toFixed(3)}`;
      const small = r.w * r.h < 22 ? ' sm' : '';
      if (!tile.key) {
        return `<div class="tile rest${small}" style="${style}"><span class="nm">${esc(tile.label)}</span><span class="v">${n(tile.value)}</span></div>`;
      }
      const on = c.s.fam === tile.key;
      return `<button type="button" class="tile${small}${on ? ' on' : ''}" style="${style}" data-fam="${esc(tile.key)}" aria-pressed="${on}"
        title="${esc(tile.label)} · ${n(tile.value)} (${pct} %)${tile.order ? ` · ${t(c.locale, 'fam.order')} ${esc(tile.order)}` : ''}"><span class="nm sci-f">${esc(tile.label)}</span><span class="v">${n(tile.value)}</span></button>`;
    })
    .join('')}</div>${caption}`;
}

// ---- Generic horizontal bars ---------------------------------------------
interface Bar { key: string; label: string; value: number; muted?: boolean }

function bars(c: Ctx, items: Bar[], attr: string, selected: string | null): string {
  const n = fmt(c.locale);
  const max = Math.max(1, ...items.map((b) => b.value));
  return items
    .map((b) => {
      const on = selected === b.key;
      const tag = b.key ? 'button' : 'div';
      const act = b.key ? ` type="button" data-${attr}="${esc(b.key)}" aria-pressed="${on}"` : '';
      return `<${tag} class="bar${on ? ' on' : ''}${b.muted ? ' muted' : ''}${b.value ? '' : ' zero'}"${act}>
        <span class="bl">${esc(b.label)}</span><span class="bv">${n(b.value)}</span>
        <span class="bt" aria-hidden="true"><i style="transform:scaleX(${(b.value / max).toFixed(4)})"></i></span></${tag}>`;
    })
    .join('');
}

const TOP_LIFE = 10;
export function lifeforms(c: Ctx): string {
  if (isFungi(c)) return naFungi(c.locale);
  const rows = [...c.agg.byLife].sort((a, b) => b[1] - a[1]);
  const items: Bar[] = [];
  let rest = 0, restN = 0;
  for (const [i, v] of rows) {
    const key = i < 0 ? '' : c.f.lifeforms[i];
    if (i < 0) { items.push({ key: '', label: t(c.locale, 'life.nodata'), value: v, muted: true }); continue; }
    if (items.filter((x) => x.key).length < TOP_LIFE || key === c.s.lf) items.push({ key, label: key, value: v });
    else { rest += v; restN++; }
  }
  if (rest) items.push({ key: '', label: `+${restN} ${t(c.locale, 'life.others')}`, value: rest, muted: true });
  return bars(c, items, 'lf', c.s.lf);
}

const ST_ORDER: Status[] = ['endemica', 'nativa', 'introducida', 'nodata'];
export function status(c: Ctx): string {
  if (isFungi(c)) return naFungi(c.locale);
  const items = ST_ORDER.map((k) => ({ key: k, label: t(c.locale, `st.${k}`), value: c.agg.byStatus[k], muted: k === 'nodata' }));
  return bars(c, items, 'st', c.s.st);
}

// ---- Years: one column per decade -------------------------------------------
export function years(c: Ctx): string {
  if (isFungi(c) || !c.f.year) return naFungi(c.locale);
  const n = fmt(c.locale);
  const max = Math.max(1, ...c.agg.byDecade);
  const lo = c.s.y0 ?? -Infinity, hi = c.s.y1 ?? Infinity;
  const ranged = c.s.y0 != null || c.s.y1 != null;
  const cols = c.agg.byDecade
    .map((v, i) => {
      const d0 = DECADE0 + i * 10;
      const inRange = ranged && d0 + 9 >= lo && d0 <= hi;
      const tick = d0 % 50 === 0 ? `<span class="tk">${d0}</span>` : '';
      return `<button type="button" class="col${inRange ? ' on' : ''}" data-decade="${d0}" aria-pressed="${inRange}"
        aria-label="${d0}s: ${n(v)}" title="${d0}–${d0 + 9}: ${n(v)}"><i style="transform:scaleY(${(v / max).toFixed(4)})"></i>${tick}</button>`;
    })
    .join('');
  return `<div class="cols" role="group" aria-label="${t(c.locale, 'year.title')}">${cols}</div>
    <p class="note yr-foot">${n(c.agg.noYear)} ${t(c.locale, 'year.unknown')}</p>`;
}

export const DECADE_RANGE = { first: DECADE0, last: DECADE0 + (DECADES - 1) * 10 };

// ---- Map colouring ------------------------------------------------------------
export interface MapPaint {
  /** Department -> quantile class 0..6, or -1 for no data. */
  cls: Record<string, number>;
  values: Record<string, number>;
  /** Upper bounds of the 7 classes, for the legend. */
  breaks: number[];
}

/** Records per department come from the mart (sampling effort, not filterable). */
export function paintMap(c: Ctx, records: Record<string, number>): MapPaint {
  const values: Record<string, number> = {};
  c.f.depts.forEach((d, i) => {
    const sp = c.agg.byDept[i];
    const rec = records[d] ?? 0;
    values[d] = c.s.m === 'records' ? rec : c.s.m === 'coverage' ? (rec ? +((sp / rec) * 1000).toFixed(1) : 0) : sp;
  });
  const max = Math.max(0, ...Object.values(values));
  // Square-root classes: a few departments hold most of the records, and a
  // linear scale would paint 20 of the 25 in the same colour.
  const breaks = Array.from({ length: 7 }, (_, i) => Math.round(max * ((i + 1) / 7) ** 2 * 10) / 10);
  const cls: Record<string, number> = {};
  for (const [d, v] of Object.entries(values)) cls[d] = v <= 0 ? -1 : breaks.findIndex((b) => v <= b);
  return { cls, values, breaks };
}

export function legend(c: Ctx, p: MapPaint, active: number | null): string {
  const n = fmt(c.locale);
  let prev = 0;
  return p.breaks
    .map((b, i) => {
      const lab = `${n(Math.round(prev))}–${n(Math.round(b))}`;
      prev = b;
      return `<button type="button" class="lg q${i}${active === i ? ' on' : ''}" data-band="${i}" aria-pressed="${active === i}" title="${lab}"><i></i><span>${i === 0 || i === 6 ? n(Math.round(i === 0 ? 0 : b)) : ''}</span></button>`;
    })
    .join('') + `<span class="lg-none"><i></i>${t(c.locale, 'map.noData')}</span>`;
}
