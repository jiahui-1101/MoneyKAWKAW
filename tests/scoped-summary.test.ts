import { expect, it } from 'vitest';
import { summarize } from '../src/domain/budget';
import { seed } from '../src/services/seed';
import type { FinancialSummary } from '../src/domain/models';

it('keeps canonical balances within the visible Director activity filter', () => {
  const [first, second] = seed.activities;
  const financialSummaries = [
    { activityId: first.id, departmentId: 'one', budget: 200000, paid: 11000, pending: 0, unclaimed: 0, liability: 0 },
    { activityId: second.id, departmentId: 'two', budget: 300000, paid: 50000, pending: 4000, unclaimed: 8000, liability: 1000 },
  ] as FinancialSummary[];
  const filtered = { ...seed, activities: [first], financialSummaries };
  expect(summarize(filtered)).toMatchObject({
    budget: first.budget, allocated: 200000, paid: 11000, pending: 0,
    committed: 0, available: first.budget - 11000,
  });
  expect(summarize({ ...filtered, activities: [] })).toMatchObject({
    budget: 0, allocated: 0, paid: 0, pending: 0, committed: 0, available: 0,
  });
});
