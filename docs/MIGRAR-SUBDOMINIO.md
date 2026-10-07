# Migrar Botánica a botanica.ichisieben.dev

> Escrito el 2026-10-07 desde la sesión del Landing (decisión del dueño: un subdominio por producto,
> ver `Portfolio/Landing/MIGRACION-SUBDOMINIOS.md`). **No se migró desde allí**: lo ejecuta esta sesión.
> Hecho (cifras medidas sobre `Landing/public/botanica/` = build v3.1.0 hoy en producción).

## Lo que hay que cambiar en este repo

| Qué | Dónde | Hoy | Para el subdominio |
|---|---|---|---|
| `base` de Astro | `web/astro.config.mjs:39` | `'/botanica/'` | `'/'` |
| `site` | `web/astro.config.mjs:37` | `https://ichisieben.dev` | `https://botanica.ichisieben.dev` |
| Rutas absolutas en el HTML | todo `dist/*.html` | 116 `href/src="/botanica/…"` | salen de `base`; verificar 0 restos con grep |
| Rutas en JS bundleado | `dist/_astro/*` | 4 chunks con `/botanica/` | ídem; el grep del HTML **no** las ve (lección de NOTES 2026-09-05) |
| `fetch` de datos | `web/src/lib/data-url.ts:11,20` | `${BASE_URL}data/…` → `/botanica/data/…` | se arregla solo con `base: '/'`; verificar en navegador, no leyendo |
| canonical / `og:url` | `<head>` de cada página | `https://ichisieben.dev/botanica/` | `https://botanica.ichisieben.dev/` |
| hreflang | `<head>` | `en`, `es` (`/botanica/es/`), `x-default` | `/` y `/es/` del subdominio |
| CSP | — | depende del `.htaccess` del Landing | `.htaccess` propio en el docroot. **Google Fonts ya no hace falta**: el build v3 sirve las fuentes desde el mismo origen (0 referencias a googleapis/gstatic) |
| build-id | `<head>` | no hay | `<meta name="build-id" content="<sha corto>">` para el smoke |

## Pasos (patrón de metal / radar)

1. Build con los cambios de arriba → `grep -r "/botanica/" web/dist` = 0.
2. Subdominio por API: `hosting_domains_create-website-subdomain` (`domain=ichisieben.dev`,
   `subdomain=botanica`, `directory=botanica-app`). Subida archivo por archivo (TUS) **solo** dentro
   de `botanica-app/`. Nunca un comprimido con deploy-static (sobrescribe el Landing).
3. Smoke en el subdominio: 200, 0 errores de consola, 0 respuestas ≥ 400 (mapa, filogenia, especies,
   `/es/`, cambio de reino). El certificado de un subdominio nuevo puede tardar unos minutos.
4. En el Landing (su sesión): `demoUrl` → subdominio en `src/content/projects/{en,es}/botanica.md`
   (la ES apunta a `/es/`), 301 `^/botanica(/.*)?$` → `https://botanica.ichisieben.dev$1` en
   `public/.htaccess`, y retirar `public/botanica/` + sus rutas de `tools/smoke.mts`.
