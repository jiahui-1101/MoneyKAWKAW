import { expect, it } from 'vitest';
import { seed } from '../src/services/seed';
import { analyzeClaim } from '../src/domain/risk';
import { summarize } from '../src/domain/budget';
it.each([
  [10000, 'Low'],
  [10999, 'Low'],
  [11000, 'Medium'],
  [12499, 'Medium'],
  [12500, 'High'],
  [13750, 'High'],
])('uses exact configured variance boundaries for %s minor units', (amount, band) => {
  const store = structuredClone(seed),
    claim = store.expenses.find((e) => e.id === 'exp-5')!;
  store.assignments.find((t) => t.expenseId === claim.id)!.budget = 10000;
  claim.amount = Number(amount);
  expect(analyzeClaim(store, claim, 'Audit Treasurer').band).toBe(band);
});
it('reserves concurrent pending claims once and reclassifies approval/payment without changing availability', () => {
  const store = structuredClone(seed),
    claim = store.expenses.find((e) => e.id === 'exp-5')!;
  claim.amount = 11000;
  store.expenses.push({ ...structuredClone(claim), id: 'other-pending', amount: 30000 });
  const pending = summarize(store, claim.activityId, claim.departmentId);
  expect(pending).toMatchObject({ recorded: 41000, pending: 41000, available: 459000 });
  claim.state = 'Approved';
  const approved = summarize(store, claim.activityId, claim.departmentId);
  expect(approved.available).toBe(pending.available);
  expect(approved.committed).toBe(11000);
  store.payments.push({
    id: 'audit-payment',
    expenseId: claim.id,
    amount: 11000,
    date: '2026-11-05',
  });
  const paid = summarize(store, claim.activityId, claim.departmentId);
  expect(paid.available).toBe(pending.available);
  expect(paid.paid).toBe(11000);
  expect(paid.recorded).toBe(41000);
});
