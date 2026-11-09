import { env, pipeline } from '@huggingface/transformers';
import type { TextClassificationPipeline } from '@huggingface/transformers';
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = true;
const createClassifier = pipeline as (task: 'text-classification', model: string,
  options: { dtype: 'q8'; device: 'wasm' }) => Promise<TextClassificationPipeline>;
let classifier: Promise<TextClassificationPipeline> | undefined;
let version = '';
self.onmessage = async (event: MessageEvent<{ id: number; rows: string[]; base: string }>) => {
  const { id, rows, base } = event.data;
  let stage = 'assets';
  try {
    const origin = new URL(base).origin;
    if (origin !== self.location.origin || rows.length > 100 || rows.some(r => r.length > 500)) throw new Error('Invalid receipt input.');
    env.localModelPath = `${base}models/`;
    const wasm = env.backends.onnx.wasm;
    if (!wasm) throw new Error('WASM unavailable.');
    wasm.wasmPaths = { mjs: `${base}receipt-runtime/ort-wasm-simd-threaded.jsep.mjs`,
      wasm: `${base}receipt-runtime/ort-wasm-simd-threaded.jsep.wasm` };
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
    stage = 'initialization';
    classifier ??= createClassifier('text-classification', 'receipt-bert', { dtype: 'q8', device: 'wasm' });
    const model = await classifier;
    if (typeof model.tokenizer !== 'function') throw new Error(`Tokenizer unavailable: ${typeof model.tokenizer}; ${Object.keys(model.tokenizer ?? {}).join(',')}`);
    stage = 'inference';
    const predictions = await model(rows, { top_k: 1 });
    self.postMessage({ id, predictions, model: version });
  } catch (error) {
    classifier = undefined;
    version = '';
    // Diagnostics remain inside this worker response; the application never logs receipt text.
    self.postMessage({ id, error: 'Trained receipt model unavailable. Original OCR and manual editing remain available.',
      stage, diagnostic: error instanceof Error ? error.message.slice(0, 500) : 'Model operation failed' });
  }
};
