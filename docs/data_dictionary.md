# Diccionario de datos (auto-generado)

> Generado: 2026-06-22T09:51:30+00:00 · pais L3 = `PER`

> Una fila por columna: tipo, cobertura (% no nulos) y cardinalidad.


## `dim_clade` — 292 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `clade_id` | BIGINT | 100.0 | 292 |
| `clade` | VARCHAR | 100.0 | 292 |
| `color` | VARCHAR | 100.0 | 12 |


## `dim_geo` — 25 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `geo_id` | BIGINT | 100.0 | 25 |
| `department` | VARCHAR | 100.0 | 25 |
| `area_l3` | VARCHAR | 100.0 | 1 |


## `dim_taxon` — 25283 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `taxon_id` | VARCHAR | 100.0 | 25271 |
| `kingdom` | VARCHAR | 100.0 | 2 |
| `taxon_name` | VARCHAR | 100.0 | 25281 |
| `taxon_rank` | VARCHAR | 100.0 | 5 |
| `is_species` | BOOLEAN | 100.0 | 2 |
| `genus` | VARCHAR | 100.0 | 3353 |
| `family` | VARCHAR | 99.9 | 522 |
| `order_apg` | VARCHAR | 99.9 | 174 |
| `lifeform` | VARCHAR | 67.9 | 179 |
| `climate` | VARCHAR | 83.2 | 8 |
| `native` | BOOLEAN | 92.9 | 2 |
| `introduced` | BOOLEAN | 92.9 | 2 |
| `endemic` | BOOLEAN | 92.9 | 2 |


## `dim_time` — 209 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `year` | INTEGER | 100.0 | 209 |


## `fact_distribution` — 1982407 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `taxon_id` | VARCHAR | 100.0 | 434634 |
| `area_l3` | VARCHAR | 100.0 | 368 |
| `introduced` | BOOLEAN | 100.0 | 2 |
| `extinct` | BOOLEAN | 100.0 | 2 |
| `location_doubtful` | BOOLEAN | 100.0 | 2 |


## `fact_occurrence` — 1283833 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `gbif_key` | VARCHAR | 100.0 | 1283833 |
| `kingdom` | VARCHAR | 100.0 | 2 |
| `species` | VARCHAR | 78.3 | 26440 |
| `family` | VARCHAR | 99.1 | 884 |
| `order_apg` | VARCHAR | 99.1 | 284 |
| `department` | VARCHAR | 100.0 | 26 |
| `assign_method` | VARCHAR | 100.0 | 3 |
| `elevation` | DOUBLE | 66.9 | 6434 |
| `year` | INTEGER | 95.1 | 209 |
| `basis_of_record` | VARCHAR | 100.0 | 8 |


## `family_order_apg` — 1044 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `family` | VARCHAR | 100.0 | 1044 |
| `order` | VARCHAR | 100.0 | 292 |


## `gbif_clean` — 1269879 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `gbifID` | VARCHAR | 100.0 | 1269879 |
| `datasetKey` | VARCHAR | 100.0 | 451 |
| `occurrenceID` | VARCHAR | 97.4 | 1237292 |
| `kingdom` | VARCHAR | 100.0 | 1 |
| `phylum` | VARCHAR | 99.2 | 7 |
| `class` | VARCHAR | 99.2 | 31 |
| `order` | VARCHAR | 99.2 | 156 |
| `family` | VARCHAR | 99.2 | 543 |
| `genus` | VARCHAR | 96.3 | 3998 |
| `species` | VARCHAR | 78.5 | 24638 |
| `infraspecificEpithet` | VARCHAR | 9.6 | 1573 |
| `taxonRank` | VARCHAR | 100.0 | 11 |
| `scientificName` | VARCHAR | 100.0 | 36002 |
| `verbatimScientificName` | VARCHAR | 98.6 | 63579 |
| `verbatimScientificNameAuthorship` | VARCHAR | 55.7 | 13278 |
| `countryCode` | VARCHAR | 100.0 | 1 |
| `locality` | VARCHAR | 90.4 | 111853 |
| `stateProvince` | VARCHAR | 86.7 | 902 |
| `occurrenceStatus` | VARCHAR | 100.0 | 2 |
| `individualCount` | VARCHAR | 72.6 | 114 |
| `publishingOrgKey` | VARCHAR | 100.0 | 232 |
| `decimalLatitude` | VARCHAR | 100.0 | 88162 |
| `decimalLongitude` | VARCHAR | 100.0 | 88131 |
| `coordinateUncertaintyInMeters` | VARCHAR | 27.0 | 3667 |
| `coordinatePrecision` | VARCHAR | 0.1 | 14 |
| `elevation` | VARCHAR | 67.4 | 6418 |
| `elevationAccuracy` | VARCHAR | 22.5 | 682 |
| `depth` | VARCHAR | 0.0 | 34 |
| `depthAccuracy` | VARCHAR | 0.0 | 6 |
| `eventDate` | VARCHAR | 95.2 | 91125 |
| `day` | VARCHAR | 92.0 | 31 |
| `month` | VARCHAR | 93.6 | 12 |
| `year` | VARCHAR | 95.2 | 208 |
| `taxonKey` | VARCHAR | 100.0 | 36003 |
| `speciesKey` | VARCHAR | 78.5 | 24785 |
| `basisOfRecord` | VARCHAR | 100.0 | 8 |
| `institutionCode` | VARCHAR | 98.0 | 952 |
| `collectionCode` | VARCHAR | 95.9 | 326 |
| `catalogNumber` | VARCHAR | 97.8 | 1233366 |
| `recordNumber` | VARCHAR | 61.7 | 96536 |
| `identifiedBy` | VARCHAR | 64.0 | 17463 |
| `dateIdentified` | VARCHAR | 37.7 | 67014 |
| `license` | VARCHAR | 100.0 | 3 |
| `rightsHolder` | VARCHAR | 61.1 | 4775 |
| `recordedBy` | VARCHAR | 68.7 | 28723 |
| `typeStatus` | VARCHAR | 0.7 | 20 |
| `establishmentMeans` | VARCHAR | 0.8 | 3 |
| `lastInterpreted` | VARCHAR | 100.0 | 533265 |
| `mediaType` | VARCHAR | 27.7 | 38 |
| `issue` | VARCHAR | 99.3 | 907 |
| `lat` | DOUBLE | 100.0 | 88162 |
| `lon` | DOUBLE | 100.0 | 88131 |


## `gbif_fungi_clean` — 13954 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `gbifID` | VARCHAR | 100.0 | 13954 |
| `datasetKey` | VARCHAR | 100.0 | 109 |
| `occurrenceID` | VARCHAR | 96.2 | 13429 |
| `kingdom` | VARCHAR | 100.0 | 1 |
| `phylum` | VARCHAR | 94.8 | 8 |
| `class` | VARCHAR | 93.4 | 41 |
| `order` | VARCHAR | 92.4 | 136 |
| `family` | VARCHAR | 90.0 | 341 |
| `genus` | VARCHAR | 86.8 | 884 |
| `species` | VARCHAR | 61.7 | 1802 |
| `infraspecificEpithet` | VARCHAR | 0.4 | 24 |
| `taxonRank` | VARCHAR | 100.0 | 11 |
| `scientificName` | VARCHAR | 100.0 | 2763 |
| `verbatimScientificName` | VARCHAR | 99.7 | 3348 |
| `verbatimScientificNameAuthorship` | VARCHAR | 36.4 | 1048 |
| `countryCode` | VARCHAR | 100.0 | 1 |
| `locality` | VARCHAR | 81.8 | 2456 |
| `stateProvince` | VARCHAR | 50.6 | 82 |
| `occurrenceStatus` | VARCHAR | 100.0 | 1 |
| `individualCount` | VARCHAR | 3.4 | 5 |
| `publishingOrgKey` | VARCHAR | 100.0 | 81 |
| `decimalLatitude` | VARCHAR | 100.0 | 2464 |
| `decimalLongitude` | VARCHAR | 100.0 | 2491 |
| `coordinateUncertaintyInMeters` | VARCHAR | 28.9 | 561 |
| `coordinatePrecision` | VARCHAR | 0.1 | 5 |
| `elevation` | VARCHAR | 20.8 | 285 |
| `elevationAccuracy` | VARCHAR | 10.5 | 44 |
| `depth` | VARCHAR | 1.5 | 14 |
| `depthAccuracy` | VARCHAR | 1.5 | 1 |
| `eventDate` | VARCHAR | 93.3 | 2409 |
| `day` | VARCHAR | 88.9 | 31 |
| `month` | VARCHAR | 91.7 | 12 |
| `year` | VARCHAR | 93.3 | 121 |
| `taxonKey` | VARCHAR | 100.0 | 2763 |
| `speciesKey` | VARCHAR | 61.7 | 1802 |
| `basisOfRecord` | VARCHAR | 100.0 | 7 |
| `institutionCode` | VARCHAR | 69.5 | 86 |
| `collectionCode` | VARCHAR | 57.4 | 67 |
| `catalogNumber` | VARCHAR | 90.4 | 12570 |
| `recordNumber` | VARCHAR | 45.9 | 4796 |
| `identifiedBy` | VARCHAR | 30.7 | 754 |
| `dateIdentified` | VARCHAR | 18.9 | 1325 |
| `license` | VARCHAR | 100.0 | 3 |
| `rightsHolder` | VARCHAR | 39.7 | 435 |
| `recordedBy` | VARCHAR | 72.9 | 1185 |
| `typeStatus` | VARCHAR | 2.3 | 11 |
| `establishmentMeans` | VARCHAR | 0.0 | 0 |
| `lastInterpreted` | VARCHAR | 100.0 | 13543 |
| `mediaType` | VARCHAR | 25.5 | 1 |
| `issue` | VARCHAR | 100.0 | 228 |
| `lat` | DOUBLE | 100.0 | 2464 |
| `lon` | DOUBLE | 100.0 | 2491 |


## `gbif_occ_norm` — 1283833 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `gbif_key` | VARCHAR | 100.0 | 1283833 |
| `kingdom` | VARCHAR | 100.0 | 2 |
| `species` | VARCHAR | 78.3 | 26440 |
| `family` | VARCHAR | 99.1 | 884 |
| `order` | VARCHAR | 99.1 | 292 |
| `lon` | DOUBLE | 100.0 | 89857 |
| `lat` | DOUBLE | 100.0 | 89869 |
| `elevation` | DOUBLE | 66.9 | 6434 |
| `year` | INTEGER | 95.1 | 209 |
| `basis_of_record` | VARCHAR | 100.0 | 8 |


## `mart_clade_by_department` — 2730 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `kingdom` | VARCHAR | 100.0 | 2 |
| `clade` | VARCHAR | 100.0 | 284 |
| `color` | VARCHAR | 100.0 | 12 |
| `department` | VARCHAR | 100.0 | 26 |
| `records` | BIGINT | 100.0 | 598 |
| `species` | BIGINT | 100.0 | 269 |


## `mart_described_per_year` — 0 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `kingdom` | VARCHAR | 0.0 | 0 |
| `year` | INTEGER | 0.0 | 0 |
| `species` | BIGINT | 0.0 | 0 |


## `mart_family_composition` — 522 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `kingdom` | VARCHAR | 100.0 | 2 |
| `family` | VARCHAR | 100.0 | 522 |
| `order_apg` | VARCHAR | 99.6 | 174 |
| `species` | BIGINT | 100.0 | 116 |
| `genera` | BIGINT | 100.0 | 43 |


## `mart_kpis` — 2 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `kingdom` | VARCHAR | 100.0 | 2 |
| `species` | BIGINT | 100.0 | 2 |
| `native` | BIGINT | 100.0 | 2 |
| `introduced` | BIGINT | 100.0 | 2 |
| `endemic` | BIGINT | 100.0 | 2 |
| `endemic_rate` | DOUBLE | 100.0 | 2 |
| `families` | BIGINT | 100.0 | 2 |
| `genera` | BIGINT | 100.0 | 2 |
| `occurrences` | BIGINT | 100.0 | 2 |
| `occurrences_raw` | BIGINT | 100.0 | 2 |
| `assigned` | BIGINT | 100.0 | 2 |
| `unassigned` | BIGINT | 100.0 | 2 |
| `assigned_pct` | DOUBLE | 100.0 | 2 |
| `unassigned_pct` | DOUBLE | 100.0 | 2 |


## `mart_lifeform_spectrum` — 181 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `kingdom` | VARCHAR | 100.0 | 2 |
| `lifeform` | VARCHAR | 100.0 | 180 |
| `species` | BIGINT | 100.0 | 62 |


## `mart_richness_by_department` — 51 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `kingdom` | VARCHAR | 100.0 | 2 |
| `department` | VARCHAR | 100.0 | 26 |
| `records` | BIGINT | 100.0 | 51 |
| `species` | BIGINT | 100.0 | 49 |


## `mart_status` — 4 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `kingdom` | VARCHAR | 100.0 | 2 |
| `status` | VARCHAR | 100.0 | 4 |
| `species` | BIGINT | 100.0 | 4 |


## `peru_fungi` — 1802 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `taxon_id` | VARCHAR | 100.0 | 1802 |
| `kingdom` | VARCHAR | 100.0 | 1 |
| `taxon_name` | VARCHAR | 100.0 | 1800 |
| `taxon_rank` | VARCHAR | 100.0 | 1 |
| `is_species` | BOOLEAN | 100.0 | 1 |
| `genus` | VARCHAR | 100.0 | 712 |
| `family` | VARCHAR | 98.6 | 265 |
| `n_records` | BIGINT | 100.0 | 59 |
| `lifeform_description` | VARCHAR | 0.0 | 0 |
| `climate_description` | VARCHAR | 0.0 | 0 |
| `native` | BOOLEAN | 0.0 | 0 |
| `introduced` | BOOLEAN | 0.0 | 0 |
| `endemic` | BOOLEAN | 0.0 | 0 |


## `peru_species` — 23481 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `plant_name_id` | VARCHAR | 100.0 | 23481 |
| `accepted_plant_name_id` | VARCHAR | 100.0 | 23481 |
| `taxon_status` | VARCHAR | 100.0 | 1 |
| `taxon_rank` | VARCHAR | 100.0 | 5 |
| `family` | VARCHAR | 100.0 | 257 |
| `genus` | VARCHAR | 100.0 | 2641 |
| `species` | VARCHAR | 100.0 | 11047 |
| `taxon_name` | VARCHAR | 100.0 | 23481 |
| `taxon_authors` | VARCHAR | 95.3 | 7021 |
| `lifeform_description` | VARCHAR | 73.1 | 179 |
| `climate_description` | VARCHAR | 89.6 | 8 |
| `is_species` | BOOLEAN | 100.0 | 2 |
| `introduced` | INTEGER | 100.0 | 2 |
| `native` | BOOLEAN | 100.0 | 2 |
| `endemic` | BOOLEAN | 100.0 | 2 |


## `raw_gbif_fungi` — 14788 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `gbifID` | VARCHAR | 100.0 | 14788 |
| `datasetKey` | VARCHAR | 100.0 | 113 |
| `occurrenceID` | VARCHAR | 96.4 | 14263 |
| `kingdom` | VARCHAR | 100.0 | 1 |
| `phylum` | VARCHAR | 95.0 | 8 |
| `class` | VARCHAR | 93.7 | 41 |
| `order` | VARCHAR | 92.7 | 137 |
| `family` | VARCHAR | 90.4 | 343 |
| `genus` | VARCHAR | 87.5 | 905 |
| `species` | VARCHAR | 62.3 | 1886 |
| `infraspecificEpithet` | VARCHAR | 0.4 | 25 |
| `taxonRank` | VARCHAR | 100.0 | 11 |
| `scientificName` | VARCHAR | 100.0 | 2890 |
| `verbatimScientificName` | VARCHAR | 99.7 | 3522 |
| `verbatimScientificNameAuthorship` | VARCHAR | 39.3 | 1127 |
| `countryCode` | VARCHAR | 100.0 | 1 |
| `locality` | VARCHAR | 82.3 | 2672 |
| `stateProvince` | VARCHAR | 52.3 | 97 |
| `occurrenceStatus` | VARCHAR | 100.0 | 1 |
| `individualCount` | VARCHAR | 3.2 | 5 |
| `publishingOrgKey` | VARCHAR | 100.0 | 84 |
| `decimalLatitude` | VARCHAR | 100.0 | 2630 |
| `decimalLongitude` | VARCHAR | 100.0 | 2652 |
| `coordinateUncertaintyInMeters` | VARCHAR | 32.9 | 737 |
| `coordinatePrecision` | VARCHAR | 0.1 | 5 |
| `elevation` | VARCHAR | 22.7 | 326 |
| `elevationAccuracy` | VARCHAR | 10.9 | 53 |
| `depth` | VARCHAR | 1.4 | 14 |
| `depthAccuracy` | VARCHAR | 1.4 | 1 |
| `eventDate` | VARCHAR | 93.5 | 2549 |
| `day` | VARCHAR | 89.1 | 31 |
| `month` | VARCHAR | 91.9 | 12 |
| `year` | VARCHAR | 93.5 | 121 |
| `taxonKey` | VARCHAR | 100.0 | 2890 |
| `speciesKey` | VARCHAR | 62.3 | 1887 |
| `basisOfRecord` | VARCHAR | 100.0 | 7 |
| `institutionCode` | VARCHAR | 71.2 | 89 |
| `collectionCode` | VARCHAR | 58.0 | 70 |
| `catalogNumber` | VARCHAR | 90.9 | 13396 |
| `recordNumber` | VARCHAR | 48.3 | 5164 |
| `identifiedBy` | VARCHAR | 32.0 | 809 |
| `dateIdentified` | VARCHAR | 19.3 | 1382 |
| `license` | VARCHAR | 100.0 | 3 |
| `rightsHolder` | VARCHAR | 38.1 | 453 |
| `recordedBy` | VARCHAR | 74.4 | 1249 |
| `typeStatus` | VARCHAR | 2.3 | 12 |
| `establishmentMeans` | VARCHAR | 0.0 | 0 |
| `lastInterpreted` | VARCHAR | 100.0 | 14349 |
| `mediaType` | VARCHAR | 29.2 | 1 |
| `issue` | VARCHAR | 100.0 | 237 |


## `raw_gbif_occurrences` — 1287722 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `gbifID` | VARCHAR | 100.0 | 1287722 |
| `datasetKey` | VARCHAR | 100.0 | 456 |
| `occurrenceID` | VARCHAR | 97.5 | 1255135 |
| `kingdom` | VARCHAR | 100.0 | 1 |
| `phylum` | VARCHAR | 99.3 | 7 |
| `class` | VARCHAR | 99.2 | 31 |
| `order` | VARCHAR | 99.2 | 158 |
| `family` | VARCHAR | 99.2 | 546 |
| `genus` | VARCHAR | 96.3 | 4024 |
| `species` | VARCHAR | 78.6 | 24873 |
| `infraspecificEpithet` | VARCHAR | 9.5 | 1597 |
| `taxonRank` | VARCHAR | 100.0 | 11 |
| `scientificName` | VARCHAR | 100.0 | 36484 |
| `verbatimScientificName` | VARCHAR | 98.6 | 64717 |
| `verbatimScientificNameAuthorship` | VARCHAR | 55.2 | 13457 |
| `countryCode` | VARCHAR | 100.0 | 1 |
| `locality` | VARCHAR | 90.0 | 114006 |
| `stateProvince` | VARCHAR | 86.8 | 978 |
| `occurrenceStatus` | VARCHAR | 100.0 | 2 |
| `individualCount` | VARCHAR | 71.6 | 114 |
| `publishingOrgKey` | VARCHAR | 100.0 | 235 |
| `decimalLatitude` | VARCHAR | 100.0 | 92216 |
| `decimalLongitude` | VARCHAR | 100.0 | 92140 |
| `coordinateUncertaintyInMeters` | VARCHAR | 28.0 | 5244 |
| `coordinatePrecision` | VARCHAR | 0.1 | 14 |
| `elevation` | VARCHAR | 66.8 | 6441 |
| `elevationAccuracy` | VARCHAR | 22.2 | 687 |
| `depth` | VARCHAR | 0.0 | 34 |
| `depthAccuracy` | VARCHAR | 0.0 | 6 |
| `eventDate` | VARCHAR | 95.1 | 95003 |
| `day` | VARCHAR | 91.8 | 31 |
| `month` | VARCHAR | 93.5 | 12 |
| `year` | VARCHAR | 95.1 | 208 |
| `taxonKey` | VARCHAR | 100.0 | 36485 |
| `speciesKey` | VARCHAR | 78.6 | 25031 |
| `basisOfRecord` | VARCHAR | 100.0 | 8 |
| `institutionCode` | VARCHAR | 98.0 | 956 |
| `collectionCode` | VARCHAR | 95.7 | 327 |
| `catalogNumber` | VARCHAR | 97.6 | 1246939 |
| `recordNumber` | VARCHAR | 61.7 | 97447 |
| `identifiedBy` | VARCHAR | 63.9 | 18248 |
| `dateIdentified` | VARCHAR | 37.8 | 70907 |
| `license` | VARCHAR | 100.0 | 3 |
| `rightsHolder` | VARCHAR | 61.3 | 5005 |
| `recordedBy` | VARCHAR | 69.1 | 29373 |
| `typeStatus` | VARCHAR | 0.7 | 20 |
| `establishmentMeans` | VARCHAR | 0.8 | 3 |
| `lastInterpreted` | VARCHAR | 100.0 | 545041 |
| `mediaType` | VARCHAR | 28.0 | 38 |
| `issue` | VARCHAR | 99.3 | 933 |


## `raw_wcvp_distributions` — 1995338 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `plant_locality_id` | VARCHAR | 100.0 | 1995338 |
| `plant_name_id` | VARCHAR | 100.0 | 445922 |
| `continent_code_l1` | VARCHAR | 100.0 | 9 |
| `continent` | VARCHAR | 100.0 | 9 |
| `region_code_l2` | VARCHAR | 100.0 | 52 |
| `region` | VARCHAR | 100.0 | 52 |
| `area_code_l3` | VARCHAR | 99.9 | 368 |
| `area` | VARCHAR | 99.9 | 368 |
| `introduced` | VARCHAR | 100.0 | 2 |
| `extinct` | VARCHAR | 100.0 | 2 |
| `location_doubtful` | VARCHAR | 100.0 | 2 |


## `raw_wcvp_names` — 1448984 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `plant_name_id` | VARCHAR | 100.0 | 1448984 |
| `ipni_id` | VARCHAR | 89.9 | 1302804 |
| `taxon_rank` | VARCHAR | 99.8 | 33 |
| `taxon_status` | VARCHAR | 100.0 | 9 |
| `family` | VARCHAR | 100.0 | 461 |
| `genus_hybrid` | VARCHAR | 0.4 | 2 |
| `genus` | VARCHAR | 100.0 | 39957 |
| `species_hybrid` | VARCHAR | 2.0 | 2 |
| `species` | VARCHAR | 97.1 | 186361 |
| `infraspecific_rank` | VARCHAR | 24.5 | 31 |
| `infraspecies` | VARCHAR | 24.7 | 72505 |
| `parenthetical_author` | VARCHAR | 29.7 | 21662 |
| `primary_author` | VARCHAR | 98.6 | 80152 |
| `publication_author` | VARCHAR | 9.8 | 2169 |
| `place_of_publication` | VARCHAR | 99.9 | 16018 |
| `volume_and_page` | VARCHAR | 98.5 | 239172 |
| `first_published` | VARCHAR | 98.5 | 1073 |
| `nomenclatural_remarks` | VARCHAR | 6.8 | 1304 |
| `geographic_area` | VARCHAR | 30.8 | 69653 |
| `lifeform_description` | VARCHAR | 27.7 | 359 |
| `climate_description` | VARCHAR | 33.5 | 9 |
| `taxon_name` | VARCHAR | 100.0 | 1395487 |
| `taxon_authors` | VARCHAR | 98.6 | 246079 |
| `accepted_plant_name_id` | VARCHAR | 97.3 | 443758 |
| `basionym_plant_name_id` | VARCHAR | 32.7 | 296657 |
| `replaced_synonym_author` | VARCHAR | 3.1 | 5665 |
| `homotypic_synonym` | VARCHAR | 21.3 | 1 |
| `parent_plant_name_id` | VARCHAR | 31.9 | 36725 |
| `powo_id` | VARCHAR | 100.0 | 1448984 |
| `hybrid_formula` | VARCHAR | 1.1 | 14868 |
| `reviewed` | VARCHAR | 100.0 | 2 |


## `stats_diversity` — 5 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `metric` | VARCHAR | 100.0 | 5 |
| `value` | DECIMAL(14,4) | 100.0 | 5 |


## `wcvp_accepted` — 434691 filas

| columna | tipo | cobertura % | distintos |
|---|---|---:|---:|
| `plant_name_id` | VARCHAR | 100.0 | 434691 |
| `accepted_plant_name_id` | VARCHAR | 100.0 | 434691 |
| `taxon_status` | VARCHAR | 100.0 | 1 |
| `taxon_rank` | VARCHAR | 100.0 | 9 |
| `family` | VARCHAR | 100.0 | 458 |
| `genus` | VARCHAR | 100.0 | 14162 |
| `species` | VARCHAR | 96.7 | 114264 |
| `taxon_name` | VARCHAR | 100.0 | 434688 |
| `taxon_authors` | VARCHAR | 95.4 | 101403 |
| `lifeform_description` | VARCHAR | 74.8 | 356 |
| `climate_description` | VARCHAR | 89.7 | 9 |
