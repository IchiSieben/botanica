# ADR 0002 — Modelo analítico, librería de árbol y hosting

- Fecha: 2026-06-21
- Estado: aceptado (cierra las tres decisiones abiertas en ADR 0001)

## 1. Modelo analítico = esquema estrella

Las métricas se modelan como **estrella** en DuckDB:

- **Dimensiones:** `dim_taxon` (especie aceptada + `order_apg` + lifeform/climate +
  flags native/introduced/endemic), `dim_geo` (departamentos del Perú + área
  WGSRPD L3), `dim_time` (año), `dim_clade` (clado coloreado = orden APG).
- **Hechos (dos granos):** `fact_occurrence` (registro GBIF: taxon × depto ×
  elevación × año × basisOfRecord), `fact_distribution` (WCVP: taxon × área L3
  con native/introduced/endemic/extinct).
- **Marts** pre-agregados, uno por dashboard (`mart_*`). **El sitio lee de los
  marts**, nunca de los hechos crudos.

Por qué: separa el grano de registro (esfuerzo, GBIF) del grano de distribución
(presencia, WCVP) — exactamente el principio 3 (esfuerzo ≠ riqueza) y 4
(granularidades distintas) hechos esquema.

## 2. Librería de árbol (F2) = D3 custom de `web/prototypes/mapa-filogenetico.html`

Se evoluciona el prototipo D3 v7 existente. **No** se agrega phylotree.js ni
Phylocanvas.gl por ahora. Phylocanvas.gl (WebGL) se reserva para cuando el
proyecto sea global/multi-país y el árbol llegue a decenas de miles de hojas.
Para F2 (géneros del Perú) el D3 custom alcanza y da control total del estilo
(brushing clado↔mapa estilo Microreact).

## 3. Hosting = estático en Hostinger

Astro se compila **100% estático** (`output: 'static'`, SSG); se sube `dist/`
por FTP/Git. **No** Vercel ni Cloudflare. Las APIs en vivo de F3/F5
(POWO, Pl@ntNet) se consumen vía un **proxy PHP** en Hostinger que esconde la
API key y resuelve CORS. Implicancia para el front: ninguna feature puede
depender de SSR/edge functions; todo dato pre-agregado vive en `/exports` y las
llamadas en vivo pasan por el proxy PHP (a definir en F3).

## Consecuencias

- El ETL ya produce el esquema estrella + marts; validado en modo muestra
  (`atlas data --sample`): `fact_occurrence`=274, `dim_clade`=73 órdenes, marts
  de WCVP vacíos-pero-con-schema hasta correr `--full`.
- El front (F1+) se diseña SSG puro; el proxy PHP es la única pieza dinámica.
