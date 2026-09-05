# ADR 0001 — Tooling del pipeline y acceso a fuentes

- Fecha: 2026-06-21
- Estado: aceptado (F0)

## Contexto

Arranque del Atlas Botánico del Perú en una máquina Windows con Python 3.12 y
Node 22, sin `uv`, `poetry`, `make` ni `duckdb` CLI. El spec pide
reproducibilidad total (`make data` de punta a punta, descargas selladas por
DOI/fecha) y arrancar por F0 → F0.5 antes de cualquier dashboard.

## Decisiones

1. **Entorno: `uv`.** Instalado vía `pip install uv`. Maneja venv + deps desde
   `pyproject.toml` (lockfile reproducible). Más rápido y determinista que
   venv+pip; el spec lo lista como opción preferida.

2. **Task runner: CLI Python (`etl/cli.py`, expuesto como `atlas`) en vez de
   `make`.** `make` no existe en Windows y agregaría una dependencia de sistema.
   Un CLI Python es multiplataforma y mantiene la semántica `make data`
   (`uv run atlas data`). Cada paso es idempotente e invocable por separado.

3. **GBIF vía cuenta propia.** `occurrences.download()` requiere credenciales;
   se leen de `.env` (`GBIF_USER/GBIF_PWD/GBIF_EMAIL`) y la descarga queda
   sellada por **download key + DOI** en `data/raw/manifest.json` (reproducible).
   Para validación rápida sin GBs existe `occurrences.search()` (muestra, no
   reproducible, marcada como tal).

4. **Sample-first.** `atlas data` corre en modo muestra (Tree of Life Newick +
   muestra GBIF) para validar el pipeline sin descargas pesadas. `--full`
   dispara WCVP completo + GBIF download/DOI. Pasos chicos y verificables.

## Consecuencias

- El pipeline corre de punta a punta hoy (validado en modo muestra) aunque WCVP
  todavía no esté descargado: cada paso saltea con log si falta su insumo.
- Falta para conteos base reales de Perú (F0.5 completo): correr `atlas data
  --full` con credenciales GBIF y completar la tabla estática **APG IV**
  (familia→orden) en `data/raw/apg_iv.csv`.

## Decisiones grandes aún abiertas (preguntar antes de implementar)

- **Modelo de datos analítico** definitivo (hechos/dimensiones) — borrador en
  `match_names.py`/`aggregate.py`, a consolidar en F0.5.
- **Librería del árbol filogenético** (phylotree.js vs Phylocanvas.gl) — F2.
- **Hosting** del sitio Astro — F1+.
