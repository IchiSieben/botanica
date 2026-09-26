/**
 * One species row (list) or card (grid) of the species page. Shared by the build
 * (SpeciesBrowser.astro renders the first screen into the HTML, v3.2 B1) and the
 * client's virtual list, so both paint the same markup.
 */
import { t, fmt, type Locale } from './i18n';

export interface RowData {
  i: number; name: string; family: string | null; records: number; year: number | null;
  selected: boolean; posinset: number; setsize: number;
}

export const ROW_H = 44;
export const CARD_H = 120;
/** Rows the build paints: a 560 px list (ROW_H 44) shows 13, plus the client's overscan. */
export const FIRST_SCREEN = 26;

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);

export function speciesRowHtml(locale: Locale, d: RowData, grid: boolean): string {
  const n = fmt(locale);
  const fam = d.family ?? '—';
  const attrs = `role="option" tabindex="-1" id="sp-opt-${d.i}" data-i="${d.i}" aria-selected="${d.selected}" aria-posinset="${d.posinset}" aria-setsize="${d.setsize}"`;
  if (grid) {
    return `<button type="button" class="sp-card" ${attrs}>
          <span class="sci">${esc(d.name)}</span><span class="sp-fam">${esc(fam)}</span>
          <span class="sp-meta mono">${d.records ? n(d.records) + ' ' + t(locale, 'species.grid.records') : t(locale, 'species.grid.records')} · ${d.year ? d.year : t(locale, 'species.grid.noYear')}</span></button>`;
  }
  return `<button type="button" class="sp-row" ${attrs}>
        <span class="sci">${esc(d.name)}</span><span class="sp-fam">${esc(fam)}</span><span class="sp-occ mono">${d.records ? n(d.records) : '·'}</span></button>`;
}
