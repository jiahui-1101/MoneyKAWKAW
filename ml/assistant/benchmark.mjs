import { env, pipeline } from '@huggingface/transformers';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const candidate = process.argv[2] ?? 'qwen3';
const dtype = process.argv[3] ?? 'q4f16';
const manifest = JSON.parse(readFileSync(`.local/phase07/${candidate}-${dtype}-manifest.json`));
env.allowRemoteModels = false;
env.localModelPath = `${resolve('public/models')}/`;
env.backends.onnx.wasm.numThreads = 4;
const start = performance.now();
const generator = await pipeline('text-generation', manifest.directory, { dtype, device: 'cpu' });
const initializedMs = performance.now() - start;
const queries = [
  ['en', 'Explain briefly: claim amount MYR110, estimate MYR80, difference MYR30, variance37.50%, rule risk High. Human Treasurer decides.'],
  ['ms', 'Terangkan secara ringkas dalam Bahasa Melayu: tuntutan Pending belum diluluskan. Tiada bayaran direkodkan.'],
  ['zh', '请用中文简短解释：Approved仅表示审批通过，Paid表示已记录付款，Received表示成员确认收到。付款记录不等于银行核实。'],
];
const results = [];
for (const [language, question] of queries) {
  const prompt = generator.tokenizer.apply_chat_template([
    { role: 'system', content: 'You explain supplied financial facts. Do not invent facts. Reply briefly.' },
    { role: 'user', content: question },
  ], { tokenize: false, add_generation_prompt: true, enable_thinking: false });
  const started = performance.now();
  const output = await generator(prompt, { max_new_tokens: 80, do_sample: false, return_full_text: false });
  const text = output[0].generated_text;
  const tokens = generator.tokenizer.encode(text).length;
  results.push({ language, text, tokens, milliseconds: performance.now() - started });
}
const report = { model: manifest.version, directory: manifest.directory, dtype, initializedMs,
  rssBytes: process.memoryUsage().rss, results };
writeFileSync(`.local/phase07/${candidate}-${dtype}-cpu.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
await generator.dispose();
