# Perfilamiento — conteos base y cruces viables (auto-generado)

> Generado: 2026-09-05T22:25:28+00:00


## Conteos base de Peru

> Titular = **especies (rango Species)**. Los infraespecificos (subespecie/variedad/forma) y los rangos superiores (genero/familia) se cuentan aparte para no inflar el conteo.

- **Especies (rango Species): 21585** · + **1896** taxones infraespecificos
- Nativas: **21062** · Introducidas: **523** (separadas; el titular de flora nativa son las nativas)
- Endemicas (especies nativas con unico area = `PER`): **7541** (34.9% de las especies)
- Familias: **257** · Generos: **2641** (a nivel especie)
- Cobertura de `lifeform_description` (especies): **72.6%**

## Reino Fungi (hongos) — conteos base de Peru

> Caveat fuerte: la micobiota peruana esta MUCHISIMO menos inventariada que la flora. Backbone = Index Fungorum (via GBIF Backbone); la presencia en Peru es EVIDENCIA de ocurrencias GBIF (no hay checklist de distribucion curado como WCVP). Sinonimia resuelta a `speciesKey` aceptado antes de contar.

- **Especies aceptadas (rango Species): 1802**
- Familias: **265** · Generos: **712**
- Registros GBIF (reino Fungi): **13954** · asignados a departamento: **13780** (98.8%)
- Origen (nativa/introducida/endemica) y modo nutricional: **sin dato** (no hay backbone curado; futuro: FungalTraits).
- Comparacion honesta: ~21,585 especies de plantas vs este puñado de hongos = micobiota fuertemente subinventariada, no menor diversidad real.

## Muestra global de referencia

- Nombres aceptados WCVP, **todos los rangos** (global): **434691**
- De esos, **especies (rango Species)**: **365813** (la diferencia son infraespecificos y rangos superiores).

## Mapeo familia -> orden (APG IV, derivado de datos)

- Tabla `family_order_apg`: **1044** familias mapeadas (global).
- Cobertura sobre familias en scope (WCVP-Peru, rango especie): **100.0%** (257/257).
- Familias sin orden se listan en el log de `atlas build_apg`.

## Cruces viables y cobertura

| cruce | llave | estado |
|---|---|---|
| WCVP ⨝ GBIF | nombre aceptado / acceptedTaxonKey | datos presentes |
| WCVP ⨝ Tree of Life | genero | pendiente (cargar Newick) |
| WCVP/IPNI published | año de publicacion | pendiente (IPNI on-demand) |

> Caveats: sesgo de muestreo GBIF; WCVP a nivel pais-botanico; filogenia a nivel genero; sinonimia resuelta antes de contar; cobertura incompleta de lifeform/climate.
