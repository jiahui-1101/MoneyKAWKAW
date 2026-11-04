import type { Store } from '../domain/models';
import { validateRiskRules } from '../domain/risk';
import { validateProof } from './payment-proof';
import { validateReceiptEvidence } from './receipt-validation';
export function validateTreasury(store: Store) {
  const t = store.treasury;
  if (!t) return;
  if (![t.grants, t.receipts, t.payouts].every(Array.isArray))
    throw new Error('Invalid treasury records.');
  validateRiskRules(t.rules);
  if (
    new Set(t.receipts.map((r) => r.expenseId)).size !== t.receipts.length ||
    new Set(t.payouts.map((p) => p.expenseId)).size !== t.payouts.length
  )
    throw new Error('Duplicate claim evidence or payout snapshot.');
  for (const g of t.grants)
    if (g.userId !== 'treasurer-nora' || !store.activities.some((a) => a.id === g.activityId))
      throw new Error('Invalid Treasurer grant.');
  for (const receipt of t.receipts) {
    const claim = store.expenses.find((e) => e.id === receipt.expenseId);
    if(!claim)throw new Error('Invalid receipt claim reference.');
    validateReceiptEvidence(receipt,claim.amount);
  }
  for (const payout of t.payouts)
    if (
      !store.expenses.some(
        (e) => e.id === payout.expenseId && e.review?.claimantId === payout.ownerId,
      ) ||
      !payout.masked ||
      !payout.identifier
    )
      throw new Error('Invalid selected payout snapshot.');
  for (const p of store.payments)
    if (p.manual) {
      validateProof(p.manual.proof);
      if (
        p.manual.externalVerified !== false ||
        !p.manual.reference ||
        !p.manual.recordedBy ||
        Number.isNaN(Date.parse(p.manual.recordedAt))
      )
        throw new Error('Invalid manual payment history.');
    }
}
