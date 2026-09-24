/**
 * Helper de CLIENTE para los graficos ECharts (islas hidratadas).
 *
 * IMPORTS MODULARES (echarts/core + solo lo usado) para que el bundle pese
 * ~150 KB en vez de ~1 MB. Si sumas un tipo de chart nuevo, registralo aca.
 */
import * as echarts from 'echarts/core';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption, ECharts } from 'echarts/core';

// v2: only the taxonomy tree still uses ECharts (the explorer draws its views
// as SVG/HTML). Register nothing it doesn't need: VisualMap, Legend, Grid,
// Title and Graphic were ~60 % of this chunk.
echarts.use([TooltipComponent, CanvasRenderer]);

export const T = {
  ink: '#0c1512',
  ink2: '#13201b',
  line: '#33473e',
  txt: '#cdd9d2',
  dim: '#7f968b',
  gold: '#e3b23c',
  font: '"IBM Plex Mono", ui-monospace, monospace',
  display: '"Fraunces", Georgia, serif',
};

/** Lee datos inlineados en el HTML por el build (sin fetch en runtime). */
export function readJSON<T>(id: string): T {
  const el = document.getElementById(id);
  if (!el?.textContent) throw new Error(`datos no encontrados: #${id}`);
  return JSON.parse(el.textContent) as T;
}

/** Tooltip con el look del prototipo (borde dorado a la izquierda). */
export const tooltipStyle = {
  backgroundColor: 'rgba(11,18,15,.96)',
  borderColor: T.line,
  borderWidth: 1,
  padding: [8, 11] as [number, number],
  textStyle: { color: T.txt, fontFamily: T.font, fontSize: 12 },
  extraCssText: 'border-left:3px solid #e3b23c;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.45);',
};

/** Crea el chart, aplica opción y engancha resize. Devuelve la instancia. */
export function makeChart(elId: string, option: EChartsCoreOption): ECharts | null {
  const el = document.getElementById(elId);
  if (!el) return null;
  const chart = echarts.init(el, null, { renderer: 'canvas' });
  chart.setOption({ textStyle: { fontFamily: T.font, color: T.txt }, ...option });
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(el);
  window.addEventListener('resize', () => chart.resize());
  return chart;
}

/** Registra un GeoJSON estático como mapa nombrado (para la coropleta).
 *  Es un asset de render servido por el propio sitio, no una API en vivo. */
export async function registerGeoMap(name: string, url: string): Promise<void> {
  const geo = await fetch(url).then((r) => r.json());
  echarts.registerMap(name, geo);
}

export { echarts };
