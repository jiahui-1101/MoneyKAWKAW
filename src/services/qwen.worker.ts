import { env, pipeline, TextStreamer } from '@huggingface/transformers';
import type { TextGenerationPipeline } from '@huggingface/transformers';
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = true;
env.localModelPath = `${self.location.origin}/models/`;
const wasm = env.backends.onnx.wasm!;
wasm.wasmPaths = { mjs: '/receipt-runtime/ort-wasm-simd-threaded.jsep.mjs', wasm: '/receipt-runtime/ort-wasm-simd-threaded.jsep.wasm' };
wasm.numThreads = 1;
wasm.proxy = false;
let generator: TextGenerationPipeline | undefined;
let version = '', device = '';
const createGenerator = pipeline as (task: 'text-generation', directory: string, options: {
  dtype: 'q4f16'; device: 'wasm' | 'webgpu'; progress_callback: (p: Record<string, unknown>) => void;
}) => Promise<TextGenerationPipeline>;
export interface QwenRequest { id: string; system: string; user: string; device: 'wasm' | 'webgpu' }
self.onmessage = async ({ data }: MessageEvent<QwenRequest>) => {
  const { id, system, user } = data;
  const start = performance.now();
  try {
    if (system.length + user.length > 7000 || !['wasm','webgpu'].includes(data.device)) throw new Error('Bounded Qwen input required.');
    const response = await fetch('/models/qwen-assistant/manifest.json', { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('Qwen assets unavailable.');
    const m = await response.json();
    if (m.id !== 'qwen-assistant-v1' || m.candidate !== 'qwen3' || m.dtype !== 'q4f16' ||
        m.revision !== '58ca03a5e7b354b480b1a82b34bde8dc7b854cc0' || m.license !== 'Apache-2.0' ||
        m.directory !== 'qwen-assistant/qwen3-58ca03a5e7b3-q4f16' ||
        m.version !== 'qwen3:9e33a5911974' || m.maxInputTokens !== 1024 || m.maxNewTokens !== 128 ||
        !Array.isArray(m.files) || !m.files.every((f: { sha256: string }) => /^[a-f0-9]{64}$/.test(f.sha256)))
      throw new Error('Incompatible Qwen manifest.');
    if (generator && (version !== m.version || device !== data.device)) { await generator.dispose(); generator = undefined; }
    if (!generator) {
      generator = await createGenerator('text-generation', m.directory, { dtype: 'q4f16', device: data.device,
        progress_callback: (p) => self.postMessage({ id, phase: 'loading', progress: 'progress' in p ? p.progress : undefined }) });
      version = m.version; device = data.device;
    }
    const initializedMs = performance.now() - start;
    const templateOptions = { tokenize: false, add_generation_prompt: true, enable_thinking: false };
    const prompt = generator.tokenizer.apply_chat_template([{ role: 'system', content: system }, { role: 'user', content: user }], templateOptions) as string;
    if (generator.tokenizer.encode(prompt).length > 1024) throw new Error('Qwen context exceeds token limit.');
    let firstTokenMs: number | undefined, tokens = 0;
    const streamer = new TextStreamer(generator.tokenizer, { skip_prompt: true, skip_special_tokens: true,
      callback_function: () => { firstTokenMs ??= performance.now() - start; },
      token_callback_function: () => { tokens++; self.postMessage({ id, phase: 'generating', tokens }); } });
    const output = await generator(prompt, { max_new_tokens: 128, do_sample: false, return_full_text: false, streamer });
    const text = (output[0] as { generated_text: string }).generated_text;
    self.postMessage({ id, phase: 'complete', text, version, device, tokens, initializedMs,
      firstTokenMs, milliseconds: performance.now() - start });
  } catch {
    self.postMessage({ id, phase: 'error', error: 'Local Qwen unavailable. Deterministic help remains available.' });
  }
};
