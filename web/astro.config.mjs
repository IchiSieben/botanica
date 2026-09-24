// @ts-check
import { defineConfig } from 'astro/config';

// Estatico-first (principio 1 del Atlas): SSG puro, sin SSR ni servicios en vivo.
// El sitio se hidrata solo donde hay graficos (islas con ECharts/D3).
export default defineConfig({
  output: 'static',
  // Dominio del hub (ichisieben.dev). Unico sitio que hay que tocar si cambia:
  // canonical, hreflang y URLs absolutas salen de aqui.
  site: 'https://ichisieben.dev',
  // Se publica como subcarpeta del hub, no en la raiz de un dominio propio.
  base: '/botanica/',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  server: { port: 4321 },
});
