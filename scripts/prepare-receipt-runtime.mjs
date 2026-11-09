import { cp, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = dirname(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const runtime = dirname(require.resolve('onnxruntime-web'));
const target = join(root, 'public', 'receipt-runtime');
await mkdir(target, { recursive: true });
for (const file of await readdir(runtime)) {
  if (/^ort-wasm.*\.(wasm|mjs)$/.test(file)) await cp(join(runtime, file), join(target, file));
}
try {
  await access(join(root, 'public', 'models', 'receipt-bert', 'manifest.json'));
  console.log('Local trained model found; browser inference assets prepared.');
} catch {
  console.log('No local trained artifact found. Receipt OCR and manual entry remain available. See ml/receipt/README.md.');
}
