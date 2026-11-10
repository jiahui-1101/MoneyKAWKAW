import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('onnxruntime-web/package.json'));
mkdirSync('public/pressure-runtime', { recursive: true });
for (const file of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'])
  copyFileSync(`${root}/dist/${file}`, `public/pressure-runtime/${file}`);
console.log('Prepared local CPU LightGBM runtime assets.');
