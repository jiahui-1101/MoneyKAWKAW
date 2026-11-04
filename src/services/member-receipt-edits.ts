import type { ReceiptLine } from '../domain/treasury';
import { receiptLines, reviewedTotal, validateLine } from '../domain/receipt';
import { requireRole } from '../domain/session';
import { memberCommand } from './member-core';
import { draftRecord } from './member-drafts';
function reasonText(reason: string) {
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500)
    throw new Error('Explain this correction or exclusion in 3–500 characters.');
  return reason.trim();
}
function cleanLine(line: ReceiptLine, id: string): ReceiptLine {
  const clean = {
    id,
    description: line.description.trim(),
    amount: line.amount,
    kind: line.kind ?? 'item',
    quantityMilli: line.quantityMilli,
    unitPrice: line.unitPrice,
  };
  validateLine(clean);
  return clean;
}
export const receiptEditService = {
  line(
    id: string,
    expected: string,
    lineId: string,
    input: ReceiptLine,
    excluded: boolean,
    reason: string,
  ) {
    return memberCommand((store) => {
      const { draft } = draftRecord(store, id, expected),
        receipt = draft.receipt;
      if (!receipt?.extraction)
        throw new Error('Capture the initial extraction or manual source values first.');
      const current = receiptLines(receipt).find((l) => l.original.id === lineId);
      if (!current) throw new Error('Receipt line unavailable.');
      const after = cleanLine(input, lineId),
        why = reasonText(reason);
      if (JSON.stringify(after) === JSON.stringify(current.final) && excluded === current.excluded)
        throw new Error('Change a value or its inclusion before saving.');
      const at = new Date().toISOString();
      receipt.edits.push({
        lineId,
        before: structuredClone(current.final),
        after,
        excluded: !!excluded,
        beforeExcluded: current.excluded,
        reason: why,
        actor: requireRole('Member').name,
        at,
      });
      draft.updatedAt = at;
    });
  },
  add(id: string, expected: string, input: ReceiptLine, reason: string) {
    return memberCommand((store) => {
      const { draft } = draftRecord(store, id, expected),
        receipt = draft.receipt;
      if (!receipt?.extraction || receiptLines(receipt).length >= 100)
        throw new Error('Add missing items only after baseline capture, up to 100 lines.');
      const lineId = crypto.randomUUID(),
        after = cleanLine(input, lineId),
        why = reasonText(reason),
        at = new Date().toISOString();
      const before: ReceiptLine = {
        id: lineId,
        description: 'Not extracted · manually added line',
        amount: 0,
      };
      (receipt.addedLines ??= []).push(before);
      receipt.edits.push({
        lineId,
        before,
        after,
        excluded: false,
        beforeExcluded: false,
        reason: why,
        actor: requireRole('Member').name,
        at,
      });
      draft.updatedAt = at;
    });
  },
  total(id: string, expected: string, amount: number, reason: string) {
    return memberCommand((store) => {
      const { draft } = draftRecord(store, id, expected),
        receipt = draft.receipt;
      if (
        !receipt?.extraction ||
        !Number.isSafeInteger(amount) ||
        amount < 0 ||
        amount > 100_000_000_000
      )
        throw new Error('Enter a valid reviewed receipt total.');
      const why = reasonText(reason),
        before = reviewedTotal(receipt),
        at = new Date().toISOString();
      if (before === amount) throw new Error('The reviewed receipt total is unchanged.');
      (receipt.totalEdits ??= []).push({
        before,
        after: amount,
        reason: why,
        actor: requireRole('Member').name,
        at,
      });
      draft.updatedAt = at;
    });
  },
};
