import { cp, mkdir, readdir, access, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const runtime = dirname(require.resolve('onnxruntime-web'));
const target = join(root, 'public', 'receipt-runtime');
await mkdir(target, { recursive: true });
const needed = /^ort-wasm-simd-threaded\.jsep\.(wasm|mjs)$/;
for (const file of await readdir(target)) {
  if (/^ort-wasm.*\.(wasm|mjs)$/.test(file) && !needed.test(file)) await unlink(join(target, file));
}
for (const file of await readdir(runtime)) {
  if (needed.test(file)) await cp(join(runtime, file), join(target, file));
}
try {
  await access(join(root, 'public', 'models', 'receipt-bert', 'manifest.json'));
  console.log('Local trained model found; browser inference assets prepared.');
} catch {
  console.log('No local trained artifact found. Receipt OCR and manual entry remain available. See ml/receipt/README.md.');
}
