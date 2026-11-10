import type { QwenRequest } from './qwen.worker';
export interface QwenResult {
  text: string; version: string; device: string; tokens: number;
  initializedMs: number; firstTokenMs?: number; milliseconds: number;
}
export class QwenSession {
  private worker?: Worker;
  private reject?: (error: Error) => void;
  cancel() {
    this.worker?.terminate(); this.worker = undefined;
    this.reject?.(new DOMException('Generation cancelled', 'AbortError')); this.reject = undefined;
  }
  generate(input: Omit<QwenRequest, 'id'>, signal: AbortSignal,
    progress: (message: string) => void): Promise<QwenResult> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
      if (import.meta.env.VITE_QWEN_MODEL === 'off') { reject(new Error('Qwen is disabled.')); return; }
      if (this.reject) { reject(new Error('Wait for the active generation.')); return; }
      try { this.worker ??= new Worker(new URL('./qwen.worker.ts', import.meta.url), { type: 'module' }); }
      catch { reject(new Error('This browser cannot start local Qwen.')); return; }
      const id = crypto.randomUUID();
      const finish = (error?: Error, value?: QwenResult) => {
        clearTimeout(timer); signal.removeEventListener('abort', abort); this.reject = undefined;
        if (error) { this.worker?.terminate(); this.worker = undefined; reject(error); } else resolve(value!);
      };
      const abort = () => finish(new DOMException('Generation cancelled', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('Qwen timed out. Use deterministic help.')), 120000);
      this.reject = (error) => finish(error);
      signal.addEventListener('abort', abort, { once: true });
      this.worker.onerror = () => finish(new Error('Local Qwen could not run. Use deterministic help.'));
      this.worker.onmessage = ({ data }) => {
        if (data.id !== id) return;
        if (data.phase === 'error') { finish(new Error('Local Qwen unavailable. Use deterministic help.')); return; }
        if (data.phase === 'loading') { progress(`Preparing local model${Number.isFinite(data.progress) ? ` · current file ${Math.round(data.progress)}%` : '…'}`); return; }
        if (data.phase === 'generating') { progress(`Generating locally · ${data.tokens} tokens · validating before display`); return; }
        if (data.phase !== 'complete') return;
        if (typeof data.text !== 'string' || data.text.length > 6000 || data.version !== 'qwen3:9e33a5911974' ||
            !Number.isFinite(data.milliseconds) || !Number.isSafeInteger(data.tokens) || data.tokens > 130) {
          finish(new Error('Invalid Qwen output.')); return;
        }
        finish(undefined, data);
      };
      this.worker.postMessage({ ...input, id });
    });
  }
}
