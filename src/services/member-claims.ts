import { summarize } from '../domain/budget';
import { departmentToday } from '../domain/hod';
import { validateClaimReceipt } from '../domain/receipt';
import { requireRole } from '../domain/session';
import { draftRecord, validateReceiptFile } from './member-drafts';
import { memberCommand, memberData, memberEvent, memberRead, ownedClaim } from './member-core';
import type { Store } from '../domain/models';
import type { PaymentAccount } from '../domain/member';
import type { PayoutSnapshot } from '../domain/treasury';
export function destinationSnapshot(account: PaymentAccount, expenseId: string): PayoutSnapshot {
  return {
    revision: crypto.randomUUID(),
    expenseId,
    ownerId: account.ownerId,
    accountId: account.id,
    label: account.label,
    kind: account.kind,
    holder: account.holder,
    institution: account.institution,
    identifier: account.identifier,
    masked: account.masked,
    selectedAt: new Date().toISOString(),
    selectedBy: account.ownerId,
  };
}
function context(store: Store, id: string) {
  const { draft, task } = draftRecord(store, id),
    receipt = draft.receipt;
  if (!receipt?.extraction || !receipt.file)
    throw new Error('Upload a receipt and capture its source items first.');
  const amount = validateClaimReceipt(receipt);
  const departmentExceeded =
    summarize(store, task.activityId, task.departmentId).available + task.budget - amount < 0;
  const activityExceeded = summarize(store, task.activityId).available + task.budget - amount < 0;
  const account = memberData(store).accounts.find(
    (a) => a.id === draft.accountId && a.ownerId === draft.ownerId,
  );
  const variance = amount - task.budget;
  return {
    amount,
    variance,
    variancePercent: (variance / task.budget) * 100,
    departmentExceeded,
    activityExceeded,
    needsJustification: variance > 0 || departmentExceeded || activityExceeded,
    taskUpdatedAt: task.purchasing!.updatedAt,
    accountUpdatedAt: account?.updatedAt ?? '',
    draftUpdatedAt: draft.updatedAt,
    destination: account
      ? {
          id: account.id,
          label: account.label,
          kind: account.kind,
          holder: account.holder,
          institution: account.institution,
          masked: account.masked,
        }
      : undefined,
  };
}
export const memberClaimService = {
  async context(id: string) {
    const { store } = await memberRead();
    return context(store, id);
  },
  submit(id: string, expected: string, taskRevision: string, accountRevision: string) {
    return memberCommand((store) => {
      const { draft, task } = draftRecord(store, id, expected),
        summary = context(store, id),
        receipt = draft.receipt!;
      if (
        summary.taskUpdatedAt !== taskRevision ||
        !summary.accountUpdatedAt ||
        summary.accountUpdatedAt !== accountRevision
      )
        throw new Error(
          'The task or selected account changed. Review the confirmation summary again.',
        );
      if (summary.needsJustification && draft.justification.trim().length < 3)
        throw new Error(
          'Explain this item, department, or activity over-budget request before submitting.',
        );
      if (!receipt.file) throw new Error('Original receipt metadata is missing.');
      validateReceiptFile({ ...receipt.file, dataUrl: receipt.originalUrl });
      if (!receipt.purchaseDate || receipt.purchaseDate > departmentToday(store.settings.timezone))
        throw new Error('Purchase date cannot be in the future.');
      const data = memberData(store),
        account = data.accounts.find(
          (a) => a.id === draft.accountId && a.ownerId === draft.ownerId,
        );
      if (!account) throw new Error('Select one of your saved payment accounts.');
      const claimId = `claim-${crypto.randomUUID()}`,
        at = new Date().toISOString();
      store.expenses.push({
        id: claimId,
        activityId: task.activityId,
        departmentId: task.departmentId,
        description: task.purchasing!.name,
        amount: summary.amount,
        date: departmentToday(store.settings.timezone),
        state: 'Pending review',
        review: {
          claimantId: draft.ownerId,
          submittedAt: at,
          updatedAt: at,
          justification: draft.justification,
        },
      });
      store.treasury!.receipts.push({
        ...structuredClone(receipt),
        expenseId: claimId,
        submittedAt: at,
      });
      store.treasury!.payouts.push(destinationSnapshot(account, claimId));
      task.expenseId = claimId;
      task.purchasing!.status = 'Claim Submitted';
      task.purchasing!.updatedAt = at;
      data.drafts = data.drafts.filter((d) => d.id !== id);
      memberEvent(
        store,
        task,
        'Claim submitted',
        `${claimId} · ${(summary.amount / 100).toFixed(2)} ${store.settings.currency} · original receipt, extraction, modifications, and selected destination retained. Pending Treasurer review.`,
      );
      return claimId;
    });
  },
  async receipt(id: string) {
    const { store } = await memberRead();
    ownedClaim(store, id);
    const receipt = store.treasury!.receipts.find((r) => r.expenseId === id);
    if (!receipt) throw new Error('No receipt was retained for this historical claim.');
    return structuredClone(receipt);
  },
  async destination(id: string) {
    const { store } = await memberRead();
    ownedClaim(store, id);
    const payout = store.treasury!.payouts.find((p) => p.expenseId === id);
    if (!payout) throw new Error('No selected destination was retained for this claim.');
    const { identifier: _identifier, history: _history, ...safe } = payout;
    return safe;
  },
  changeDestination(id: string, accountId: string, reason: string) {
    return memberCommand((store) => {
      const claim = ownedClaim(store, id);
      if (claim.state === 'Declined' || store.payments.some((p) => p.expenseId === id))
        throw new Error('The destination is locked after a decline or recorded payment.');
      if (reason.trim().length < 3 || reason.length > 500)
        throw new Error('Explain the destination change in 3–500 characters.');
      const account = memberData(store).accounts.find(
          (a) => a.id === accountId && a.ownerId === requireRole('Member').userId,
        ),
        index = store.treasury!.payouts.findIndex((p) => p.expenseId === id);
      if (!account || index < 0) throw new Error('Choose an owned saved account for this claim.');
      const before = store.treasury!.payouts[index],
        next = destinationSnapshot(account, id);
      next.history = [
        ...(before.history ?? []),
        {
          accountId: before.accountId,
          masked: before.masked,
          at: new Date().toISOString(),
          actor: requireRole('Member').userId,
          reason: reason.trim(),
        },
      ];
      store.treasury!.payouts[index] = next;
      claim.review!.updatedAt = new Date().toISOString();
      const task = store.assignments.find((t) => t.expenseId === id)!;
      memberEvent(
        store,
        task,
        'Payout destination changed',
        `${id} · ${before.masked} → ${next.masked}. ${reason.trim()}`,
      );
    });
  },
};
