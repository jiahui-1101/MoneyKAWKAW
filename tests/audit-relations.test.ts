import { expect, it } from 'vitest';
import { seed } from '../src/services/seed';
import { validateStore } from '../src/services/director';
it('rejects duplicate task/claim links and mismatched claimant ownership', () => {
  const duplicate = structuredClone(seed),
    task = duplicate.assignments.find((t) => t.expenseId === 'exp-2')!;
  duplicate.assignments.push({ ...structuredClone(task), id: 'duplicate-task' });
  expect(() => validateStore(duplicate)).toThrow('linked');
  const foreign = structuredClone(seed);
  foreign.expenses.find((e) => e.id === 'exp-2')!.review!.claimantId = 'member-ryan';
  expect(() => validateStore(foreign)).toThrow('claimant');
});
it('rejects contradictory linked purchase stages and duplicate access records', () => {
  const state = structuredClone(seed);
  state.assignments.find((t) => t.expenseId === 'exp-2')!.purchasing!.status = 'Not Started';
  expect(() => validateStore(state)).toThrow('status');
  const membership = structuredClone(seed);
  membership.directory!.memberships.push(structuredClone(membership.directory!.memberships[0]));
  expect(() => validateStore(membership)).toThrow('membership');
  const grants = structuredClone(seed);
  grants.treasury!.grants.push({ ...grants.treasury!.grants[0] });
  expect(() => validateStore(grants)).toThrow('grant');
});
it('rejects zero claims without receipt metadata while retaining valid legacy records', () => {
  expect(() => validateStore(seed)).not.toThrow();
  const zero = structuredClone(seed);
  zero.expenses[0].amount = 0;
  zero.payments = zero.payments.filter((p) => p.expenseId !== zero.expenses[0].id);
  zero.treasury!.receipts = zero.treasury!.receipts.filter(
    (r) => r.expenseId !== zero.expenses[0].id,
  );
  expect(() => validateStore(zero)).toThrow();
});
