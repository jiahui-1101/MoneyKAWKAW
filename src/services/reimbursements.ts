import { departmentToday } from '../domain/hod';
import type { ProofFile } from '../domain/treasury';
import { sharedRepository } from './director';
import {
  projectTreasury,
  scopedClaim,
  treasuryEvent,
  treasuryRead,
  treasuryWrite,
} from './treasury-core';
import { validateProof } from './payment-proof';

function payable(store: Awaited<ReturnType<typeof treasuryRead>>['store'], id: string) {
  const claim = scopedClaim(store, id);
  if (claim.state !== 'Approved' || store.payments.some((p) => p.expenseId === id))
    throw new Error(
      'Only an approved, unpaid claim can be reimbursed. A payment may already be recorded.',
    );
  const payout = store.treasury!.payouts.find(
    (p) => p.expenseId === id && p.ownerId === claim.review?.claimantId,
  );
  if (!payout)
    throw new Error(
      'No selected payout snapshot exists. Ask the member to select saved payment instructions for this claim.',
    );
  return { claim, payout };
}
export interface PaymentInput {
  amount: number;
  date: string;
  reference: string;
  proof: ProofFile;
  confirmed: boolean;
}
export const reimbursementService = {
  resolveIssue(paymentId: string, note: string) {
    return treasuryWrite(async () => {
      const { store, actor } = await treasuryRead();
      const payment = store.payments.find((p) => p.id === paymentId);
      if (!payment) throw new Error('Payment unavailable.');
      scopedClaim(store, payment.expenseId);
      const issue = payment.manual?.discrepancy;
      if (!issue || payment.manual?.receivedConfirmedAt)
        throw new Error('Only an open member-reported payment issue can receive a resolution.');
      const value = note.trim();
      if (value.length < 3 || value.length > 1000)
        throw new Error('Describe the resolution in 3–1,000 characters.');
      if (issue.resolutions?.at(-1)?.note === value)
        throw new Error('This resolution is already recorded.');
      (issue.resolutions ??= []).push({
        note: value,
        at: new Date().toISOString(),
        by: actor.userId,
      });
      treasuryEvent(
        store,
        payment.expenseId,
        'Payment discrepancy resolution recorded',
        `${payment.expenseId} · ${value}. Member receipt acknowledgment remains separate.`,
      );
      await sharedRepository.save(store);
      return projectTreasury(store);
    });
  },
  async destination(id: string) {
    const { store } = await treasuryRead();
    return structuredClone(payable(store, id).payout);
  },
  record(id: string, input: PaymentInput) {
    return treasuryWrite(async () => {
      const { store, actor } = await treasuryRead();
      const { claim, payout } = payable(store, id);
      if (!input.confirmed)
        throw new Error('Confirm that you made the transfer externally before recording it.');
      if (input.amount !== claim.amount || !Number.isSafeInteger(input.amount) || input.amount <= 0)
        throw new Error('This demo requires one full reimbursement matching the approved amount.');
      const today = departmentToday(store.settings.timezone);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
        Number.isNaN(Date.parse(input.date)) ||
        new Date(input.date).toISOString().slice(0, 10) !== input.date ||
        input.date > today ||
        input.date < claim.date
      )
        throw new Error('Choose a valid payment date between claim submission and today.');
      if (!input.reference.trim() || input.reference.length > 120)
        throw new Error('Enter a transaction reference of up to 120 characters.');
      validateProof(input.proof);
      const masked = {
        kind: payout.kind,
        label: payout.label,
        masked: payout.masked,
        holder: payout.holder,
        institution: payout.institution,
      };
      const at = new Date().toISOString();
      store.payments.push({
        id: crypto.randomUUID(),
        expenseId: id,
        amount: input.amount,
        date: input.date,
        manual: {
          reference: input.reference.trim(),
          recordedAt: at,
          recordedBy: actor.userId,
          payout: masked,
          proof: structuredClone(input.proof),
          externalVerified: false,
        },
      });
      treasuryEvent(
        store,
        id,
        'Manual reimbursement recorded',
        `${input.amount / 100} · ${input.date} · ${input.reference.trim()} · proof attached. External transfer unverified; member confirmation pending.`,
      );
      await sharedRepository.save(store);
      return projectTreasury(store);
    });
  },
  async proof(paymentId: string) {
    const { store } = await treasuryRead();
    const payment = store.payments.find((p) => p.id === paymentId);
    if (!payment) throw new Error('Payment unavailable.');
    scopedClaim(store, payment.expenseId);
    if (!payment.manual?.proof) throw new Error('This legacy sample record has no payment proof.');
    return structuredClone(payment.manual.proof);
  },
};
