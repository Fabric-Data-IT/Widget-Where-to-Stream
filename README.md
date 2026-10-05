# Where to Stream · widget de Origin Nexus (v2)

Web component embebible que muestra **dónde ver** una película o serie en un país:
suscripción, gratis/AVOD, alquiler y compra. Shadow DOM, sin dependencias, **~5,4 KB gzip**.

```html
<script src="https://cdn.origin.fabricdata.com/where-to-stream/2/where-to-stream.js" defer></script>
<fabric-where-to-stream uid="oi-1234" country="US" client-key="pk_live_…"></fabric-where-to-stream>
```

> **Estado: beta.** El endpoint de datos (`GET /v1/where-to-stream` de la API de Nexus)
> **todavía no existe**; la demo corre contra un **mock**. CDN y dominio de API están
> `[[confirmar]]`. Nada de esto está publicado.

| Doc | Qué tiene |
|-----|-----------|
| [`docs/INTEGRACION.md`](docs/INTEGRACION.md) | Snippet, atributos, theming, eventos, seguridad, build/CDN, migración desde el legacy |
| [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md) | Contrato del endpoint y lo que necesita el backend (keys por dominio, rate limit, CORS, caché) |
| [`demo/`](demo/) | Página de demo con configurador y snippet copiable (`npm run demo`) |

## Desarrollo

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run build && npm run size
npm run demo          # http://localhost:4173/demo/
npm run tokens:sync   # regenera src/tokens.generated.ts desde @fabric-data-it/nexus-tokens
```

```
src/element.ts          el custom element (render sin innerHTML)
src/api.ts              fetch + caché compartida + validación de la respuesta
src/styles.ts           CSS del shadow root (sobre tokens --nx-*)
src/tokens.generated.ts GENERADO desde @fabric-data-it/nexus-tokens
demo/                   página de demo + mock de la API (no entra en el bundle)
index.html              demo LEGACY (v1, BB Media) que sirve GitHub Pages hoy
```

**Tokens:** el look sale de `@fabric-data-it/nexus-tokens` (fuente de verdad: Live Streaming).
Mientras el paquete no esté publicado en GitHub Packages, `tokens:sync` lo lee de una copia
local (`NEXUS_TOKENS_DIR`); el resultado se commitea, así que CI no depende del paquete.

## Legacy (v1)

`index.html` es la demo vieja (Vue + Bootstrap, marca BB Media) que publica **GitHub Pages**
desde `main`. **No funciona:** su script (`bb-media.com/widgets/where_to_stream.js`) da 404 y
el proxy `middle.bb-media.com` responde 500. Este PR le agrega un aviso visible; mergear a
`main` lo publica en Pages.

## Licencia

Propietaria — ver [`LICENSE`](LICENSE) (`[[confirmar: licencia comercial]]`). Reemplaza la MIT
de "BB Media IT".
