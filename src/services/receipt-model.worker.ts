import { env, pipeline } from '@huggingface/transformers';
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = true;
let classifier: ReturnType<typeof pipeline<'text-classification'>> | undefined;
let version = '';
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
    if (!version) {
      const response = await fetch(`${base}models/receipt-bert/manifest.json`, { credentials: 'omit' });
      if (!response.ok) throw new Error('Model manifest unavailable.');
      const manifest = await response.json();
      if (manifest.id !== 'receipt-bert-v1' || manifest.maxLength !== 48 ||
        !/^[a-f0-9]{64}$/.test(manifest.sha256) || !(manifest.training?.completedSteps > 0)) throw new Error('Incompatible model.');
      version = `${manifest.id}:${manifest.sha256.slice(0, 12)}`;
    }
    classifier ??= pipeline('text-classification', 'receipt-bert', { dtype: 'q8', device: 'wasm' });
    const model = await classifier;
    const predictions = await model(rows, { truncation: true, max_length: 48, top_k: 1 });
    self.postMessage({ id, predictions, model: version });
  } catch {
    classifier = undefined;
    version = '';
    self.postMessage({ id, error: 'Trained receipt model unavailable. Original OCR and manual editing remain available.' });
  }
};
