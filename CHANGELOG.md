# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), versionado SemVer.

## [2.0.0-beta.1] - 2026-10-05

Reescritura completa. Sin compatibilidad con el snippet legacy (ver `docs/INTEGRACION.md` §7).

### Agregado
- Web component `<fabric-where-to-stream>` con Shadow DOM, sin dependencias (~5,4 KB gzip).
- Look & feel de Origin Nexus vía `@fabric-data-it/nexus-tokens` (tema oscuro y claro, layout `full`/`compact`).
- Ofertas agrupadas por modelo (suscripción, gratis/AVOD, alquiler, compra) con precio y calidad.
- i18n `en`/`es`/`pt`; eventos `fws:load`, `fws:click`, `fws:error`; `::part()` para estilos.
- Contrato de API propio (`docs/API-CONTRACT.md`) con publishable key por cliente.
- Build versionado para CDN con SRI, presupuesto de tamaño, tests (Vitest + happy-dom) y CI.
- Página de demo con mock de la API (`demo/`).

### Quitado
- Marca BB Media, dependencia del proxy `middle.bb-media.com` y del script `bb-media.com/widgets/where_to_stream.js`.

### Seguridad
- Sin `innerHTML` con datos; URLs solo `https:`; requests sin credenciales; links `noopener noreferrer sponsored`.

### Licencia
- MIT reemplazada por licencia propietaria (placeholder, `[[confirmar: licencia comercial]]`).
