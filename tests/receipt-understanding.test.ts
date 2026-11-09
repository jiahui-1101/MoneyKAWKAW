import { afterEach, describe, expect, it, vi } from 'vitest';
import { hybridReceipt, validPredictions, type LinePrediction } from '../src/domain/receipt-understanding';
import { parseReceiptText } from '../src/services/receipt-ocr';
import { understandReceipt } from '../src/services/receipt-understanding';
const p = (text: string, score = .99): LinePrediction => ({ text, label: 'ITEM_DESCRIPTION', score });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('receipt semantics preserves financial authority', () => {
  it('only joins an adjacent deterministic amount and preserves original text/total', () => {
    const raw = 'Club Supplies\nCable\n110.00\nPersonal snacks 15.00\nTOTAL 125.00';
    const original = parseReceiptText(raw);
    const result = hybridReceipt(original, [p('Cable'), { text: '110.00', label: 'OTHER', score: .99 }]);
    expect(result.total).toBe(12500); expect(result.rawText).toBe(raw);
    expect(result.lines.find(l => l.description === 'Cable')?.amount).toBe(11000);
    expect(result.lines.find(l => l.description === 'Personal snacks')?.amount).toBe(1500);
    expect(original.lines).toHaveLength(1);
  });
  it('cannot invent amounts, infer exclusions, or use uncertain predictions', () => {
    const original = parseReceiptText('Snack\nTOTAL 10.00');
    expect(hybridReceipt(original, [p('Snack'), p('TOTAL 10.00')])).toEqual(original);
    expect(hybridReceipt(original, [p('Cable', .4), p('110.00')])).toEqual(original);
  });
  it('rejects invalid labels, lengths and uncalibrated numeric output', () => {
    expect(() => validPredictions([{ label: 'APPROVE', score: .99 }], ['Cable'])).toThrow();
    expect(() => validPredictions([{ label: 'OTHER', score: NaN }], ['Cable'])).toThrow();
    expect(() => validPredictions([], ['Cable'])).toThrow();
  });
  it('does not start a model for disabled or empty OCR', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1' } });
    vi.stubEnv('VITE_RECEIPT_MODEL', 'off');
    const result = await understandReceipt('Cable 10.00', new AbortController().signal);
    expect(result.status).toBe('unavailable'); expect(result.predictions).toEqual([]);
  });
  it('cancellation rejects instead of returning late suggestions', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1' } });
    vi.stubEnv('VITE_RECEIPT_MODEL', 'on');
    let terminated = false;
    vi.stubGlobal('Worker', class extends EventTarget {
      postMessage() {
        // A response queued before cancellation must not populate the draft afterward.
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: { id: 1, predictions: [p('Cable')] } })));
      }
      terminate() { terminated = true; }
    });
    const controller = new AbortController();
    const result = understandReceipt('Cable 10.00', controller.signal);
    controller.abort();
    await expect(result).rejects.toThrow('cancelled'); expect(terminated).toBe(true);
  });
});
