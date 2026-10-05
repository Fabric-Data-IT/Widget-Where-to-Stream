import { TOKENS_CSS } from './tokens.generated';

/**
 * Estilos del shadow root. Todo sale de los tokens `--nx-*`: el host puede cambiar cualquiera
 * desde afuera (`fabric-where-to-stream { --nx-color-surface: … }`), porque las reglas del
 * documento sobre el elemento le ganan a `:host`.
 *
 * La fuente (Source Sans 3) NO se carga desde el widget: si el sitio ya la tiene, se usa; si
 * no, cae al stack del sistema. Cargarla costaría ~40 KB y un request a terceros.
 */
const CSS = `
:host{display:block;max-width:560px;font-family:var(--nx-font-family);color:var(--nx-color-text);line-height:1.3;-webkit-font-smoothing:antialiased}
:host([hidden]){display:none}
*{box-sizing:border-box}
.w{display:flex;flex-direction:column;gap:var(--nx-sp-4);padding:var(--nx-sp-4);background:var(--nx-color-surface);border:1px solid var(--nx-color-border);border-radius:var(--nx-radius-card)}
.hd{display:flex;flex-direction:column;gap:2px;min-width:0}
h2{margin:0;font-size:var(--nx-text-title);font-weight:var(--nx-font-weight-semibold)}
.sub{font-size:var(--nx-text-label);color:var(--nx-color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g{display:flex;flex-direction:column;gap:var(--nx-sp-2)}
h3{margin:0;font-size:var(--nx-text-versalita);font-weight:var(--nx-font-weight-bold);letter-spacing:var(--nx-letter-spacing-versalita);text-transform:uppercase;color:var(--nx-color-text-muted)}
ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:var(--nx-sp-2)}
.o{display:flex;align-items:center;gap:var(--nx-sp-2);height:52px;padding:6px var(--nx-sp-3) 6px 6px;border-radius:var(--nx-radius-block);background:var(--nx-overlay-subtle);color:inherit;text-decoration:none;transition:background-color var(--nx-motion-fast)}
a.o:hover{background:var(--nx-overlay-hover)}
a:focus-visible{outline:none;box-shadow:var(--nx-shadow-focus)}
.lg{flex:none;width:40px;height:40px;border-radius:var(--nx-radius-block);object-fit:cover;background:var(--nx-color-bg)}
.in{display:grid;place-items:center;background:var(--nx-gradient-primary);color:#fff;font-size:var(--nx-text-micro);font-weight:var(--nx-font-weight-bold)}
.tx{display:flex;flex-direction:column;min-width:0}
.nm{font-size:var(--nx-text-body);font-weight:var(--nx-font-weight-semibold);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mt{font-size:var(--nx-text-micro);color:var(--nx-color-text-muted);white-space:nowrap}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.msg{margin:0;font-size:var(--nx-text-body);color:var(--nx-color-text-muted)}
.ft{font-size:var(--nx-text-micro);color:var(--nx-color-text-muted);text-align:right}
.ft a{color:inherit;font-weight:var(--nx-font-weight-semibold);text-decoration:none;border-radius:2px}
.ft a:hover{color:var(--nx-color-text)}
.sk{height:52px;border-radius:var(--nx-radius-block);background:linear-gradient(90deg,var(--nx-overlay-subtle) 25%,var(--nx-overlay-hover) 50%,var(--nx-overlay-subtle) 75%);background-size:200% 100%;animation:s 1.2s linear infinite}
@keyframes s{to{background-position:-200% 0}}
:host([layout="compact"]) .w{gap:var(--nx-sp-3);padding:var(--nx-sp-3)}
:host([layout="compact"]) ul{display:flex;flex-wrap:wrap}
:host([layout="compact"]) .o{height:auto;padding:0;background:none}
:host([layout="compact"]) .tx{display:none}
:host([layout="compact"]) .lg{width:44px;height:44px}
:host([layout="compact"]) .sk{width:44px;height:44px}
@media (prefers-reduced-motion:reduce){.sk{animation:none}.o{transition:none}}
`;

export const STYLES = TOKENS_CSS + CSS.replace(/\n/g, '');

let sheet: CSSStyleSheet | null | undefined;

/** Una hoja compartida por todas las instancias, si el navegador soporta adoptedStyleSheets. */
export function sharedSheet(): CSSStyleSheet | null {
  if (sheet !== undefined) return sheet;
  try {
    const s = new CSSStyleSheet();
    s.replaceSync(STYLES);
    sheet = s;
  } catch {
    sheet = null;
  }
  return sheet;
}
