import { pressureSchema } from '../domain/pressure-features';
import { predictPressure, validatePressureModel, type PressureModel } from '../domain/pressure-trees';
let cached: { model: PressureModel; version: string } | undefined;
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
  cached = { model, version: m.version };
  return cached;
}
self.onmessage = async (event: MessageEvent<{ id: string; values: number[] }>) => {
  const { id, values } = event.data;
  try {
    const start = performance.now();
    const { model, version } = await loadPressureModel();
    self.postMessage({ id, ...predictPressure(model, values), version, milliseconds: performance.now() - start });
  } catch {
    self.postMessage({ id, error: 'Experimental LightGBM unavailable. Financial rules remain available.' });
  }
};
