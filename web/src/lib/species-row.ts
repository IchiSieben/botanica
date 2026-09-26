/**
 * One species row (list) or card (grid) of the species page. Shared by the build
 * (SpeciesBrowser.astro renders the first screen into the HTML, v3.2 B1) and the
 * client's virtual list, so both paint the same markup.
 *
 * v3.2 B2: the separators are text in the markup ("Aa argyrolepis — Orchidaceae ·
 * Asparagales — 3 records · 1877"), visually replaced by layout, so a screen reader
 * and copy-paste read a sentence instead of "Aa argyrolepisOrchidaceae·".
 */
import { t, fmt, type Locale } from './i18n';

export interface RowData {
  i: number; name: string; family: string | null; order: string | null; records: number; year: number | null;
  /** The order's colour in the tree palette (null: unplaced / no order). */
  color: string | null;
  endemic: boolean;
  /** Departments with the species (facets mask popcount) out of `deptTotal`; null while unknown. */
  depts: number | null; deptTotal: number;
  selected: boolean; posinset: number; setsize: number;
}

export const ROW_H = 56;
export const CARD_H = 124;
/** Rows the build paints: a 560 px list (ROW_H 56) shows 10, plus the client's overscan. */
export const FIRST_SCREEN = 22;

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);
/** A separator the layout replaces (line break, column gap): hidden, still read and copied. */
const SEP = (s: string) => `<span class="sep">${s}</span>`;
/** A separator that stays visible. */
const DOT = '<span class="dot"> · </span>';

export function speciesRowHtml(locale: Locale, d: RowData, grid: boolean): string {
  const n = fmt(locale);
  const attrs = `role="option" tabindex="-1" id="sp-opt-${d.i}" data-i="${d.i}" aria-selected="${d.selected}" aria-posinset="${d.posinset}" aria-setsize="${d.setsize}"${d.color ? ` style="--c:${esc(d.color)}"` : ''}`;
  const recs = `${n(d.records)} ${t(locale, d.records === 1 ? 'species.row.record' : 'species.row.records')}`;
  const yr = d.year ? String(d.year) : t(locale, 'species.grid.noYear');
  const tax = [d.family, d.order].filter(Boolean).map((x) => esc(x!)).join(DOT);
  const endem = d.endemic ? `${SEP(' — ')}<span class="sp-badge">${t(locale, 'sp.endemic')}</span>` : '';
  const sub = `<span class="sp-sub"><span class="sp-tax">${tax || '—'}</span>${endem}</span>`;
  if (grid) {
    const on = d.depts ?? 0;
    const deps = d.depts == null ? '' :
      `${SEP(' — ')}<span class="sp-deps"><span class="sp-deps-bar" aria-hidden="true" style="--p:${(on / Math.max(1, d.deptTotal)).toFixed(3)}"></span><span class="mono" aria-hidden="true">${n(on)}/${n(d.deptTotal)}</span><span class="sr-only">${esc(t(locale, 'species.card.depts').replace('{n}', n(on)).replace('{of}', n(d.deptTotal)))}</span></span>`;
    return `<button type="button" class="sp-card" ${attrs}><span class="sp-mark" aria-hidden="true"></span>`
      + `<i class="sci">${esc(d.name)}</i>${SEP(' — ')}<span class="sp-tax">${tax || '—'}</span>`
      + `<span class="sp-foot">${deps}${endem}</span></button>`;
  }
  return `<button type="button" class="sp-row" ${attrs}><span class="sp-mark" aria-hidden="true"></span>`
    + `<span class="sp-id"><i class="sci">${esc(d.name)}</i>${SEP(' — ')}${sub}</span>`
    + `${SEP(' — ')}<span class="sp-figs mono"><span>${recs}</span>${DOT}<span>${yr}</span></span></button>`;
}
