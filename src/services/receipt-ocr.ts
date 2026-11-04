import { parseMoney } from '../domain/budget';
import { parseQuantity, quantityAmount } from '../domain/receipt';
import type { ProofFile, ReceiptLine } from '../domain/treasury';
import { readProof } from './payment-proof';
import { validateReceiptFile } from './member-drafts';
export interface OcrSuggestion {
  rawText: string;
  merchant: string;
  purchaseDate: string;
  total?: number;
  lines: ReceiptLine[];
}
export function parseReceiptText(rawText: string): OcrSuggestion {
  const rows = rawText
    .slice(0, 50000)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lines: ReceiptLine[] = [];
  let total: number | undefined;
  for (const [index, row] of rows.entries()) {
    const match = row.match(/^(.+?)\s+(?:RM\s*|MYR\s*)?(-?\d[\d,]*\.\d{2})\s*$/i);
    if (!match) continue;
    let amount: number;
    try {
      amount = parseMoney(match[2].replace(/[-,]/g, ''));
    } catch {
      continue;
    }
    const description = match[1].trim();
    if (/^(?:grand\s+)?total(?:\s*(?:RM|MYR))?\s*$/i.test(description)) {
      total = amount;
      continue;
    }
    if (/^(subtotal|cash|change|balance|amount paid|card|visa|mastercard)\b/i.test(description))
      continue;
    const kind =
      match[2].startsWith('-') || /^discount\b/i.test(description)
        ? 'discount'
        : /^(tax|sst|service charge|rounding)\b/i.test(description)
          ? 'tax'
          : 'item';
    const line: ReceiptLine = {
      id: `ocr-${index}`,
      description: description.slice(0, 180),
      amount,
      kind,
    };
    const quantity = description.match(/^(\d+(?:\.\d{1,3})?)\s*[x×]\s+(.+?)\s+(\d+\.\d{2})$/i);
    if (quantity) {
      try {
        const q = parseQuantity(quantity[1]),
          unit = parseMoney(quantity[3]);
        if (quantityAmount(unit, q) === amount)
          Object.assign(line, { description: quantity[2], quantityMilli: q, unitPrice: unit });
      } catch {
        /* Keep the unmodified OCR description when quantity is uncertain. */
      }
    }
    if (lines.length < 100) lines.push(line);
  }
  const date = rawText.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0] ?? '';
  const purchaseDate =
    date && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
      ? date
      : '';
  const merchant =
    rows
      .find((r) => !/^\d|receipt|invoice|date|total/i.test(r) && !r.match(/\d+\.\d{2}$/))
      ?.slice(0, 150) ?? '';
  return { rawText: rawText.slice(0, 50000), merchant, purchaseDate, total, lines };
}
export async function readReceiptImage(file: File) {
  const proof = await readProof(file);
  validateReceiptFile(proof);
  const bitmap = await createImageBitmap(file);
  const tooLarge = bitmap.width * bitmap.height > 20_000_000;
  bitmap.close();
  if (tooLarge)
    throw new Error('Choose an image under 20 megapixels. The original is never resized silently.');
  return proof;
}
export async function recognizeReceipt(
  file: ProofFile,
  onProgress: (status: string, progress: number) => void,
  signal: AbortSignal,
): Promise<OcrSuggestion> {
  validateReceiptFile(file);
  const { createWorker } = await import('tesseract.js');
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let rejectOperation: (error: Error) => void = () => {};
  const gate = new Promise<never>((_, reject) => {
    rejectOperation = reject;
  });
  const abort = () =>
    rejectOperation(new Error('OCR cancelled. You can continue with manual entry.'));
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(
    () => rejectOperation(new Error('OCR timed out. Retry or enter the receipt manually.')),
    60000,
  );
  const base = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  const initializing = createWorker('eng', 1, {
    workerPath: `${base}ocr/worker.min.js`,
    workerBlobURL: false,
    corePath: `${base}ocr/core`,
    langPath: `${base}ocr/lang`,
    cacheMethod: 'write',
    logger: (m) => onProgress(m.status, m.progress),
    errorHandler: () =>
      rejectOperation(
        new Error('OCR could not read this image. Retry or enter the receipt manually.'),
      ),
  });
  try {
    if (signal.aborted) abort();
    worker = await Promise.race([initializing, gate]);
    await worker.setParameters({ user_defined_dpi: '300' });
    const result = await Promise.race([worker.recognize(file.dataUrl, {}, { text: true }), gate]);
    if (!result.data.text.trim())
      throw new Error('No readable text was found. Enter the receipt manually.');
    return parseReceiptText(result.data.text);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
    if (worker) await worker.terminate();
    else void initializing.then((w) => w.terminate()).catch(() => undefined);
  }
}
