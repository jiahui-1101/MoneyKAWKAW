import type { Assignment, Expense, Payment } from '../../domain/models';
import { useFormat } from '../ui';
import { ChartCard, Donut } from './Charts';
import { monthlyTrend, tones } from './Insights';
import { Pipeline, TrendArea } from './Trends';

/** Member view: own claim money by stage, own task progress, and own claim trend. */
export function MemberInsights({ tasks, claims, payments }: { tasks: Assignment[]; claims: Expense[]; payments: Payment[] }) {
  const { money } = useFormat();
  const compact = (n: number) => money(n, true);
  const sum = (list: Expense[]) => list.reduce((s, e) => s + e.amount, 0);
  const paidIds = new Set(payments.map((p) => p.expenseId));
  const count = (...s: string[]) => tasks.filter((t) => s.includes(t.purchasing!.status)).length;
  const total = sum(claims.filter((e) => e.state !== 'Declined'));
  return (
    <div className="viz-grid">
      <ChartCard title="My claims by stage" hint="Where your reimbursement money is">
        <Donut
          centre={compact(total)}
          caption="claimed"
          format={compact}
          slices={[
            { label: 'Awaiting review', value: sum(claims.filter((e) => ['Pending review', 'In review'].includes(e.state))), tone: tones.pending },
            { label: 'Approved · unpaid', value: sum(claims.filter((e) => e.state === 'Approved' && !paidIds.has(e.id))), tone: tones.committed },
            { label: 'Reimbursed', value: payments.reduce((s, p) => s + p.amount, 0), tone: tones.paid },
            { label: 'Declined', value: sum(claims.filter((e) => e.state === 'Declined')), tone: tones.declined },
          ]}
        />
      </ChartCard>
      <ChartCard title="My purchase progress" hint="Your assigned tasks at each stage">
        <Pipeline
          stages={[
            { label: 'To buy', count: count('Not Started', 'In Progress'), tone: tones.review },
            { label: 'Purchased', count: count('Purchased'), tone: tones.committed },
            { label: 'Claimed', count: count('Claim Submitted'), tone: tones.pending },
            { label: 'Done', count: count('Completed'), tone: tones.paid },
          ]}
        />
      </ChartCard>
      <ChartCard title="My claim history" hint="Claim amounts per month">
        <TrendArea points={monthlyTrend(claims)} format={compact} label="My monthly claim amounts" />
      </ChartCard>
    </div>
  );
}
