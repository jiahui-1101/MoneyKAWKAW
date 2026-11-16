import { summarize } from '../../domain/budget';
import type { Expense, Store } from '../../domain/models';
import { useFormat } from '../ui';
import { ChartCard, Donut, Gauge, Legend, StackedBars, type Slice } from './Charts';
import { Pipeline, TrendArea } from './Trends';

export const tones = {
  paid: 'var(--green)',
  pending: 'var(--gold)',
  committed: 'var(--accent)',
  available: 'var(--teal)',
  declined: 'var(--danger)',
  review: 'var(--violet)',
};

/** Paid / pending / committed / available split of a derived budget summary. */
export function budgetSlices(store: Store, activityId?: string, departmentId?: string): Slice[] {
  const s = summarize(store, activityId, departmentId);
  return [
    { label: 'Paid', value: s.paid, tone: tones.paid },
    { label: 'Pending review', value: s.pending, tone: tones.pending },
    { label: 'Committed', value: s.committed, tone: tones.committed },
    { label: 'Available', value: Math.max(0, s.available), tone: tones.available },
  ];
}

/** Sums expense amounts by calendar month (YYYY-MM), oldest first, last `months` buckets. */
export function monthlyTrend(expenses: Expense[], months = 6) {
  const byMonth = new Map<string, number>();
  for (const e of expenses) {
    if (!e.date || e.state === 'Declined') continue;
    const key = e.date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + e.amount);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-months)
    .map(([k, value]) => ({ label: new Date(`${k}-01T00:00:00`).toLocaleString('en-MY', { month: 'short' }), value }));
}

/** Counts claims in each review stage. */
export function claimStages(expenses: Expense[]) {
  const count = (state: Expense['state']) => expenses.filter((e) => e.state === state).length;
  return [
    { label: 'Pending', count: count('Pending review'), tone: tones.pending },
    { label: 'In review', count: count('In review'), tone: tones.review },
    { label: 'Approved', count: count('Approved'), tone: tones.paid },
    { label: 'Declined', count: count('Declined'), tone: tones.declined },
  ];
}

const stackKeys = [
  { label: 'Paid', tone: tones.paid },
  { label: 'Pending', tone: tones.pending },
  { label: 'Committed', tone: tones.committed },
];

/** Director/Treasurer overview: utilisation gauge, budget split, per-activity bars, trend and claim pipeline. */
export function BudgetInsights({ store, activityIds }: { store: Store; activityIds: string[] }) {
  const { money } = useFormat();
  const scoped: Store = { ...store, activities: store.activities.filter((a) => activityIds.includes(a.id)) };
  const s = summarize(scoped);
  const expenses = store.expenses.filter((e) => activityIds.includes(e.activityId));
  const rows = scoped.activities.map((a) => {
    const x = summarize(store, a.id);
    return {
      label: a.name,
      total: a.budget,
      parts: [
        { label: 'Paid', value: x.paid, tone: tones.paid },
        { label: 'Pending', value: x.pending, tone: tones.pending },
        { label: 'Committed', value: x.committed, tone: tones.committed },
      ],
    };
  });
  const compact = (n: number) => money(n, true);
  return (
    <div className="viz-grid">
      <ChartCard title="Budget health" hint="Paid, pending and committed against total budget">
        <Gauge value={s.budget ? ((s.paid + s.pending + s.committed) / s.budget) * 100 : 0} label={`${money(s.budget, true)} total budget`} warnAt={store.settings.warningPercent} />
      </ChartCard>
      <ChartCard title="Where the money is" hint="Every ringgit of budget, by stage">
        <Donut slices={budgetSlices(scoped)} centre={compact(s.budget)} caption="budget" format={compact} />
      </ChartCard>
      <ChartCard title="Claim pipeline" hint="Claims at each review stage">
        <Pipeline stages={claimStages(expenses)} />
      </ChartCard>
      <ChartCard wide title="Spending trend" hint="Recorded claim amounts per month">
        <TrendArea points={monthlyTrend(expenses)} format={compact} label="Monthly claim amounts" />
      </ChartCard>
      <ChartCard wide title="Budget by activity" hint="Bar = used; grey track = activity budget">
        <Legend items={stackKeys} />
        <StackedBars rows={rows} format={compact} empty="No activities match these filters." />
      </ChartCard>
    </div>
  );
}
