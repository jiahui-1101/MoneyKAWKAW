import { pressureSchema } from '../domain/pressure-features';
import { predictPressure, validatePressureModel, type PressureModel } from '../domain/pressure-trees';
import * as ort from 'onnxruntime-web';
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = '/pressure-runtime/';
let cached: { model: PressureModel; version: string; session: ort.InferenceSession } | undefined;
export async function loadPressureModel() {
  if (cached) return cached;
  const base = '/models/budget-pressure/';
  const response = await fetch(`${base}manifest.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error('LightGBM model is unavailable.');
  const m = await response.json();
  if (m.featureSchema !== pressureSchema.version || m.dataset !== 'SYNTHETIC' || m.experimental !== true ||
      m.realWorldValidation !== false || m.horizonDays !== 30 || !/^[a-f0-9]{64}$/.test(m.sha256) ||
      m.file !== `${m.sha256}.json` || m.version !== `pressure-v1:${m.sha256.slice(0, 12)}` ||
      !Number.isInteger(m.iterations) || m.iterations < 1 || m.iterations > 400)
    throw new Error('Incompatible LightGBM manifest.');
  const artifact = await fetch(base + m.file);
  if (!artifact.ok || Number(artifact.headers.get('Content-Length') ?? 0) > 2_000_000)
    throw new Error('LightGBM artifact is unavailable.');
  const bytes = await artifact.arrayBuffer();
  if (bytes.byteLength > 2_000_000) throw new Error('LightGBM artifact exceeds the size limit.');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  if (digest !== m.sha256) throw new Error('LightGBM checksum failed.');
  const model = validatePressureModel(JSON.parse(new TextDecoder().decode(bytes)));
  if (model.trees.length !== m.iterations) throw new Error('LightGBM iteration mismatch.');
  if (!/^[a-f0-9]{64}$/.test(m.onnxSha256) || m.onnxFile !== `${m.onnxSha256}.onnx`)
    throw new Error('Incompatible LightGBM ONNX manifest.');
  const graphResponse = await fetch(base + m.onnxFile);
  if (!graphResponse.ok) throw new Error('LightGBM ONNX unavailable.');
  const graph = await graphResponse.arrayBuffer();
  const graphHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', graph))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  if (graph.byteLength > 2_000_000 || graphHash !== m.onnxSha256) throw new Error('LightGBM ONNX checksum failed.');
  const session = await ort.InferenceSession.create(graph, { executionProviders: ['wasm'] });
  cached = { model, version: m.version, session };
  return cached;
}
self.onmessage = async (event: MessageEvent<{ id: string; values: number[] }>) => {
  const { id, values } = event.data;
  try {
    const start = performance.now();
    const { model, version, session } = await loadPressureModel();
    const explained = predictPressure(model, values);
    const result = await session.run({ features: new ort.Tensor('float32', Float32Array.from(values), [1, values.length]) });
    const score = Number(result.probabilities.data[1]);
    if (!Number.isFinite(score) || Math.abs(score - explained.score) > 1e-4)
      throw new Error('LightGBM ONNX/tree explanation parity failed.');
    self.postMessage({ id, ...explained, score, version, milliseconds: performance.now() - start });
  } catch {
    self.postMessage({ id, error: 'Experimental LightGBM unavailable. Financial rules remain available.' });
  }
};
