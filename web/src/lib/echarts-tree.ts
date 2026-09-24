/**
 * ECharts for the taxonomy tree only: core + TreeChart + Tooltip + canvas.
 * Loaded with a dynamic import when the tree scrolls into view, so it never
 * sits on the page's critical path.
 *
 * Colours come from the page's CSS tokens at init, so the canvas follows the
 * light/dark theme like everything else.
 */
import * as echarts from 'echarts/core';
import { TreeChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([TreeChart, TooltipComponent, CanvasRenderer]);

export function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const rgb = (name: string) => `rgb(${cs.getPropertyValue(name).trim().split(/\s+/).join(',')})`;
  return {
    fg: rgb('--fg'), muted: rgb('--muted'), border: rgb('--border'), surface: rgb('--surface'),
    accent: rgb('--accent'), font: cs.getPropertyValue('--font-mono').trim() || 'monospace',
  };
}

export { echarts };
