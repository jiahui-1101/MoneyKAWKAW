import { describe, expect, it } from 'vitest';
import type { Store } from '../src/domain/models';
import { claimsAreRestricted } from '../src/components/charts/Views';

const summary = (pending: number, paid = 0, unclaimed = 0) => ({
  activityId: 'activity', departmentId: 'department', budget: 10_000, planned: 0,
  unclaimed, pending, liability: 0, paid, available: 10_000 - pending - paid - unclaimed,
  remaining: 10_000 - pending - paid,
});

const store = (financialSummaries?: Store['financialSummaries'], expenses: Store['expenses'] = []): Store => ({
  version: 1,
  activities: [{ id: 'activity', name: 'Workshop', description: 'Sample', type: 'Workshop',
    status: 'Active', startDate: '2026-11-01', endDate: '2026-11-30', budget: 10_000, departments: [] }],
  expenses, payments: [], assignments: [], events: [],
  settings: { currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', warningPercent: 80 },
  financialSummaries,
});

describe('Director claim charts', () => {
  it('explains when aggregate balances exist but claim rows are restricted', () => {
    expect(claimsAreRestricted(store([summary(1_100, 5_000)]))).toBe(true);
  });

  it('keeps empty status counts when there are no claim balances', () => {
    expect(claimsAreRestricted(store([summary(0)]))).toBe(false);
  });

  it('does not classify task reservations as hidden claim records', () => {
    expect(claimsAreRestricted(store([summary(0, 0, 800)]))).toBe(false);
  });
});
