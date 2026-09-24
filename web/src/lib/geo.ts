/**
 * BUILD TIME: department polygons (geoBoundaries ADM1, `public/data/
 * peru_departamentos.geojson`) projected and simplified to SVG path strings.
 *
 * The map used to be an ECharts `map` series: 171 KB of chart runtime plus a
 * 20 KB GeoJSON fetch before anything could paint, on a canvas no keyboard can
 * reach. As SVG it is part of the HTML, each department is a focusable element,
 * and restyling it on a click is a class change.
 *
 * Projection: equirectangular scaled by cos(central latitude). Peru spans 18°
 * of latitude near the equator, so the distortion is under 2 %, and it keeps
 * the math to one line (no d3-geo in the bundle).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Ring = [number, number][];
interface Feature {
  properties: { NOMBDEP: string };
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
}

export interface DeptPath {
  name: string;
  d: string;
  /** Label anchor: centroid of the largest ring's bounding box. */
  cx: number;
  cy: number;
}

export const MAP_W = 400;
/** Simplification tolerance in viewBox units. 0.6 keeps the coast readable at 360 px. */
const TOLERANCE = 0.6;

function simplify(pts: Ring, tol: number): Ring {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  // GeoJSON rings are closed (first == last): the baseline would have zero
  // length and every distance would be 0. Seed with the farthest point instead.
  let far = 1, farD = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > farD) { farD = d; far = i; }
  }
  keep[far] = 1;
  const stack: [number, number][] = [[0, far], [far, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const dist = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (dist > max) { max = dist; idx = i; }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export function departmentPaths(): { paths: DeptPath[]; width: number; height: number } {
  const url = new URL('../../public/data/peru_departamentos.geojson', import.meta.url);
  const geo = JSON.parse(readFileSync(fileURLToPath(url), 'utf-8')) as { features: Feature[] };

  const polys = (f: Feature): Ring[][] =>
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const f of geo.features) for (const p of polys(f)) for (const [x, y] of p[0]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const scale = MAP_W / ((maxX - minX) * k);
  const height = Math.ceil((maxY - minY) * scale);
  const project = ([x, y]: [number, number]): [number, number] => [(x - minX) * k * scale, (maxY - y) * scale];
  const r1 = (v: number) => Math.round(v * 10) / 10;

  const paths = geo.features.map((f) => {
    let d = '';
    let best = { area: -1, cx: 0, cy: 0 };
    for (const poly of polys(f)) {
      for (const ring of poly) {
        const pts = simplify(ring.map(project), TOLERANCE);
        if (pts.length < 3) continue;
        d += 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z';
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
        if (w * h > best.area) best = { area: w * h, cx: Math.min(...xs) + w / 2, cy: Math.min(...ys) + h / 2 };
      }
    }
    return { name: f.properties.NOMBDEP, d, cx: r1(best.cx), cy: r1(best.cy) };
  });
  paths.sort((a, b) => a.name.localeCompare(b.name));
  return { paths, width: MAP_W, height };
}
