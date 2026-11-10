export interface PressureResult {
  score: number;
  raw: number;
  base: number;
  contributions: number[];
  version: string;
  milliseconds: number;
}
export function runPressureModel(values: number[], signal: AbortSignal): Promise<PressureResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    if (import.meta.env.VITE_PRESSURE_MODEL === 'off') { reject(new Error('Experimental LightGBM is disabled.')); return; }
    const worker = new Worker(new URL('./pressure-model.worker.ts', import.meta.url), { type: 'module' });
    const id = crypto.randomUUID();
    const finish = (error?: Error, value?: PressureResult) => {
      clearTimeout(timer); signal.removeEventListener('abort', abort); worker.terminate();
      if (error) reject(error); else resolve(value!);
    };
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('LightGBM timed out. Financial rules remain available.')), 10000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => finish(new Error('Experimental LightGBM could not start.'));
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.error) { finish(new Error(data.error)); return; }
      if (!Number.isFinite(data.score) || data.score < 0 || data.score > 1 ||
          !Number.isFinite(data.raw) || !Number.isFinite(data.base) || !Number.isFinite(data.milliseconds) ||
          !/^pressure-v1:[a-f0-9]{12}$/.test(data.version) ||
          !Array.isArray(data.contributions) || data.contributions.length !== values.length ||
          !data.contributions.every(Number.isFinite)) {
        finish(new Error('Invalid experimental LightGBM output.')); return;
      }
      finish(undefined, data);
    };
    worker.postMessage({ id, values });
  });
}
