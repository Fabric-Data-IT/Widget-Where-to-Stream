# Integración del widget Where to Stream v2

> Guía para el equipo y base para la versión pública (en inglés) que se le dará al cliente.
> Las URLs de CDN y API están marcadas `[[confirmar]]`: dependen de DNS/infra con OK de Joel.

## 1. Snippet

```html
<script
  src="https://cdn.origin.fabricdata.com/where-to-stream/2.0.0/where-to-stream.js"
  integrity="sha384-…"
  crossorigin="anonymous"
  defer></script>

<fabric-where-to-stream
  uid="oi-1234"
  country="US"
  client-key="pk_live_…">
</fabric-where-to-stream>
```

- El valor de `integrity` sale de `dist/cdn/where-to-stream/<versión>/sri.json`.
- **Versión fija + SRI** (recomendado para clientes): URL inmutable `/<versión>/` + `integrity`.
- **Alias de major** (`/where-to-stream/2/where-to-stream.js`): recibe fixes sin tocar el
  snippet; no admite SRI porque el contenido cambia.
- Varias instancias por página: sí. Comparten el script, la hoja de estilos y las requests
  con los mismos parámetros.
- Con bundler: `import '@fabric-data-it/where-to-stream'` (paquete privado por ahora).

## 2. Atributos

| Atributo | Obligatorio | Valores | Default |
|----------|-------------|---------|---------|
| `uid` | sí | id del título | — |
| `id-type` | no | `uid` · `imdb` · `tmdb` | `uid` |
| `country` | sí | ISO 3166-1 alpha-2 | — |
| `client-key` | sí | publishable key del cliente | — |
| `locale` | no | `en` · `es` · `pt` | `lang` de la página → navegador → `en` |
| `theme` | no | `dark` · `light` | `dark` |
| `layout` | no | `full` (agrupado por modelo) · `compact` (fila de logos) | `full` |
| `api-base` | no | URL | `https://widgets.origin.fabricdata.com` `[[confirmar]]` |

Cambiar un atributo en vivo re-renderiza (y vuelve a pedir si cambió un dato).

## 3. Personalización

- **Variables CSS:** todo el widget usa los tokens `--nx-*` de
  `@fabric-data-it/nexus-tokens`. El sitio puede pisarlos desde afuera:

  ```css
  fabric-where-to-stream {
    --nx-color-surface: #101418;
    --nx-radius-card: 4px;
    --nx-font-family: Georgia, serif;
    max-width: 420px;
  }
  ```
- **`::part()`** para ajustes finos: `container`, `header`, `title`, `group`, `offer`, `footer`.
- **Fuente:** el widget NO carga Source Sans 3; si la página la tiene, la usa; si no, cae al
  stack del sistema.

## 4. Eventos

Salen del shadow root (`bubbles` + `composed`):

| Evento | `detail` |
|--------|----------|
| `fws:load` | `{ id, country, offers }` (cantidad de ofertas) |
| `fws:click` | `{ platformId, monetization }` |
| `fws:error` | `{ id, country, kind }` — `auth` · `rate` · `network` · `server` · `invalid` |

```js
document.addEventListener('fws:click', (e) => analytics.track('where_to_stream_click', e.detail));
```

## 5. Seguridad y privacidad

- Shadow DOM: el CSS del sitio no rompe el widget ni al revés. Sin globals salvo
  `window.FabricWhereToStream` (solo en el build por `<script>`).
- Ningún dato de la API se inserta con `innerHTML`: todo va por `textContent`/`setAttribute`.
  URLs solo `https:` (se descartan `javascript:`, `data:`, `http:`).
- Requests con `credentials: 'omit'`: no se mandan cookies del sitio. El widget no setea cookies.
- Links con `rel="noopener noreferrer sponsored"` (son de afiliado) y `target="_blank"`.
- CSP del sitio: `script-src` y `connect-src` tienen que permitir los dominios de CDN y API;
  `img-src` el de logos.

## 6. Build, versionado y publicación en CDN

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run build && npm run size
npm run demo        # http://localhost:4173/demo/  (con mock)
```

`npm run build` deja en `dist/cdn/where-to-stream/`:

```
2.0.0/where-to-stream.js   inmutable → Cache-Control: public, max-age=31536000, immutable
2.0.0/sri.json             hash sha384 para el snippet
2/where-to-stream.js       alias de major → Cache-Control: public, max-age=300
```

Publicar (cuando haya OK de infra): `aws s3 sync dist/cdn/ s3://<bucket-cdn>/ …` con los
`Cache-Control` de arriba + invalidación de CloudFront **solo** del alias de major. Bucket,
distribución y dominio `[[confirmar]]`; nada de eso está creado. Ideal: un workflow que
publique al crear el tag `v2.x.y`, con aprobación manual.

Presupuesto de tamaño: **15 KB gzip** (`npm run size` falla si se pasa). Hoy: ~5,4 KB gzip.

## 7. Migración desde el widget legacy (BB Media)

| Legacy | v2 |
|--------|----|
| `<div id="WhereToStream" wts-id wts-provider wts-type wts-country wts-tag>` | `<fabric-where-to-stream uid id-type country client-key>` |
| `wts-provider` (`imdb`/`tmdb`/`tvdb`/`eidr`/`bb`) | `id-type` (`uid`/`imdb`/`tmdb`); TVDB/EIDR quedan fuera hasta que el catálogo tenga el cruce |
| `wts-type` (movie/series) | lo resuelve el server |
| `wts-tag` | sale de la `client-key` (cada key tiene su `partnerTag`) |
| `bb-media.com/widgets/where_to_stream.js` (hoy 404) | CDN versionado |
| `middle.bb-media.com/proxy` (hoy 500) | `GET /v1/where-to-stream` de la API de Nexus |
