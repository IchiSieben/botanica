Copia vendoreada de `Portfolio/shared/changelog/`.

Se vendorea a proposito: cada demo es un repo hermano autocontenido (regla de
estructura del brief), asi que un `import` que suba fuera del repo romperia el
clon. Si cambia el upstream, recopiar `changelog.mjs` y `changelog.css` desde
`Portfolio/shared/changelog/` y no editar la copia directamente — cualquier
fix va primero en el upstream.

`readTags()` no necesita tags reales para funcionar: si el build corre en un
clon superficial (Hostinger, CI) sin tags, devuelve `[]` y las paginas de
cambios simplemente no muestran enlace a tag/commit para esa version.
