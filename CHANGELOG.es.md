# Changelog

Todos los cambios relevantes de Botánica se documentan aquí. Formato:
[Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/). Versionado:
[Versionado Semántico](https://semver.org/lang/es/).

## [3.0.0] - 2026-09-24

### Agregado
- Una pantalla de introducción en `/` y `/es/`: entre 8 y 10 datos sobre la flora y los hongos
  del Perú, cada uno un número calculado a partir de los datos del atlas con un enlace a su
  fuente, más una breve línea de tiempo de hitos y una nota en lenguaje llano sobre cómo funciona
  el atlas (checklist vs. registros).
- Una línea "cómo leer esto", una leyenda con unidades y una línea de fuente (dataset +
  DOI/versión) en cada gráfico: mapa, familias, origen, forma de vida, años y árbol taxonómico.
- Nueve grupos de forma de vida (árbol, arbusto, hierba, geófita, trepadora, epífita, suculenta,
  acuática, parásita, más "otras") a partir del texto original del checklist, mostrados como un
  filtro con el texto original conservado como tooltip.
- Clados intermedios en el árbol taxonómico para plantas (licofitas, helechos, gimnospermas,
  angiospermas, monocotiledóneas, eudicotiledóneas y sus subgrupos) y filo → clase para hongos.
- Controles de pantalla completa, acercar/alejar/reencuadrar y expandir todo/colapsar todo en el
  árbol taxonómico.
- Acercamiento (botones, rueda, pellizco) y desplazamiento (arrastre) en el mapa de
  departamentos, más una vista de pantalla completa y una leyenda con un color dedicado a "sin
  registros".
- Una página de cambios en `/cambios/` y `/es/cambios/`, generada en tiempo de build a partir de
  este archivo y de los tags de git, con un enlace a cada versión hacia su commit o tag en GitHub.

### Cambiado
- Se ajustó el layout del explorador de un vistazo: a 1440×900, el mapa, los KPIs, las familias y
  el origen ahora caben en los primeros 900 px de la sección del explorador; forma de vida y años
  quedan debajo.
- El KPI de departamento ahora dice "especies con registros GBIF en <departamento>" y explica,
  junto al número, que los conteos de especies salen del checklist cruzado con registros GBIF
  (por ejemplo, Loreto: 7 905 → 5 821), coherente con lo que el mapa ya mostraba desde v2.
- Los controles de idioma y tema del encabezado ahora muestran ícono, texto visible y etiqueta a
  la vez, y siguen cabiendo a 360 px de ancho.
- El panel de especie indica su ruta taxonómica, estado, año de descripción (con enlace a la
  descripción original) y departamentos, con un espacio vacío reservado para fotos en una
  próxima versión.

### Corregido
- Al hacer clic en un grupo de la lista taxonómica, el árbol ahora resalta, expande y centra esa
  rama correctamente (antes podía apuntar al nodo equivocado).

## [2.0.0] - 2026-09-24

### Agregado
- Un atlas totalmente explorable: hacer clic en un departamento, una familia, una forma de vida,
  un origen o una década actualiza todas las vistas juntas, y la elección queda en la URL para
  compartir.
- Un mapa SVG de los departamentos del Perú generado en tiempo de build en la página de inicio,
  que reemplaza la librería de gráficos que se usaba ahí por una primera pantalla más liviana y
  accesible.
- Búsqueda que abre un panel de especie con sus detalles, y un árbol taxonómico que filtra el
  resto del explorador al elegir un grupo.
- Un control de años con "reproducir" para ver cómo se acumulan las especies en el tiempo,
  década por década.
- Un selector de reino Plantae ↔ Hongos, con advertencias propias de hongos donde el dato es
  escaso.
- Un recorrido de apertura en cada página, y traducción completa a inglés/español (inglés en la
  raíz, español bajo `/es/`).
- Tipografías autoalojadas (sin pedidos externos de fuentes) y una página de inicio más liviana
  (LCP menor a 2 segundos en móvil).

### Cambiado
- Se rehicieron los números, el layout y la interacción para móvil: 360 px de ancho sin
  desbordamiento horizontal, objetivos táctiles del tamaño de un dedo, y páginas que se mantienen
  rápidas en un teléfono de gama media.

## [1.0.0] - 2026-09-22

### Agregado
- Primera versión pública: un atlas estático de las especies de plantas y hongos registradas en
  el Perú, construido con datos abiertos de WCVP (Kew) y GBIF.
- Un buscador de especies en `/especies/` con búsqueda del lado del cliente entre más de 23 000
  especies.
- Documentación bilingüe (inglés/español) y un pipeline de datos verificado y reproducible.
