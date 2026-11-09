import { env, pipeline } from '@huggingface/transformers';
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = true;
let classifier: ReturnType<typeof pipeline<'text-classification'>> | undefined;
self.onmessage = async (event: MessageEvent<{ id: number; rows: string[]; base: string }>) => {
  const { id, rows, base } = event.data;
  try {
    const origin = new URL(base).origin;
    if (origin !== self.location.origin || rows.length > 100 || rows.some(r => r.length > 500)) throw new Error('Invalid receipt input.');
    env.localModelPath = `${base}models/`;
    const wasm = env.backends.onnx.wasm;
    if (!wasm) throw new Error('WASM unavailable.');
    wasm.wasmPaths = `${base}receipt-runtime/`;
    wasm.numThreads = 1;
    wasm.proxy = false;
    classifier ??= pipeline('text-classification', 'receipt-bert', { dtype: 'q8', device: 'wasm' });
    const model = await classifier;
    const predictions = await model(rows, { truncation: true, max_length: 48, top_k: 1 });
    self.postMessage({ id, predictions });
  } catch {
    classifier = undefined;
    self.postMessage({ id, error: 'Trained receipt model unavailable. Original OCR and manual editing remain available.' });
  }
};
