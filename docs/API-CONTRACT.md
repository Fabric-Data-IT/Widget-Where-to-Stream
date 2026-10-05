# Contrato de API: `GET /v1/where-to-stream`

> **Estado:** propuesto. **El endpoint no existe todavía** en la API de Nexus. La demo usa un
> mock (`demo/mock-api.js`) que sigue este contrato al pie de la letra, errores incluidos.
> Tipos espejo en [`src/types.ts`](../src/types.ts): si cambia uno, cambia el otro.
>
> Dueño sugerido del backend: **back-api-chandra**, en `API-Insights-Integrations` (donde ya
> viven las `lambdas/epg_*` que consume Live Streaming). **No** usar el proxy
> `middle.bb-media.com` ni `api.bb-media.com`.

## Request

```
GET {base}/v1/where-to-stream?id={id}&idType={uid|imdb|tmdb}&country={ISO2}&locale={en|es|pt}&key={publishable_key}
```

| Parámetro | Obligatorio | Validación server |
|-----------|-------------|-------------------|
| `id` | sí | ≤ 64 chars, `[A-Za-z0-9._:-]`. Rechazar el resto con 400 (nada de concatenarlo crudo en paths/SQL). |
| `idType` | no (`uid`) | `uid` (Origin UID) · `imdb` (`tt\d+`) · `tmdb` (`movie:\d+` / `tv:\d+` o numérico + tipo resuelto). |
| `country` | sí | ISO 3166-1 alpha-2, mayúsculas. |
| `locale` | no (`en`) | Solo afecta `title.name` (título localizado si existe). |
| `key` | sí | Publishable key del cliente (`pk_live_…` / `pk_test_…`). |

**Por qué la key va en la query y no en un header:** un header propio (`X-Api-Key`) convierte
el GET en una request "no simple" y obliga a un **preflight CORS** (`OPTIONS`) por widget. En
la query, el GET es simple, sale en un solo viaje y se puede cachear en CDN. La key **no es
secreta**: lo que la protege es la allowlist de dominios (abajo).

`base` por defecto en el widget: `https://widgets.origin.fabricdata.com` — `[[confirmar: dominio]]`
(requiere DNS + custom domain de API Gateway: necesita OK de Joel).

## Response 200

```json
{
  "id": "oi-1234",
  "idType": "uid",
  "country": "US",
  "title": { "name": "Inception", "year": 2010, "type": "movie" },
  "offers": [
    {
      "platformId": "netflix",
      "platformName": "Netflix",
      "logoUrl": "https://assets.origin.fabricdata.com/platforms/netflix.png",
      "monetization": "subscription",
      "price": null,
      "quality": "4K",
      "watchUrl": "https://click.origin.fabricdata.com/r/9f3c…"
    },
    {
      "platformId": "apple-tv",
      "platformName": "Apple TV",
      "logoUrl": null,
      "monetization": "rent",
      "price": { "amount": 3.99, "currency": "USD" },
      "quality": "HD",
      "watchUrl": "https://click.origin.fabricdata.com/r/1ab7…"
    }
  ],
  "updatedAt": "2026-10-05T06:00:00Z"
}
```

| Campo | Notas |
|-------|-------|
| `offers[].platformId` | Id estable del servicio (no el `platform_code` por país). Una fila por servicio + modelo, **deduplicada en server**. |
| `offers[].monetization` | `subscription` · `free` · `ads` (AVOD/FAST) · `rent` · `buy`. El widget agrupa `free` + `ads`. |
| `offers[].logoUrl` | HTTPS, cuadrado (≥ 80×80), servido desde **nuestro** CDN (no hotlink a la plataforma). `null` si no hay: el widget pinta iniciales. Cobertura de logos hoy ≈ 64 % (dato medido en LS). |
| `offers[].price` | `null` para suscripción/gratis. Moneda del país. |
| `offers[].watchUrl` | **Ya envuelto** por el tracker de clicks. El widget nunca arma redirects; solo acepta `https:`. |
| `title` | `null` si no hay metadata (el widget omite el subtítulo). |
| Orden | El server ordena dentro de cada modelo (sugerido: popularidad de la plataforma en el país, luego precio). |

**404** = el `id` no existe en el catálogo → el widget muestra "no disponible" (no error).
Título existente sin ofertas en el país → **200 con `offers: []`**.

**Fuente de datos sugerida:** `content_presence_clean` con `is_current` (tabla canónica de
disponibilidad), filtrada por país, más el catálogo de plataformas (nombre, logo, modelo).
Para `imdb`/`tmdb`: tabla de cruce de ids del catálogo. Precalcular por (título, país) si la
latencia de Athena no da (< 300 ms p95 objetivo en el origen; con CDN delante, la mayoría
sale de caché).

## Errores

| Status | `error` | Cuándo | Qué muestra el widget |
|--------|---------|--------|-----------------------|
| 400 | `invalid_params` | id/país/idType inválidos | error genérico |
| 401 | `missing_key` / `invalid_key` | sin key o key inexistente/revocada | error genérico + `console.warn` |
| 403 | `origin_not_allowed` | `Origin` no está en la allowlist de la key | error genérico + `console.warn` |
| 404 | `title_not_found` | id desconocido | "no disponible" |
| 429 | `rate_limited` | cuota superada (mandar `Retry-After`) | error genérico |
| 5xx | — | — | error genérico |

Cuerpo: `{ "error": "<código>" }`. Sin stack traces ni detalles internos.

## Lo que necesita el backend (checklist)

1. **Publishable keys por cliente** (tabla DynamoDB, p. ej. `nexus_widget_keys`):
   `key` (`pk_live_<random ≥ 24 chars>`), `clientId`, `allowedOrigins` (lista exacta, con
   esquema: `https://www.cliente.com`; comodín de subdominio opcional `https://*.cliente.com`),
   `partnerTag` (afiliados), `status` (`active`/`revoked`), `rateLimit`, `createdAt`. Alta,
   rotación y revocación sin deploy.
2. **Restricción por dominio:** validar el header `Origin` (lo pone el navegador en todo fetch
   CORS; el JS de la página no lo puede falsificar) contra `allowedOrigins`. Si no coincide →
   403. Si viene sin `Origin` (curl, server-to-server) → 403 para `pk_live_*`; permitido solo
   para `pk_test_*` con cuota baja.
   *Límite honesto:* un script fuera del navegador puede mandar cualquier `Origin`. La
   allowlist frena el uso de la key en **otros sitios web**, no el scraping; para eso está el
   rate limit y la revocación.
3. **CORS:** `Access-Control-Allow-Origin: <el Origin validado>` (nunca `*`),
   `Vary: Origin`, sin `Allow-Credentials`. Solo `GET`.
4. **Rate limit por key:** API Gateway **usage plans** (la key de API Gateway se resuelve
   server-side a partir de la publishable key, en un authorizer Lambda con caché) o WAF
   rate-based rule por key+IP. Sugerido inicial: 10 req/s sostenido, ráfaga 50, cuota diaria
   según contrato. Responder 429 + `Retry-After`.
5. **Caché:** `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`. CloudFront
   delante con la **query completa en la cache key** (incluye `key`) y `Origin` en la cache
   key (por el `Vary`). La validación de key/origin tiene que ocurrir **antes** de servir de
   caché (Lambda@Edge / CloudFront Function o authorizer con caché por key+origin).
6. **Clicks:** `watchUrl` sale ya firmado hacia `click.origin.fabricdata.com`
   (`bb-media-reverser-proxy`) con `partner_tag` = el del cliente. El reverse proxy tiene que
   aplicar **allowlist de destinos** (solo dominios de plataformas del catálogo) para cerrar
   el open redirect detectado en la evaluación. Ideal: `/r/{token}` opaco, no la URL destino
   en claro.
7. **Observabilidad:** log por request de `clientId`, `country`, `idType`, status y latencia
   (sin IP completa). Métrica de 403/429 por key para detectar keys filtradas.
8. **Privacidad:** el endpoint no setea cookies. El tracker de clicks loguea IP/UA/referer →
   cubrirlo en el aviso de privacidad / DPA con el cliente.

## Versionado

Ruta versionada (`/v1/`). Cambios aditivos (campos nuevos) no rompen: el widget ignora lo que
no conoce. Renombrar/quitar campos = `/v2/` + nueva major del widget.
