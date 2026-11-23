import { ArrowUpRight, Banknote, CircleDollarSign, Clock3, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { summarize } from '../../domain/budget';
import { ChartCard } from '../../components/charts/Charts';
import { tones } from '../../components/charts/Insights';
import { KpiTiles } from '../../components/charts/Interactive';
import { CountBars } from '../../components/charts/Graphs';
import { ActivityBudgetCard, BudgetCard, ClaimsCard, MonthlyCard, WaitingCard } from '../../components/charts/Views';
import { PageHeader, useFormat } from '../../components/ui';
import { FinancialAlerts } from '../../components/treasurer/FinancialCharts';

export function TreasuryDashboard() {
  const { data } = useTreasury();
  const { money } = useFormat();
  if (!data) return null;
  const s = summarize(data);
  const unpaid = data.expenses.filter((e) => e.state === 'Approved' && !data.payments.some((p) => p.expenseId === e.id));
  const awaiting = data.payments.filter((p) => !p.manual?.receivedConfirmedAt).length;
  const toReview = data.expenses.filter((e) => (e.lifecycle ? ['Pending', 'Under Review'].includes(e.lifecycle) : ['Pending review', 'In review'].includes(e.state))).length;
  return (
    <div className="stack dashboard">
      <PageHeader eyebrow="TREASURER" title="Overview">
        <Link className="btn primary" to="/treasurer/claims">Review claims <ArrowUpRight size={15} /></Link>
      </PageHeader>
      <KpiTiles items={[
        { label: 'Total budget', value: money(s.budget, true), icon: Wallet, tone: 'var(--ink)' },
        { label: 'Claims to review', value: String(toReview), icon: Clock3, tone: 'var(--ai-orange)', to: '/treasurer/claims' },
        { label: 'Approved, not paid', value: String(unpaid.length), icon: Banknote, tone: 'var(--ai-magenta)', to: '/treasurer/reimbursements' },
        { label: 'Paid out', value: money(s.paid, true), icon: CircleDollarSign, tone: 'var(--ai-green)', to: '/treasurer/history' },
      ]} />
      <div className="dash-grid-3">
        <BudgetCard store={data} />
        <WaitingCard store={data} href={(id) => `/treasurer/claims/${id}`} />
        <ClaimsCard store={data} />
      </div>
      <ActivityBudgetCard store={data} />
      <div className="dash-grid-2">
        <MonthlyCard store={data} />
        <ChartCard title="Reimbursements">
          <CountBars rows={[
            { label: 'Approved, not paid', count: unpaid.length, tone: tones.pending },
            { label: 'Paid, not confirmed', count: awaiting, tone: tones.committed },
            { label: 'Confirmed', count: data.payments.length - awaiting, tone: tones.paid },
          ]} />
        </ChartCard>
      </div>
      <FinancialAlerts data={data} />
    </div>
  );
}
