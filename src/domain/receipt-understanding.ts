import { parseReceiptText, type OcrSuggestion } from '../services/receipt-ocr';
export const receiptLabels = ['ITEM_DESCRIPTION', 'MERCHANT', 'RECEIPT_DATE', 'SUBTOTAL', 'TAX', 'DISCOUNT', 'GRAND_TOTAL', 'PAYMENT_INFORMATION', 'OTHER'] as const;
export type SemanticLabel = typeof receiptLabels[number];
export interface LinePrediction { text: string; label: SemanticLabel; score: number }
export interface Understanding {
  status: 'ready' | 'unavailable';
  model: string;
  milliseconds: number;
  predictions: LinePrediction[];
  message: string;
}
export function validPredictions(value: unknown, rows: string[]): LinePrediction[] {
  if (!Array.isArray(value) || value.length !== rows.length) throw new Error('Invalid model output.');
  return value.map((p, i) => {
    if (!p || typeof p !== 'object' || !receiptLabels.includes(p.label) || typeof p.score !== 'number' ||
      !Number.isFinite(p.score) || p.score < 0 || p.score > 1) throw new Error('Invalid semantic prediction.');
    return { text: rows[i], label: p.label, score: p.score };
  });
}
// Suggestions preserve deterministic amounts. No eligibility, inclusion or financial decision is inferred.
export function hybridReceipt(baseline: OcrSuggestion, predictions: LinePrediction[]): OcrSuggestion {
  const lines = [...baseline.lines];
  for (const [index, p] of predictions.entries()) {
    if (p.label !== 'ITEM_DESCRIPTION' || p.score < .85) continue;
    if (parseReceiptText(p.text).lines.length) continue;
    const next = predictions[index + 1];
    if (!next || !/^(?:RM\s*|MYR\s*)?\d[\d,]*\.\d{2}$/.test(next.text.trim())) continue;
    const parsed = parseReceiptText(`${p.text} ${next.text}`);
    if (parsed.lines.length === 1 && !lines.some(l => l.id === `semantic-${index}`))
      lines.push({ ...parsed.lines[0], id: `semantic-${index}` });
  }
  return { ...baseline, lines: lines.slice(0, 100) };
}
