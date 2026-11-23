import { summarize } from '../../domain/budget';
import type { Store } from '../../domain/models';
import { useFormat } from '../ui';
import { ChartCard } from './Charts';
import { BarList, FlowGraph, Heatmap, LineChart, type FlowLink, type FlowNode } from './Graphs';
import { claimStages, tones } from './Insights';
import { InteractiveDonut, palette } from './Interactive';
import { Pipeline } from './Trends';

const stage = [
  { key: 'paid', label: 'Paid', tone: tones.paid },
  { key: 'pending', label: 'Pending', tone: tones.pending },
  { key: 'committed', label: 'Committed', tone: tones.committed },
] as const;

/** Monthly claim amounts (all months on record) plus running total. Declined claims excluded. */
export function monthly(store: Store) {
  const by = new Map<string, number>();
  for (const e of store.expenses) if (e.date && e.state !== 'Declined') by.set(e.date.slice(0, 7), (by.get(e.date.slice(0, 7)) ?? 0) + e.amount);
  const keys = [...by.keys()].sort();
  let run = 0;
  return {
    labels: keys.map((k) => new Date(`${k}-01T00:00:00`).toLocaleString('en-MY', { month: 'short' })),
    values: keys.map((k) => by.get(k)!),
    running: keys.map((k) => (run += by.get(k)!)),
  };
}

/** Budget → activity → stage flow, all derived from summarize(). */
export function BudgetFlow({ store }: { store: Store }) {
  const { money } = useFormat();
  const s = summarize(store);
  const nodes: FlowNode[] = [{ id: 'root', label: 'Budget', value: s.budget, col: 0, tone: 'var(--dark)' }];
  const links: FlowLink[] = [];
  const totals = { paid: 0, pending: 0, committed: 0, available: 0 };
  store.activities.forEach((a, i) => {
    const x = summarize(store, a.id);
    nodes.push({ id: a.id, label: a.name, value: a.budget, col: 1, tone: palette[i % palette.length] });
    links.push({ from: 'root', to: a.id, value: a.budget });
    for (const k of stage) { links.push({ from: a.id, to: k.key, value: x[k.key] }); totals[k.key] += x[k.key]; }
    const avail = Math.max(0, a.budget - x.paid - x.pending - x.committed);
    links.push({ from: a.id, to: 'available', value: avail });
    totals.available += avail;
  });
  for (const k of stage) nodes.push({ id: k.key, label: k.label, value: totals[k.key], col: 2, tone: k.tone });
  nodes.push({ id: 'available', label: 'Available', value: totals.available, col: 2, tone: tones.available });
  return <FlowGraph nodes={nodes.filter((n) => n.value > 0)} links={links} format={(n) => money(n, true)} />;
}

export function SpendTrend({ store }: { store: Store }) {
  const { money } = useFormat();
  const m = monthly(store);
  const budget = summarize(store).budget;
  return (
    <LineChart labels={m.labels} format={(n) => money(n, true)} label="Cumulative spend against budget"
      series={[
        { label: 'Cumulative', tone: 'var(--ai-purple)', values: m.running },
        { label: 'Monthly', tone: 'var(--ai-orange)', values: m.values },
        { label: 'Budget', tone: 'var(--ai-magenta)', values: m.labels.map(() => budget), dashed: true },
      ]} />
  );
}

export function ActivityBars({ store, selected, onSelect }: { store: Store; selected?: string | null; onSelect?: (id: string | null) => void }) {
  const { money } = useFormat();
  const rows = store.activities.map((a) => {
    const x = summarize(store, a.id);
    return { id: a.id, label: a.name, limit: a.budget, parts: stage.map((k) => ({ label: k.label, value: x[k.key], tone: k.tone })) };
  });
  return <BarList rows={rows} selected={selected} onSelect={onSelect} format={(n) => money(n, true)} empty="No activities match." />;
}

export function DepartmentBars({ store, activityId }: { store: Store; activityId?: string | null }) {
  const { money } = useFormat();
  const rows = store.activities.filter((a) => !activityId || a.id === activityId).flatMap((a) =>
    a.departments.map((d) => {
      const x = summarize(store, a.id, d.id);
      return { id: d.id, label: activityId ? d.name : `${d.name} · ${a.name}`, limit: d.allocation, parts: stage.map((k) => ({ label: k.label, value: x[k.key], tone: k.tone })) };
    }),
  );
  return <BarList rows={rows} format={(n) => money(n, true)} empty="No departments yet." />;
}

/** Activity × department utilisation (recorded + pending + committed vs allocation). */
export function UtilisationHeat({ store, onPick }: { store: Store; onPick?: (activityId: string) => void }) {
  const { money } = useFormat();
  const cols = [...new Set(store.activities.flatMap((a) => a.departments.map((d) => d.name)))];
  const cells = store.activities.map((a) => cols.map((c) => {
    const d = a.departments.find((x) => x.name === c);
    if (!d || !d.allocation) return null;
    const x = summarize(store, a.id, d.id);
    const used = x.paid + x.pending + x.committed;
    return { value: (used / d.allocation) * 100, label: `${a.name} / ${d.name}: ${money(used)} of ${money(d.allocation)}` };
  }));
  return <Heatmap rows={store.activities.map((a) => a.name)} cols={cols} cells={cells} onSelect={(r) => onPick?.(store.activities[r].id)} />;
}

export function BudgetDonut({ store }: { store: Store }) {
  const { money } = useFormat();
  const s = summarize(store);
  const compact = (n: number) => money(n, true);
  return (
    <InteractiveDonut centre={compact(s.budget)} caption="budget" format={compact} slices={[
      { label: 'Paid', value: s.paid, tone: tones.paid },
      { label: 'Pending', value: s.pending, tone: tones.pending },
      { label: 'Committed', value: s.committed, tone: tones.committed },
      { label: 'Available', value: Math.max(0, s.available), tone: tones.available },
    ]} />
  );
}

export function ClaimStatus({ store }: { store: Store }) {
  const stages = claimStages(store.expenses, store.payments).filter((s) => s.count);
  return (
    <InteractiveDonut centre={String(store.expenses.length)} caption="claims" format={(n) => String(n)}
      slices={stages.map((s) => ({ label: s.label, value: s.count, tone: s.tone }))} />
  );
}

/** Ready-made card set for the claims tab. */
export function ClaimCards({ store }: { store: Store }) {
  return (
    <div className="dash-grid-2">
      <ChartCard title="Claims by status"><ClaimStatus store={store} /></ChartCard>
      <ChartCard title="Claim pipeline"><Pipeline stages={claimStages(store.expenses, store.payments)} /></ChartCard>
    </div>
  );
}
