import { expect, it } from 'vitest';
import { parseReceiptText } from '../src/services/receipt-ocr';
import {
  parseQuantity,
  quantityAmount,
  receiptTotal,
  validateClaimReceipt,
} from '../src/domain/receipt';
import { receiptEditService } from '../src/services/member-receipt-edits';
import { draftService } from '../src/services/member-drafts';
import { capturedDraft, setupMember } from './member-fixture';
setupMember();
it('parses actual OCR text conservatively with quantity, discount, tax and total kept separate', () => {
  const source =
    'Demo Supplies\n2026-11-05\n2 x HDMI Cable 47.50 95.00\nPersonal snacks 15.00\nDiscount -5.00\nSST 6.00\nSUBTOTAL 110.00\nTOTAL 111.00\nCash 120.00\nChange 9.00';
  const result = parseReceiptText(source);
  expect(result).toMatchObject({
    rawText: source,
    merchant: 'Demo Supplies',
    purchaseDate: '2026-11-05',
    total: 11100,
  });
  expect(result.lines).toHaveLength(4);
  expect(result.lines[0]).toMatchObject({
    description: 'HDMI Cable',
    amount: 9500,
    quantityMilli: 2000,
    unitPrice: 4750,
  });
  expect(result.lines[2]).toMatchObject({ amount: 500, kind: 'discount' });
  expect(parseReceiptText('Unclear scan\nDate: 05/11/26\nTOTAL ?').total).toBeUndefined();
  expect(parseReceiptText('Unclear scan\nDate: 05/11/26').purchaseDate).toBe('');
});
it('rounds fractional quantities in minor units without floating point drift', () => {
  expect(quantityAmount(199, parseQuantity('1.5'))).toBe(299);
  expect(quantityAmount(1, parseQuantity('0.5'))).toBe(1);
  for (const q of ['0', '-1', '1.1234', '1001', 'NaN']) expect(() => parseQuantity(q)).toThrow();
});
it('retains source, edit history and exclusion before/after values; enforces gross reconciliation', async () => {
  let draft = await capturedDraft();
  const original = structuredClone(draft.receipt!);
  await expect(
    draftService.baseline(draft.id, draft.updatedAt, {
      merchant: 'Overwrite',
      purchaseDate: '2026-11-05',
      originalTotal: 1,
      lines: [],
      method: 'manual',
      rawText: '',
    }),
  ).rejects.toThrow('overwritten');
  await expect(
    receiptEditService.line(
      draft.id,
      draft.updatedAt,
      'cable',
      { id: 'cable', description: 'Cable', amount: 9500 },
      false,
      '',
    ),
  ).rejects.toThrow('Explain');
  await receiptEditService.line(
    draft.id,
    draft.updatedAt,
    'cable',
    { id: 'cable', description: 'HDMI cable', amount: 9500 },
    false,
    'Corrected printed price',
  );
  draft = await draftService.load(draft.id);
  expect(() => validateClaimReceipt(draft.receipt!)).toThrow();
  await receiptEditService.add(
    draft.id,
    draft.updatedAt,
    { id: 'ignored', description: 'Personal snack', amount: 1500 },
    'Missed on initial manual entry',
  );
  draft = await draftService.load(draft.id);
  const added = draft.receipt!.addedLines![0].id;
  await receiptEditService.line(
    draft.id,
    draft.updatedAt,
    added,
    { id: added, description: 'Personal snack', amount: 1500 },
    true,
    'Personal item excluded',
  );
  draft = await draftService.load(draft.id);
  expect(validateClaimReceipt(draft.receipt!)).toBe(9500);
  expect(receiptTotal(draft.receipt!, false)).toBe(11000);
  expect(draft.receipt!.originalUrl).toBe(original.originalUrl);
  expect(draft.receipt!.originalLines).toEqual(original.originalLines);
  expect(draft.receipt!.extraction).toEqual(original.extraction);
  expect(draft.receipt!.edits).toHaveLength(3);
  expect(draft.receipt!.edits[2]).toMatchObject({
    beforeExcluded: false,
    excluded: true,
    actor: 'Ava Chen',
    reason: 'Personal item excluded',
  });
});
