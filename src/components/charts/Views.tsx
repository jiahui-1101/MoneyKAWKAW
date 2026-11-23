import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { summarize } from '../../domain/budget';
import type { Store } from '../../domain/models';
import { useFormat } from '../ui';
import { ChartCard, Legend } from './Charts';
import { BarList, ColumnChart, CountBars, Waterfall } from './Graphs';
import { claimStages, tones } from './Insights';

const stage = [
  { key: 'paid', label: 'Paid', tone: tones.paid },
  { key: 'pending', label: 'Pending', tone: tones.pending },
  { key: 'committed', label: 'Committed', tone: tones.committed },
] as const;

/** Claim amounts per month for the last six months on record. Declined claims excluded. */
function monthly(store: Store) {
  const by = new Map<string, number>();
  for (const e of store.expenses) if (e.date && e.state !== 'Declined') by.set(e.date.slice(0, 7), (by.get(e.date.slice(0, 7)) ?? 0) + e.amount);
  return [...by.keys()].sort().slice(-6).map((k) => ({
    label: new Date(`${k}-01T00:00:00`).toLocaleString('en-MY', { month: 'short' }),
    value: by.get(k)!,
  }));
}

export function BudgetCard({ store }: { store: Store }) {
  const s = summarize(store);
  const short = (n: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: store.settings.currency, currencyDisplay: 'narrowSymbol', notation: 'compact', maximumFractionDigits: 1 }).format(n / 100);
  return (
    <ChartCard title="Where the budget went">
      <Waterfall total={s.budget} totalLabel="Budget" endLabel="Left" format={short} steps={[
        { label: 'Paid', value: s.paid, tone: tones.paid },
        { label: 'Pending', value: s.pending, tone: tones.pending },
        { label: 'Committed', value: s.committed, tone: tones.committed },
      ]} />
    </ChartCard>
  );
}

export function MonthlyCard({ store }: { store: Store }) {
  const { money } = useFormat();
  return (
    <ChartCard title="Claims per month">
      <ColumnChart columns={monthly(store)} format={(n) => money(n, true)} empty="No dated claims yet." />
    </ChartCard>
  );
}

export function ClaimsCard({ store }: { store: Store }) {
  return (
    <ChartCard title="Claims by status">
      <CountBars rows={claimStages(store.expenses, store.payments).filter((s) => s.label !== 'Payment Pending' || s.count)} />
    </ChartCard>
  );
}

/** Used vs budget per activity; click an activity to see its departments. */
export function ActivityBudgetCard({ store }: { store: Store }) {
  const { money } = useFormat();
  const [picked, setPicked] = useState<string | null>(null);
  const activity = store.activities.find((a) => a.id === picked);
  const parts = (x: ReturnType<typeof summarize>) => stage.map((k) => ({ label: k.label, value: x[k.key], tone: k.tone }));
  const rows = activity
    ? activity.departments.map((d) => ({ id: d.id, label: d.name, limit: d.allocation, parts: parts(summarize(store, activity.id, d.id)) }))
    : store.activities.map((a) => ({ id: a.id, label: a.name, limit: a.budget, parts: parts(summarize(store, a.id)) }));
  return (
    <ChartCard wide title={activity ? activity.name : 'Spent vs budget'}>
      <div className="row between wrap">
        <Legend items={[...stage, { label: 'Budget', tone: 'var(--line)' }]} />
        {activity && <button type="button" className="btn" onClick={() => setPicked(null)}><ArrowLeft size={14} /> All activities</button>}
      </div>
      <BarList rows={rows} format={(n) => money(n, true)} onSelect={activity ? undefined : setPicked} empty="No departments yet." />
      {!activity && rows.length > 0 && <small className="viz-hint">Click an activity to see its departments</small>}
    </ChartCard>
  );
}

const DAY = 86_400_000;

/** Claims still awaiting a decision, grouped by how long they have waited since submission. */
export function WaitingCard({ store, href }: { store: Store; href: (id: string) => string }) {
  const { money } = useFormat();
  const now = Date.now();
  const waiting = store.expenses
    .filter((e) => (e.lifecycle ? ['Pending', 'Under Review'].includes(e.lifecycle) : ['Pending review', 'In review'].includes(e.state)))
    .map((e) => ({ e, days: Math.max(0, Math.floor((now - new Date(e.review?.submittedAt ?? e.date).getTime()) / DAY)) }))
    .sort((a, b) => b.days - a.days);
  const count = (lo: number, hi: number) => waiting.filter((w) => w.days >= lo && w.days < hi).length;
  return (
    <ChartCard title="Waiting for review">
      <CountBars rows={[
        { label: 'Under 3 days', count: count(0, 3), tone: tones.paid },
        { label: '3–7 days', count: count(3, 8), tone: tones.pending },
        { label: 'Over 7 days', count: count(8, Infinity), tone: tones.declined },
      ]} />
      {waiting.length ? (
        <ul className="ix-oldest">
          {waiting.slice(0, 3).map(({ e, days }) => (
            <li key={e.id}><Link to={href(e.id)}>{e.description}</Link><span>{money(e.amount, true)} · {days}d</span></li>
          ))}
        </ul>
      ) : <p className="viz-empty">Nothing waiting.</p>}
    </ChartCard>
  );
}
