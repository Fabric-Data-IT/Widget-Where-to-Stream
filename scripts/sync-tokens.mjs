// Regenera src/tokens.generated.ts desde @fabric-data-it/nexus-tokens.
//
// Mientras el paquete no esté publicado en GitHub Packages, se lee de una copia local
// (NEXUS_TOKENS_DIR, por defecto ../../Packages/nexus-tokens con `npm run build` hecho).
// Cuando esté publicado: `npm i -D @fabric-data-it/nexus-tokens` y este script lo toma de
// node_modules sin cambios.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.NEXUS_TOKENS_DIR,
  join(root, 'node_modules/@fabric-data-it/nexus-tokens'),
  resolve(root, '../../Packages/nexus-tokens'),
].filter(Boolean);

const dir = candidates.find((d) => existsSync(join(d, 'dist/index.js')));
if (!dir) {
  console.error('No encuentro @fabric-data-it/nexus-tokens (dist/index.js). Probé:\n  ' + candidates.join('\n  '));
  process.exit(1);
}

const t = await import(pathToFileURL(join(dir, 'dist/index.js')).href);
const { version, name } = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));

// Solo lo que el widget necesita no se recorta: el set completo pesa ~0,6 KB gzip y deja
// que el host sobrescriba cualquier --nx-* desde afuera.
const css =
  t.cssText(':host', 'dark') + t.cssText(':host([theme="light"])', 'light', true);

const out = `// GENERADO por scripts/sync-tokens.mjs desde ${name}@${version}. No editar a mano.
export const TOKENS_VERSION = ${JSON.stringify(version)};
export const TOKENS_CSS = ${JSON.stringify(css)};
`;
await writeFile(join(root, 'src/tokens.generated.ts'), out);
// La página de demo usa los mismos tokens para su propio chrome.
await writeFile(
  join(root, 'demo/tokens.css'),
  `/* GENERADO desde ${name}@${version}. No editar. */\n${t.stylesheet()}\n`,
);
console.log(`src/tokens.generated.ts ← ${name}@${version} (${dir})`);
