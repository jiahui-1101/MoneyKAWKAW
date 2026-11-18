import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { BudgetInsights } from '../src/components/charts/Insights';
import { seed } from '../src/services/seed';
import type { FinancialSummary } from '../src/domain/models';

const activity = { ...seed.activities[0], budget: 1000000 };
const store = { ...seed, activities: [activity], expenses: [], payments: [],
  financialSummaries: [{
    activityId: activity.id, departmentId: activity.departments[0].id,
    budget: 200000, paid: 11000, liability: 0, pending: 0, unclaimed: 0,
  }] as FinancialSummary[] };

it('explains restricted individual claim counts when authoritative expenditure exists', () => {
  const html = renderToStaticMarkup(createElement(BudgetInsights, { store, activityIds: [activity.id] }));
  expect(html).toContain('Individual claim records are restricted here');
  expect(html).not.toContain('class="viz-pipeline"');
  expect(html).toContain('Paid RM');
});
