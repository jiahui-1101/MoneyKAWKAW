import { validPredictions, type Understanding } from '../domain/receipt-understanding';
let worker: Worker | undefined;
let identity = 0;
export async function understandReceipt(rawText: string, signal: AbortSignal): Promise<Understanding> {
  const started = performance.now();
  const base = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  const rows = rawText.slice(0, 50000).split(/\r?\n/).map(r => r.trim().slice(0, 500)).filter(Boolean).slice(0, 100);
  const model = 'receipt-bert-v1';
  if (signal.aborted) throw new Error('Receipt reading cancelled.');
  try {
    if (import.meta.env.VITE_RECEIPT_MODEL === 'off' || !rows.length) throw new Error('Semantic suggestions disabled.');
    worker ??= new Worker(new URL('./receipt-model.worker.ts', import.meta.url), { type: 'module' });
    const active = worker;
    const id = ++identity;
    const predictions = await new Promise<unknown>((resolve, reject) => {
      const stop = () => { active.terminate(); if (worker === active) worker = undefined; };
      const cleanup = () => {
        clearTimeout(timer); signal.removeEventListener('abort', abort);
        active.removeEventListener('message', message); active.removeEventListener('error', error);
      };
      const abort = () => { stop(); cleanup(); reject(new Error('Receipt reading cancelled.')); };
      const error = () => { stop(); cleanup(); reject(new Error('Semantic model could not run.')); };
      const message = (event: MessageEvent) => {
        if (event.data.id !== id) return;
        cleanup();
        if (event.data.error) { stop(); reject(new Error(event.data.error)); }
        else resolve(event.data.predictions);
      };
      const timer = setTimeout(error, 60000);
      signal.addEventListener('abort', abort, { once: true });
      active.addEventListener('message', message); active.addEventListener('error', error);
      active.postMessage({ id, rows, base });
    });
    if (signal.aborted) throw new Error('Receipt reading cancelled.');
    return { status: 'ready', model, predictions: validPredictions(predictions, rows),
      milliseconds: performance.now() - started, message: 'Experimental semantic suggestions. Verify every line; labels do not determine claim eligibility.' };
  } catch {
    if (signal.aborted) throw new Error('Receipt reading cancelled.');
    return { status: 'unavailable', model, predictions: [], milliseconds: performance.now() - started,
      message: 'Trained model unavailable or disabled. Using original OCR and rules; you can still edit and submit.' };
  }
}
