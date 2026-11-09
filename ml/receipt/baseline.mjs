// Bundle the actual application parser: no reimplementation or weakened comparator.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
await build({ stdin: { contents: "export {parseReceiptText} from './src/services/receipt-ocr'; export {hybridReceipt} from './src/domain/receipt-understanding';", resolveDir: process.cwd() },
  outfile: '.local/phase05/parser.mjs', bundle: true, platform: 'node', format: 'esm',
  define: { 'import.meta.env': JSON.stringify({ MODE: 'test' }) }, external: ['tesseract.js'] });
const { parseReceiptText, hybridReceipt } = await import(pathToFileURL(resolve('.local/phase05/parser.mjs')).href);
let dataPath = '.local/phase05/prepared.json';
try { await readFile('.local/phase05/evaluation-documents.json'); dataPath = '.local/phase05/evaluation-documents.json'; } catch { /* Initial baseline. */ }
const docs = JSON.parse(await readFile(dataPath, 'utf8')).filter(d => d.split === 'test');
let predictions = {};
try { predictions = JSON.parse(await readFile('.local/phase05/test-predictions.json', 'utf8')); } catch { /* Baseline before model evaluation. */ }
const results = docs.map(doc => {
  const rawText = doc.rows.map(r => r.text).join('\n');
  const output = parseReceiptText(rawText);
  const lines = new Map(output.lines.map(l => [Number(l.id.slice(4)), l]));
  const labels = doc.rows.map((r, i) => {
    const line = lines.get(i);
    if (line) return line.kind === 'discount' ? 'DISCOUNT' : line.kind === 'tax' ? 'TAX' : 'ITEM_DESCRIPTION';
    if (output.total !== undefined && /^(?:grand\s+)?total(?:\s*(?:RM|MYR))?\s+.*\d\.\d{2}$/i.test(r.text)) return 'GRAND_TOTAL';
    if (output.purchaseDate && r.text.includes(output.purchaseDate)) return 'RECEIPT_DATE';
    if (output.merchant && r.text === output.merchant) return 'MERCHANT';
    return 'OTHER';
  });
  const model = predictions[doc.id];
  const hybrid = model ? hybridReceipt(output, model) : output;
  const hybridLabels = [...labels];
  for (const line of hybrid.lines) {
    if (line.id.startsWith('semantic-')) hybridLabels[Number(line.id.slice(9))] = 'ITEM_DESCRIPTION';
  }
  return { id: doc.id, source: doc.source, gold: doc.rows.map(r => r.label), baseline: labels, hybrid: hybridLabels,
    baselineItemCount: output.lines.filter(l => l.kind === 'item').length,
    hybridItemCount: hybrid.lines.filter(l => l.kind === 'item').length,
    output, hybridOutput: hybrid };
});
await writeFile('.local/phase05/baseline.json', JSON.stringify(results));
console.log(`Exact app parser evaluated on ${results.length} held-out receipts.`);
