// @ts-check
import { defineConfig } from 'astro/config';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// v3.2 B1: the data files are fetched by content-hashed name (data/<name>.<hash>.json) so they
// can be served `immutable` (public/.htaccess) and a new ETL export is a new URL. The unhashed
// files stay in dist too: a page cached from the previous deploy still finds its data.
const dataDir = fileURLToPath(new URL('./public/data/', import.meta.url));
const dataHashes = Object.fromEntries(readdirSync(dataDir).filter((f) => f.endsWith('.json')).map((f) => [
  f.replace(/\.json$/, ''),
  createHash('sha256').update(readFileSync(join(dataDir, f))).digest('hex').slice(0, 10),
]));

/** @type {import('astro').AstroIntegration} */
const hashedData = {
  name: 'hashed-data',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const out = fileURLToPath(new URL('data/', dir));
      for (const [name, hash] of Object.entries(dataHashes)) copyFileSync(join(out, `${name}.json`), join(out, `${name}.${hash}.json`));
    },
  },
};

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
  integrations: [hashedData],
  // v3.2 B1: nav links prefetch the other page on hover/focus (opt-in per link, data-astro-prefetch).
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: { define: { __DATA_HASHES__: JSON.stringify(dataHashes) } },
});
