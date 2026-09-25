/**
 * Species drawer renderer: one HTML template for the explorer's #dr-body AND the
 * species page's detail pane, so a markup change (or session B's photo/threat
 * fill-in) has a single place to land.
 *
 * Pure function: takes a plain data shape, returns an HTML string. Every value
 * that can come from user data (a species name, an author string) is escaped.
 * Callers own fetching, caching and the store; this module only renders.
 */
import { t, type Locale } from './i18n';
import { lfLabel } from './views';

export const esc = (s: string): string =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);

export interface DrawerFlags { native: number; introduced: number; endemic: number }

export interface DrawerSpecies {
  name: string;
  kingdom: 'plantae' | 'fungi';
  family: string | null;
  order: string | null;
  flags: number;
  flagBits: DrawerFlags;
  records: number;
  /** Department display name (already resolved) + record count, desc, at most 6. */
  topDepts: [string, number][];
  /** Growth-form group key (matches lf.* i18n keys) or a raw WCVP string with no group. */
  lifeformGroup: string | null;
  lifeformRaw: string | null;
  /** Year described (WCVP first_published, basionym-aware). Plants only. */
  year: number | null;
  /** Plants only: protologue author/IPNI id and the accepted name's IPNI id (for POWO). */
  proto: { authors: string; ipniId: string; acceptedIpniId: string } | null;
  /** Department bitmask (bit i -> map.facetDepts[i]), from facets-*.json. Null while not loaded. */
  deptMask: number | null;
  /** Other species names, same genus + kingdom, excluding this one. */
  sameGenus: string[];
}

export interface DrawerMap {
  paths: { name: string; d: string }[];
  width: number;
  height: number;
  /** Department order the bits of `deptMask` refer to (facets-*.json's `depts`). */
  facetDepts: string[];
}

export interface DrawerYearDist {
  min: number;
  /** Species count per bucket of `step` years, starting at `min`. */
  buckets: number[];
  step: number;
}

export interface DrawerLinks {
  mapHref: string;
  famHref: string | null;
  speciesHref: (name: string) => string;
}

const LEAF =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V11m0 0C12 6 8 3 4 3c0 4 3 8 8 8Zm0 0c0-4 3-7 8-7 0 4-3 7-8 7Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

function protoHtml(locale: Locale, proto: DrawerSpecies['proto']): string {
  if (!proto) return '';
  const { authors, ipniId } = proto;
  return (
    (authors ? ` ${t(locale, 'dr.by')} <span class="dr-auth">${esc(authors)}</span>` : '') +
    (ipniId
      ? ` · <a class="dr-ipni" href="https://www.ipni.org/n/${encodeURIComponent(ipniId)}" rel="noopener" target="_blank">${t(locale, 'dr.protologue')}</a>`
      : '')
  );
}

function miniMap(locale: Locale, map: DrawerMap | null, mask: number | null): string {
  if (!map || !map.paths.length) return '';
  if (mask == null || !map.facetDepts) return `<p class="note dr-map-loading">…</p>`;
  const on = new Set<string>();
  map.facetDepts.forEach((d, i) => { if ((mask >> i) & 1) on.add(d); });
  if (!on.size) return `<p class="note">${t(locale, 'dr.mapNone')}</p>`;
  const paths = map.paths
    .map((p) => `<path d="${esc(p.d)}" class="${on.has(p.name) ? 'on' : ''}"/>`)
    .join('');
  return `
    <svg class="dr-mini-map" viewBox="0 0 ${map.width} ${map.height}" role="img" aria-label="${t(locale, 'dr.mapLabel')}">${paths}</svg>`;
}

function timeline(locale: Locale, years: DrawerYearDist | null, year: number | null): string {
  if (!years || !years.buckets.length) return '';
  const max = Math.max(1, ...years.buckets);
  const n = years.buckets.length;
  const bars = years.buckets.map((c) => `<i style="height:${Math.max(4, Math.round((c / max) * 100))}%"></i>`).join('');
  let marker = '';
  if (year) {
    const i = Math.min(n - 1, Math.max(0, Math.floor((year - years.min) / years.step)));
    const pct = n > 1 ? (i / (n - 1)) * 100 : 50;
    marker = `<b class="dr-yr-mark" style="left:${pct.toFixed(2)}%"></b>`;
  }
  return `
    <div class="dr-timeline" role="img" aria-label="${t(locale, 'dr.timelineLabel')}: ${year ?? '—'}">
      <div class="dr-yr-bars">${bars}</div>${marker}
    </div>`;
}

function sameGenusHtml(locale: Locale, names: string[], href: DrawerLinks['speciesHref']): string {
  if (!names.length) return '';
  return `
    <p class="label">${t(locale, 'dr.sameGenus')}</p>
    <ul class="dr-genus">${names
      .map((nm) => `<li><a href="${esc(href(nm))}" data-sp="${esc(nm)}"><i class="sci">${esc(nm)}</i></a></li>`)
      .join('')}</ul>`;
}

function extLinks(locale: Locale, sp: DrawerSpecies): string {
  const items: string[] = [];
  if (sp.proto?.ipniId) {
    items.push(`<a href="https://www.ipni.org/n/${encodeURIComponent(sp.proto.ipniId)}" rel="noopener" target="_blank">${t(locale, 'dr.linkIpni')}</a>`);
  }
  items.push(
    `<a href="https://www.gbif.org/occurrence/search?country=PE&q=${encodeURIComponent(sp.name)}" rel="noopener" target="_blank">${t(locale, 'dr.linkGbif')}</a>`,
  );
  if (sp.proto?.acceptedIpniId) {
    items.push(
      `<a href="https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:${encodeURIComponent(sp.proto.acceptedIpniId)}" rel="noopener" target="_blank">${t(locale, 'dr.linkPowo')}</a>`,
    );
  }
  if (!items.length) return '';
  return `<p class="dr-links"><span class="label">${t(locale, 'dr.links')}:</span> ${items.join(' · ')}</p>`;
}

export function renderDrawer(
  locale: Locale,
  sp: DrawerSpecies,
  map: DrawerMap | null,
  years: DrawerYearDist | null,
  links: DrawerLinks,
): string {
  const plant = sp.kingdom === 'plantae';
  const genus = sp.name.split(' ')[0];
  const tags = [
    sp.flags & sp.flagBits.endemic ? `<span class="tag endem">${t(locale, 'sp.endemic')}</span>` : '',
    sp.flags & sp.flagBits.native ? `<span class="tag">${t(locale, 'sp.native')}</span>` : '',
    sp.flags & sp.flagBits.introduced ? `<span class="tag intro">${t(locale, 'sp.introduced')}</span>` : '',
  ].join('');
  const max = sp.topDepts[0]?.[1] ?? 1;
  return `
    <div class="dr-head">
      <figure class="dr-photo" data-photo-slot aria-hidden="true">${LEAF}<figcaption class="sr-only">${t(locale, 'dr.photoPlaceholder')}</figcaption></figure>
      <div class="dr-id">
        <h2 id="dr-title" class="sci">${esc(sp.name)}</h2>
        <ol class="dr-crumbs" aria-label="${t(locale, 'dr.taxonomy')}">
          <li>${plant ? 'Plantae' : 'Fungi'}</li><li>${esc(sp.order ?? '—')}</li><li>${esc(sp.family ?? '—')}</li><li class="g">${esc(genus)}</li>
        </ol>
      </div>
    </div>
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    <div class="dr-threat" data-threat-slot aria-hidden="true"></div>
    ${sp.year
      ? `<p class="dr-desc">${t(locale, 'dr.described').replace('{year}', `<b class="mono">${sp.year}</b>`)}<span data-proto>${plant ? protoHtml(locale, sp.proto) : ''}</span></p>`
      : ''}
    <dl class="dr-facts">
      ${sp.lifeformGroup
        ? `<div><dt>${t(locale, 'sp.lifeform')}</dt><dd><span class="dr-lf" title="${esc(`${t(locale, 'lf.rawOne')}: ${sp.lifeformRaw ?? '—'}`)}">${esc(lfLabel(locale, sp.lifeformGroup))}</span>${sp.lifeformRaw ? `<span class="dr-sub">${t(locale, 'dr.wcvp')}: ${esc(sp.lifeformRaw)}</span>` : ''}</dd></div>`
        : ''}
      <div><dt>${t(locale, 'sp.records')}</dt><dd class="mono">${sp.records ? sp.records.toLocaleString('en-US') : t(locale, 'sp.noRecords')}</dd></div>
    </dl>
    ${sp.topDepts.length
      ? `<p class="label">${t(locale, 'sp.topDepts')}</p><ul class="dr-bars">${sp.topDepts
          .map(([name, c]) => `<li><span>${esc(name)}</span><i style="transform:scaleX(${(c / max).toFixed(3)})"></i><b class="mono">${c.toLocaleString('en-US')}</b></li>`)
          .join('')}</ul>`
      : `<p class="note">${t(locale, 'sp.noDepts')}</p>`}
    <p class="label">${t(locale, 'dr.mapLabel')}</p>
    ${miniMap(locale, map, sp.deptMask)}
    ${plant ? timeline(locale, years, sp.year) : ''}
    ${sameGenusHtml(locale, sp.sameGenus, links.speciesHref)}
    ${extLinks(locale, sp)}
    <div class="dr-actions">
      <a class="btn" href="${esc(links.mapHref)}" data-act="show-map">${t(locale, 'sp.showMap')} →</a>
      ${links.famHref ? `<a class="btn" href="${esc(links.famHref)}" data-fam="${esc(sp.family ?? '')}">${t(locale, 'sp.filterFamily')} →</a>` : ''}
    </div>`;
}

/** Buckets `year[]` (0 = no data) into `step`-year bands for the drawer timeline.
 *  Computed once per kingdom facets load, not per drawer open. */
export function yearHistogram(years: (number | null)[] | null | undefined, step = 10): DrawerYearDist | null {
  if (!years) return null;
  let min = Infinity, max = -Infinity;
  for (const y of years) if (y) { if (y < min) min = y; if (y > max) max = y; }
  if (!Number.isFinite(min)) return null;
  min = Math.floor(min / step) * step;
  const n = Math.floor((max - min) / step) + 1;
  const buckets = new Array(n).fill(0);
  for (const y of years) if (y) buckets[Math.floor((y - min) / step)]++;
  return { min, buckets, step };
}
