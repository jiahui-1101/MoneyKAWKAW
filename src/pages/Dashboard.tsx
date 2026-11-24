import { CircleDollarSign, Clock3, Plus, Wallet, PiggyBank } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { activityStatuses } from '../domain/models';
import { summarize } from '../domain/budget';
import { ActionQueue } from '../components/ActionQueue';
import { PageHeader, useFormat } from '../components/ui';
import { KpiTiles } from '../components/charts/Interactive';
import { ActivityBudgetCard, BudgetCard, ClaimsCard, MonthlyCard } from '../components/charts/Views';

export function Dashboard({ budgets = false }: { budgets?: boolean }) {
  const { store } = useWorkspace();
  const { money } = useFormat();
  const [status, setStatus] = useState('');
  if (!store) return null;
  const activities = store.activities.filter((a) => !status || a.status === status);
  const ids = new Set(activities.map((a) => a.id));
  const scoped = {
    ...store,
    activities,
    expenses: store.expenses.filter((e) => ids.has(e.activityId)),
    events: store.events.filter((e) => ids.has(e.activityId)),
  };
  const s = summarize(scoped);
  const over = scoped.activities.flatMap((a) => [
    ...(summarize(scoped, a.id).recorded > a.budget ? [{ id: a.id, name: a.name, over: summarize(scoped, a.id).recorded - a.budget }] : []),
    ...a.departments.flatMap((d) => {
      const used = summarize(scoped, a.id, d.id).recorded;
      return used > d.allocation ? [{ id: a.id, name: `${a.name} · ${d.name}`, over: used - d.allocation }] : [];
    }),
  ]);
  const queue = [
    ...over.map((o) => ({ title: `${o.name} is over budget`, detail: `Claims are ${money(o.over)} more than its budget. Raise the budget or talk to the HOD.`, to: `/director/activities/${o.id}/budget`, action: 'Check budget' })),
    ...scoped.activities.filter((a) => !a.departments.length && a.status !== 'Completed').map((a) => ({ title: `${a.name} has no departments`, detail: 'Add departments and give each one part of the budget.', to: `/director/activities/${a.id}/departments`, action: 'Add departments' })),
  ];
  const pctOf = (n: number) => (s.budget ? (n / s.budget) * 100 : 0);
  return (
    <div className="stack dashboard">
      <PageHeader eyebrow="DIRECTOR" title={budgets ? 'Budgets' : 'Overview'}>
        <label className="sr-only" htmlFor="overview-status">Filter by status</label>
        <select id="overview-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {activityStatuses.map((x) => <option key={x}>{x}</option>)}
        </select>
        <Link className="btn primary" to="/director/activities/new"><Plus size={16} />New activity</Link>
      </PageHeader>
      <KpiTiles items={[
        { label: 'Total budget', value: money(s.budget, true), icon: Wallet, tone: 'var(--ink)' },
        { label: 'Paid', value: money(s.paid, true), icon: CircleDollarSign, tone: 'var(--ai-green)', meter: pctOf(s.paid) },
        { label: 'Waiting for review', value: money(s.pending, true), icon: Clock3, tone: 'var(--ai-orange)', meter: pctOf(s.pending) },
        { label: 'Free to spend', value: money(s.available, true), icon: PiggyBank, tone: s.available < 0 ? 'var(--ai-magenta)' : 'var(--ai-blue)', meter: pctOf(Math.max(0, s.available)) },
      ]} />
      <ActionQueue items={queue} clear="Every activity is within its budget." />
      <div className="dash-grid-3">
        <BudgetCard store={scoped} />
        <MonthlyCard store={scoped} />
        <ClaimsCard store={scoped} />
      </div>
      <ActivityBudgetCard store={scoped} />
    </div>
  );
}
