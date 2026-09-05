# Atlas Botánico del Perú

Plataforma web de **biodiversidad vegetal centrada en el Perú**: dashboards de
infografías + un mapa filogenético interactivo, sobre una **capa analítica**
(índices de diversidad, completitud de muestreo, comparativo Perú vs. mundo).

**Estático-first:** un ETL reproducible baja todo una sola vez → DuckDB →
pre-agrega → exporta JSON/Parquet. El sitio (Astro) lee solo de esos exports.
Las APIs en vivo (POWO, Pl@ntNet) se usan únicamente para detalle por especie
e identificación por foto.

## Fuentes y licencia

| Fuente | Nivel | Uso | Licencia |
|---|---|---|---|
| WCVP (World Checklist of Vascular Plants) | especie | backbone taxonómico + distribución | CC BY 4.0 |
| IPNI | nombre | año de descripción (curva temporal) | CC BY 4.0 |
| GBIF (occurrences, country=PE) | registro | mapas, esfuerzo, gradientes | ver dataset |
| Kew Tree of Life / PAFTOL | género | filogenia (Newick) | CC BY 4.0 |
| POWO / Pl@ntNet | — | ficha en vivo / ID por foto | API |

Atribución **CC BY** visible en la UI y aquí (principio no negociable).

## Principios (no negociables)

1. **Estático-first.** El sitio nunca consulta fuentes masivas en vivo.
2. **Resolver sinonimia antes de contar.** Todo conteo sobre `taxon_status='Accepted'`.
3. **Esfuerzo de muestreo ≠ riqueza.** Registros y especies se reportan por separado; Chao1 antes de afirmar riqueza.
4. **Granularidades distintas.** WCVP = país botánico (WGSRPD L3, Perú=`PER`); subnacional solo desde puntos GBIF; filogenia a nivel género.
5. **Atribución CC BY** visible.

## Quickstart

```bash
# 1. Entorno reproducible (uv)
python -m uv sync

# 2. Credenciales (GBIF para la descarga reproducible por DOI)
cp .env.example .env   # completar GBIF_USER / GBIF_PWD / GBIF_EMAIL

# 3a. Validación rápida con muestras (sin GBs en disco)
uv run atlas data            # download(muestra) -> ... -> export -> profile

# 3b. Pipeline completo reproducible
uv run atlas data --full     # WCVP completo + GBIF download (DOI)
```

Pasos individuales: `uv run atlas <download|load|clean|match|aggregate|analyze|export|profile>`.
El CLI `atlas` reemplaza a `make` (multiplataforma). Ver `etl/cli.py`.

## Arquitectura

```
[WCVP][IPNI][GBIF][Tree of Life]
   │  ETL Python (download → load → clean → match a nombres aceptados)
   ▼
[DuckDB] ──agregados + análisis──► [JSON/Parquet + stats] ──► [Astro + ECharts/D3]
   │
   └──(en vivo)──► [POWO][Pl@ntNet] ──► ficha / ID por foto
```

## Estructura

```
/etl        download · load_duckdb · clean · match_names · aggregate · analyze · export · profile · cli
/data       atlas.duckdb (gitignored) + /exports (JSON versionados, Parquet gitignored) + /raw (gitignored)
/web        Astro (F1+) · /prototypes (filodendro.html, mapa-filogenetico.html)
/docs       data_dictionary.md · perfilamiento.md · /adr · /licencias
/notebooks  perfilamiento + EDA estadístico
```

## Estado

- **F0 — Tubería:** esqueleto ETL + CLI + entorno uv. ✅ corre de punta a punta (modo muestra).
- **F0.5 — Perfilamiento:** `atlas profile` genera `docs/data_dictionary.md` y `docs/perfilamiento.md`. ⏳ requiere descarga `--full` para conteos base completos.
- **F1+ — Dashboards / mapa filogenético / ficha / comparativo / ID por foto:** pendientes.

Ver `docs/adr/` para decisiones de arquitectura.
