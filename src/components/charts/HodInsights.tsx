import type { Assignment, ClubUser } from '../../domain/models';
import { useFormat } from '../ui';
import { ChartCard, Donut, Gauge, Legend, StackedBars } from './Charts';
import { tones } from './Insights';
import { Pipeline } from './Trends';

interface DepartmentBudget {
  budget: number;
  planned: number;
  paid: number;
  pending: number;
  committed: number;
  available: number;
}

/** HOD department view: budget split, task progress funnel and per-member workload. */
export function HodInsights({ summary, tasks, users }: { summary: DepartmentBudget; tasks: Assignment[]; users: ClubUser[] }) {
  const { money } = useFormat();
  const compact = (n: number) => money(n, true);
  const live = tasks.filter((t) => t.purchasing?.status !== 'Cancelled');
  const count = (...s: string[]) => live.filter((t) => s.includes(t.purchasing!.status)).length;
  const byMember = new Map<string, Assignment[]>();
  for (const t of live) {
    const key = t.purchasing!.assigneeId ?? '';
    byMember.set(key, [...(byMember.get(key) ?? []), t]);
  }
  const done = (t: Assignment) => ['Purchased', 'Claim Submitted', 'Completed'].includes(t.purchasing!.status);
  const rows = [...byMember.entries()].map(([id, list]) => ({
    label: `${users.find((u) => u.id === id)?.name ?? 'Unassigned'} · ${list.length} task${list.length === 1 ? '' : 's'}`,
    total: list.reduce((s, t) => s + t.budget, 0),
    parts: [
      { label: 'Purchased', value: list.filter(done).reduce((s, t) => s + t.budget, 0), tone: tones.paid },
      { label: 'Open', value: list.filter((t) => !done(t)).reduce((s, t) => s + t.budget, 0), tone: tones.committed },
    ],
  }));
  return (
    <div className="viz-grid">
      <ChartCard title="Department budget used" hint="Planned purchases against your allocation">
        <Gauge value={summary.budget ? (summary.planned / summary.budget) * 100 : 0} label={`${compact(summary.planned)} planned of ${compact(summary.budget)}`} />
      </ChartCard>
      <ChartCard title="Allocation split" hint="Your department allocation by stage">
        <Donut
          centre={compact(summary.budget)}
          caption="allocation"
          format={compact}
          slices={[
            { label: 'Paid', value: summary.paid, tone: tones.paid },
            { label: 'Pending review', value: summary.pending, tone: tones.pending },
            { label: 'Committed', value: summary.committed, tone: tones.committed },
            { label: 'Available', value: Math.max(0, summary.available), tone: tones.available },
          ]}
        />
      </ChartCard>
      <ChartCard title="Task progress" hint="Purchasing tasks at each stage">
        <Pipeline
          stages={[
            { label: 'Not started', count: count('Not Started'), tone: 'var(--line-strong)' },
            { label: 'In progress', count: count('In Progress'), tone: tones.review },
            { label: 'Purchased', count: count('Purchased'), tone: tones.committed },
            { label: 'Claimed', count: count('Claim Submitted', 'Completed'), tone: tones.paid },
          ]}
        />
      </ChartCard>
      <ChartCard wide title="Team workload" hint="Task budget per member; bar = purchased vs still open">
        <Legend items={[{ label: 'Purchased', tone: tones.paid }, { label: 'Open', tone: tones.committed }]} />
        <StackedBars rows={rows} format={compact} empty="No purchasing tasks yet." />
      </ChartCard>
    </div>
  );
}
