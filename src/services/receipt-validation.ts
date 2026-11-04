import type { ReceiptEvidence } from '../domain/treasury';
import { receiptTotal, validateClaimReceipt, validateLine } from '../domain/receipt';
import { validateProof } from './payment-proof';
export function validateReceiptEvidence(receipt: ReceiptEvidence, claimAmount?: number) {
  if (
    !receipt ||
    !receipt.originalUrl.startsWith('data:image/') ||
    !Array.isArray(receipt.originalLines) ||
    !Array.isArray(receipt.edits)
  )
    throw new Error('Invalid receipt evidence.');
  if (receipt.file) {
    validateProof({ ...receipt.file, dataUrl: receipt.originalUrl });
    if (!['image/png', 'image/jpeg'].includes(receipt.file.mime))
      throw new Error('Receipt must be a PNG or JPEG image.');
  }
  const originals = [...receipt.originalLines, ...(receipt.addedLines ?? [])];
  if (originals.length > 100 || new Set(originals.map((l) => l.id)).size !== originals.length)
    throw new Error('Receipt line identifiers must be unique.');
  originals.forEach(validateLine);
  const current = new Map(originals.map((l) => [l.id, { line: l, excluded: false }]));
  for (const edit of receipt.edits) {
    const before = current.get(edit.lineId);
    validateLine(edit.after);
    if (
      !before ||
      edit.after.id !== edit.lineId ||
      JSON.stringify(before.line) !== JSON.stringify(edit.before) ||
      (edit.beforeExcluded !== undefined && edit.beforeExcluded !== before.excluded) ||
      typeof edit.excluded !== 'boolean' ||
      !edit.reason?.trim() ||
      !edit.actor?.trim() ||
      Number.isNaN(Date.parse(edit.at))
    )
      throw new Error('Receipt correction history is inconsistent.');
    current.set(edit.lineId, { line: edit.after, excluded: edit.excluded });
  }
  if (receipt.extraction) {
    if (
      !['tesseract', 'manual'].includes(receipt.extraction.method) ||
      receipt.extraction.rawText.length > 50000 ||
      !receipt.merchant?.trim() ||
      !Number.isSafeInteger(receipt.originalTotal) ||
      receipt.originalTotal! < 0 ||
      receipt.originalTotal! > 100_000_000_000 ||
      !receipt.purchaseDate
    )
      throw new Error('Invalid original receipt extraction metadata.');
    let total = receipt.originalTotal!;
    for (const e of receipt.totalEdits ?? []) {
      if (
        e.before !== total ||
        !Number.isSafeInteger(e.after) ||
        e.after < 0 ||
        e.after > 100_000_000_000 ||
        !e.reason.trim() ||
        !e.actor ||
        Number.isNaN(Date.parse(e.at))
      )
        throw new Error('Receipt total correction history is inconsistent.');
      total = e.after;
    }
  }
  if (claimAmount !== undefined) {
    if (receiptTotal(receipt) !== claimAmount)
      throw new Error('Receipt total does not reconcile to the submitted claim.');
    if (receipt.extraction) validateClaimReceipt(receipt);
  }
}
