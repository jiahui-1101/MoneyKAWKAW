import { expect, it } from 'vitest';
import { claimStages } from '../src/components/charts/Insights';
import type { Expense, Payment } from '../src/domain/models';

it('keeps approval, payment and member receipt distinct in the dashboard pipeline', () => {
  const lifecycle = ['Pending', 'Under Review', 'Approved', 'Payment Pending', 'Paid', 'Received', 'Rejected'] as const;
  const claims = lifecycle.map((value, i) => ({
    id: String(i), state: 'Approved', lifecycle: value,
  })) as Expense[];
  expect(claimStages(claims).map((stage) => stage.count)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  const legacy = [{ id: 'legacy', state: 'Approved' }] as Expense[];
  const payments = [{ expenseId: 'legacy', manual: { receivedConfirmedAt: '2026-11-18' } }] as Payment[];
  const stages = claimStages(legacy, payments);
  expect(stages.find((stage) => stage.label === 'Approved')?.count).toBe(0);
  expect(stages.find((stage) => stage.label === 'Received')?.count).toBe(1);
});
