// @ts-check
import { defineConfig } from 'astro/config';

// Estatico-first (principio 1 del Atlas): SSG puro, sin SSR ni servicios en vivo.
// El sitio se hidrata solo donde hay graficos (islas con ECharts/D3).
export default defineConfig({
  output: 'static',
  // El dominio real todavia no esta decidido (brief §9.1). Cuando se decida, este es
  // el unico sitio que hay que tocar: sitemap, hreflang y OG absolutos salen de aqui.
  site: 'https://atlas-botanico.example',
  // Se publica como subcarpeta del hub, no en la raiz de un dominio propio.
  base: '/botanica/',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  server: { port: 4321 },
});
