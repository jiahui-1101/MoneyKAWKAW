import type { ReceiptEvidence, ReceiptLine, ProofFile } from '../domain/treasury';
import { requireRole } from '../domain/session';
import { validateLine } from '../domain/receipt';
import { memberCommand, memberData, memberRead, ownedTask } from './member-core';
import type { Store } from '../domain/models';
import { validateProof } from './payment-proof';
import { departmentToday } from '../domain/hod';
export function draftRecord(store: Store, id: string, expected?: string) {
  const draft = store.member?.drafts.find(
    (d) => d.id === id && d.ownerId === requireRole('Member').userId,
  );
  if (!draft) throw new Error('Claim draft unavailable for your profile.');
  const task = ownedTask(store, draft.taskId);
  if (task.expenseId || !['Purchased', 'Completed'].includes(task.purchasing!.status))
    throw new Error('Only a purchased, unclaimed task can be prepared for reimbursement.');
  if (expected && draft.updatedAt !== expected)
    throw new Error('Draft changed. Reload the latest version before saving.');
  return { draft, task };
}
export function validateReceiptFile(file: ProofFile) {
  validateProof(file);
  if (!['image/png', 'image/jpeg'].includes(file.mime))
    throw new Error('Receipts support PNG or JPEG images up to 1 MB.');
}
export const draftService = {
  async load(id: string) {
    const { store } = await memberRead();
    return structuredClone(draftRecord(store, id).draft);
  },
  begin(taskId: string) {
    return memberCommand((store) => {
      const task = ownedTask(store, taskId),
        userId = requireRole('Member').userId,
        data = memberData(store);
      if (task.expenseId || !['Purchased', 'Completed'].includes(task.purchasing!.status))
        throw new Error('Mark your purchase as Purchased before starting a claim.');
      const existing = data.drafts.find((d) => d.taskId === taskId && d.ownerId === userId);
      if (existing) return existing.id;
      const id = crypto.randomUUID();
      data.drafts.push({
        id,
        ownerId: userId,
        taskId,
        accountId: data.accounts.find((a) => a.ownerId === userId && a.isDefault)?.id ?? '',
        justification: '',
        updatedAt: new Date().toISOString(),
      });
      return id;
    });
  },
  receipt(id: string, expected: string, file: ProofFile | null) {
    return memberCommand((store) => {
      const { draft } = draftRecord(store, id, expected);
      if (file) validateReceiptFile(file);
      draft.receipt = file
        ? {
            id: crypto.randomUUID(),
            expenseId: '',
            originalUrl: file.dataUrl,
            file: { name: file.name, mime: file.mime, size: file.size },
            merchant: '',
            originalLines: [],
            edits: [],
            submittedAt: new Date().toISOString(),
          }
        : undefined;
      draft.updatedAt = new Date().toISOString();
    });
  },
  baseline(
    id: string,
    expected: string,
    input: {
      merchant: string;
      purchaseDate: string;
      originalTotal: number;
      lines: ReceiptLine[];
      method: 'tesseract' | 'manual';
      rawText: string;
    },
  ) {
    return memberCommand((store) => {
      const { draft } = draftRecord(store, id, expected),
        receipt = draft.receipt;
      if (!receipt || receipt.extraction)
        throw new Error(
          'Upload an image first. An existing extraction cannot be overwritten; retain edits or replace the unsubmitted source.',
        );
      if (
        !input.merchant.trim() ||
        input.merchant.length > 150 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input.purchaseDate) ||
        Number.isNaN(Date.parse(input.purchaseDate)) ||
        new Date(input.purchaseDate).toISOString().slice(0, 10) !== input.purchaseDate ||
        input.purchaseDate > departmentToday(store.settings.timezone)
      )
        throw new Error('Enter the merchant and a valid purchase date from the receipt.');
      if (
        !['tesseract', 'manual'].includes(input.method) ||
        input.rawText.length > 50000 ||
        !Number.isSafeInteger(input.originalTotal) ||
        input.originalTotal < 0 ||
        input.originalTotal > 100_000_000_000 ||
        !input.lines.length ||
        input.lines.length > 100 ||
        new Set(input.lines.map((l) => l.id)).size !== input.lines.length
      )
        throw new Error('Add a valid receipt total and between 1–100 source lines.');
      input.lines.forEach(validateLine);
      const at = new Date().toISOString();
      Object.assign(receipt, {
        merchant: input.merchant.trim(),
        purchaseDate: input.purchaseDate,
        originalTotal: input.originalTotal,
        originalLines: structuredClone(input.lines),
        extraction: { method: input.method, rawText: input.rawText, at },
      } satisfies Partial<ReceiptEvidence>);
      draft.updatedAt = at;
    });
  },
  preferences(id: string, expected: string, accountId: string, justification: string) {
    return memberCommand((store) => {
      const { draft } = draftRecord(store, id, expected);
      if (
        !memberData(store).accounts.some((a) => a.id === accountId && a.ownerId === draft.ownerId)
      )
        throw new Error('Select one of your saved payment accounts.');
      if (justification.length > 1000)
        throw new Error('Keep the justification within 1,000 characters.');
      draft.accountId = accountId;
      draft.justification = justification.trim();
      draft.updatedAt = new Date().toISOString();
    });
  },
};
