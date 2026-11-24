import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
vi.mock('../src/services/supabase/client', () => ({ demoMode: false }));
import { BudgetInsights } from '../src/components/charts/Insights';
import { ActivityTable, Metrics } from '../src/components/Finance';
import { summarize } from '../src/domain/budget';
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
  expect(html).toContain('Only the Treasurer sees single claims');
  expect(html).not.toContain('class="viz-pipeline"');
  expect(html).toContain('Paid RM');
});

it('shows recorded RM110 and 1.1 percent after payment, with open commitments at zero', () => {
  const table = renderToStaticMarkup(createElement(MemoryRouter, {},
    createElement(ActivityTable, { activities: store.activities, store })));
  expect(table).toContain('CLAIMED');
  expect(table).toContain('1.1%');
  expect(table).toMatch(/RM[^<]*110/);
  const metrics = renderToStaticMarkup(createElement(Metrics, { summary: summarize(store) }));
  expect(metrics).toContain('Claimed');
  expect(metrics).toContain('Paid + approved, not paid yet');
});
