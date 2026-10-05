// Mide el bundle embebible y falla si pasa el presupuesto (15 KB gzip).
import { readFile } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const BUDGET = 15 * 1024;
const kb = (n) => (n / 1024).toFixed(2) + ' KB';
let fail = false;
for (const f of ['dist/where-to-stream.js', 'dist/where-to-stream.esm.js']) {
  const buf = await readFile(f);
  const gz = gzipSync(buf, { level: 9 }).length;
  const br = brotliCompressSync(buf).length;
  console.log(`${f}: ${kb(buf.length)} min · ${kb(gz)} gzip · ${kb(br)} brotli`);
  if (gz > BUDGET) {
    console.error(`  ✗ supera el presupuesto de ${kb(BUDGET)} gzip`);
    fail = true;
  }
}
process.exit(fail ? 1 : 0);
