import { expect, it } from 'vitest';
import { summarize } from '../src/domain/budget';
import { departmentBudget } from '../src/domain/hod';
import type { Store, FinancialSummary } from '../src/domain/models';
const summary: FinancialSummary = { departmentId: 'd', activityId: 'a', budget: 200000,
  planned: 8000, unclaimed: 8000, pending: 0, liability: 0, paid: 0, available: 192000, remaining: 200000 };
const store: Store = { version: 1, activities: [{ id: 'a', name: 'Dinner', description: 'Synthetic', type: 'Small Event',
  status: 'Active', startDate: '2026-11-01', endDate: '2026-12-31', budget: 1000000,
  departments: [{ id: 'd', name: 'Multimedia', description: '', head: '', allocation: 200000 }] }],
  assignments: [], expenses: [], payments: [], events: [], financialSummaries: [summary],
  settings: { currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', warningPercent: 80 } };
it('replaces estimate with pending exposure, then liability, then one paid expense', () => {
  const value = structuredClone(store), f = value.financialSummaries![0];
  expect(summarize(value, 'a', 'd')).toMatchObject({ recorded: 0, pending: 0, committed: 8000, paid: 0, available: 192000 });
  Object.assign(f, { unclaimed: 0, pending: 11000, available: 189000 });
  expect(summarize(value, 'a', 'd')).toMatchObject({ recorded: 0, pending: 11000, committed: 0, paid: 0, available: 189000 });
  Object.assign(f, { planned: 0, pending: 0, liability: 11000 });
  expect(summarize(value, 'a', 'd')).toMatchObject({ recorded: 11000, committed: 11000, paid: 0, available: 189000 });
  Object.assign(f, { liability: 0, paid: 11000 });
  expect(summarize(value, 'a', 'd')).toMatchObject({ recorded: 11000, committed: 0, paid: 11000, available: 189000 });
  expect(summarize(value, 'a').available).toBe(989000);
  const before = summarize(value, 'a', 'd');
  expect(summarize(value, 'a', 'd')).toEqual(before); // Confirmation never adds an expense.
  Object.assign(f, { paid: 0, planned: 8000, unclaimed: 8000, available: 192000 });
  expect(summarize(value, 'a', 'd')).toMatchObject({ recorded: 0, paid: 0, committed: 8000, available: 192000 });
});
it('HOD receives consistent totals without requiring private claims or payment rows', () => {
  const value = structuredClone(store), department = value.activities[0].departments[0];
  Object.assign(value.financialSummaries![0], { planned: 0, unclaimed: 0, paid: 11000, available: 189000, remaining: 189000 });
  const result = departmentBudget({ actor: {userId:'h',name:'HOD',role:'HOD'}, scopes: [{activity:value.activities[0],department}],
    directory:{users:[],memberships:[]}, assignments:[],expenses:[],payments:[],events:[],settings:value.settings,
    financialSummaries:value.financialSummaries }, 'a', 'd');
  expect(result).toMatchObject({ paid: 11000, recorded: 11000, available: 189000 });
});
