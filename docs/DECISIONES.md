# Decisiones tomadas sin el propietario

Una línea por decisión: fecha · tarea · qué se eligió · por qué · qué se descartó · cómo revertirlo.

## v3.2 (2026-09-26, sesión desatendida)

- **2026-09-26 · B1 · Filas de especies en el HTML.** Las primeras 26 filas (Plantas, por nombre) se renderizan en el build. Por qué: la primera fila esperaba 1,6 MB de JSON. Descartado: Web Worker para parsear (no quita la descarga del camino). Revertir: quitar `set:html={firstRows}` en `SpeciesBrowser.astro`.
- **2026-09-26 · B1 · JSON con hash + `/botanica/.htaccess` (solo cabeceras).** `data/<nombre>.<hash>.json` con `Cache-Control: immutable`. Por qué: el CDN servía los JSON como `DYNAMIC` desde el origen en cada visita. Riesgo: no hay evidencia de que hCDN cachee `.json` aunque lleve la cabecera; se verifica en vivo tras el espejo. Revertir: borrar `web/public/.htaccess` y la integración `hashedData` de `astro.config.mjs` (`dataUrl()` vuelve al nombre plano si el hash no existe).
- **2026-09-26 · B1 · Desafío del CDN ("Checking your browser").** No se toca: es un ajuste de hPanel. Desde una IP externa el JSON llega sin desafío; desde esta máquina, todo documento nuevo lo recibe (~4 s). Queda en HANDOFF, "Open questions".
- **2026-09-26 · Cierre · Push del Landing.** La regla global nueva ("MODO AUTÓNOMO", punto 5) pide OK explícito para push a `main` de repos con auto-deploy. El Landing se autodespliega: el espejo queda PREPARADO en un worktree/commit local y el comando de push anotado aquí, salvo que la instrucción de la sesión cuente como ese OK (ver el cierre).
