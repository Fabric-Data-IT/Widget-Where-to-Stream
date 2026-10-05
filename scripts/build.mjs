// Build del widget.
//
// dist/where-to-stream.js        IIFE minificado: el que se embebe con <script>.
// dist/where-to-stream.esm.js    ESM: para bundlers (import '@fabric-data-it/where-to-stream').
// dist/types/                    .d.ts
// dist/cdn/where-to-stream/<versión>/where-to-stream.js   inmutable (cache 1 año)
// dist/cdn/where-to-stream/<major>/where-to-stream.js     alias de major (cache corto)
// dist/cdn/where-to-stream/<versión>/sri.json             hash SRI sha384 para el snippet
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { build } from 'esbuild';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = pkg.version;
const major = version.split('.')[0];
const banner = `/*! fabric-where-to-stream v${version} | (c) Fabric Data | Propietario */`;

await rm('dist', { recursive: true, force: true });

const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  target: ['es2020'],
  define: { __VERSION__: JSON.stringify(version) },
  banner: { js: banner },
  legalComments: 'none',
  logLevel: 'warning',
};
// Global `FabricWhereToStream` (VERSION, define) para quien quiera registrar otro tag.
await build({ ...common, format: 'iife', globalName: 'FabricWhereToStream', outfile: 'dist/where-to-stream.js' });
await build({ ...common, format: 'esm', outfile: 'dist/where-to-stream.esm.js' });

execFileSync('npx', ['tsc', '-p', 'tsconfig.types.json'], { stdio: 'inherit' });

const file = await readFile('dist/where-to-stream.js');
const sri = `sha384-${createHash('sha384').update(file).digest('base64')}`;
for (const dir of [`dist/cdn/where-to-stream/${version}`, `dist/cdn/where-to-stream/${major}`]) {
  await mkdir(dir, { recursive: true });
  await copyFile('dist/where-to-stream.js', `${dir}/where-to-stream.js`);
}
await writeFile(
  `dist/cdn/where-to-stream/${version}/sri.json`,
  JSON.stringify({ version, file: 'where-to-stream.js', integrity: sri }, null, 2) + '\n',
);
console.log(`where-to-stream v${version} → dist/  (SRI ${sri})`);
