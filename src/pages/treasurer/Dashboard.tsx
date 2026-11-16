import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, FolderKanban, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { summarize } from '../../domain/budget';
import { BudgetComparison } from '../../components/Finance';
import { ChartCard } from '../../components/charts/Charts';
import { BudgetInsights, tones } from '../../components/charts/Insights';
import { Pipeline } from '../../components/charts/Trends';
import { MetricCards } from '../../components/MetricCards';
import { PageHeader, Panel, TextLink, useFormat } from '../../components/ui';
import {
  ClaimDistribution,
  FinancialAlerts,
  SpendingChart,
  TreasuryLifecycle,
} from '../../components/treasurer/FinancialCharts';

export function TreasuryDashboard() {
  const { data } = useTreasury();
  const { money, time } = useFormat();
  if (!data) return null;
  const s = summarize(data);
  const unpaid = data.expenses.filter(
    (e) => e.state === 'Approved' && !data.payments.some((p) => p.expenseId === e.id),
  );
  const counts = [
    {
      label: 'Pending claims',
      value: data.expenses.filter((e) => e.state === 'Pending review').length,
      to: '/treasurer/claims?status=Pending%20review',
    },
    {
      label: 'Under review',
      value: data.expenses.filter((e) => e.state === 'In review').length,
      to: '/treasurer/claims?status=In%20review',
    },
    {
      label: 'Approved claims',
      value: data.expenses.filter((e) => e.state === 'Approved').length,
      to: '/treasurer/claims?status=Approved',
    },
    { label: 'Pending reimbursements', value: unpaid.length, to: '/treasurer/reimbursements' },
    { label: 'Recorded reimbursements', value: data.payments.length, to: '/treasurer/history' },
  ];
  const visibleCounts = data.financialSummaries
    ? ['Pending', 'Under Review', 'Approved', 'Rejected', 'Payment Pending', 'Paid', 'Received'].map((status) => ({
      label: status === 'Paid' ? 'Paid · awaiting confirmation' : status,
      value: data.expenses.filter((e) => e.lifecycle === status).length,
      to: `/treasurer/claims?status=${encodeURIComponent(status)}`,
    })) : counts;
  return (
    <div className="stack dashboard">
      <PageHeader
        eyebrow="TREASURER WORKSPACE"
        title="Every decision, in balance."
        description="A considered view of club finances, from the first claim to the final record."
      >
        <Link className="btn primary" to="/treasurer/claims">
          Review claims <ArrowUpRight size={15} />
        </Link>
      </PageHeader>
      <div className="overview-toolbar">
        <span className="section-label">Your financial overview</span>
        <span className="period-tag">
          {data.activities.length} authorized activities · all dates
        </span>
      </div>
      <MetricCards
        items={[
          {
            label: 'Total activity budget',
            value: money(s.budget, true),
            icon: Wallet,
            note: `${money(s.allocated, true)} allocated to departments`,
          },
          {
            label: 'Recorded expenses',
            value: money(s.recorded, true),
            icon: CircleDollarSign,
            note: demoMode ? 'Pending + approved claims' : 'Approved liability + paid expenditure',
            tone: 'violet',
          },
          {
            label: 'Remaining budget',
            value: money(s.remaining, true),
            icon: ArrowDownLeft,
            note: 'Overall budget less recorded',
            tone: 'green',
          },
          {
            label: 'Total activities',
            value: String(data.activities.length).padStart(2, '0'),
            icon: FolderKanban,
            note: 'Within your assigned oversight',
            tone: 'gold',
          },
        ]}
      />
      <div className="treasury-counts">
        {visibleCounts.map((c) => (
          <Link key={c.label} to={c.to}>
            <span>{c.label}</span>
            <strong>{c.value.toString().padStart(2, '0')}</strong>
            {c.to === '/treasurer/history' && (
              <small>
                {data.payments.filter((p) => !p.manual?.receivedConfirmedAt).length} awaiting member
              </small>
            )}
            <ArrowUpRight size={14} />
          </Link>
        ))}
      </div>
      <BudgetInsights store={data} activityIds={data.activities.map((a) => a.id)} />
      <div className="viz-grid">
        <ChartCard wide title="Reimbursement flow" hint="Approved claims moving to payment and member confirmation">
          <Pipeline
            stages={[
              { label: 'Approved · unpaid', count: unpaid.length, tone: tones.pending },
              { label: 'Paid · awaiting member', count: data.payments.filter((p) => !p.manual?.receivedConfirmedAt).length, tone: tones.committed },
              { label: 'Member confirmed', count: data.payments.filter((p) => p.manual?.receivedConfirmedAt).length, tone: tones.paid },
            ]}
          />
        </ChartCard>
      </div>
      <TreasuryLifecycle data={data} />
      {!!data.notifications?.length && <Panel title="Financial notifications" subtitle="Persisted business events · no email or push delivery implied">
        <div className="member-content stack">{data.notifications.map((n) => <div key={n.id}>
          <TextLink to={n.to}>{n.title}</TextLink><p>{n.detail}</p><small>{time(n.at)}</small>
        </div>)}</div>
      </Panel>}
      <div className="chart-grid">
        <BudgetComparison activities={data.activities} store={data} root="/treasurer" />
        <ClaimDistribution data={data} />
      </div>
      <div className="treasury-two-col">
        <SpendingChart data={data} />
        <SpendingChart data={data} departments />
      </div>
      <FinancialAlerts data={data} />
      <Panel
        title="Recent financial activity"
        subtitle="Shared records with an accountable actor and time"
        action={<TextLink to="/treasurer/history">Payment history</TextLink>}
      >
        <div className="timeline">
          {data.events.slice(0, 6).map((e) => (
            <div className="timeline-item" key={e.id}>
              <span className="timeline-icon">
                <Wallet size={15} />
              </span>
              <div>
                <Link to={`/treasurer/activities/${e.activityId}`}>{e.action}</Link>
                <p>
                  {e.actor} · {data.activities.find((a) => a.id === e.activityId)?.name}
                </p>
                <details>
                  <summary>View event details</summary>
                  <p className="audit-detail">{e.detail}</p>
                </details>
              </div>
              <time dateTime={e.at}>{time(e.at)}</time>
            </div>
          ))}
        </div>
      </Panel>
      <p className="data-note">
        Recording a reimbursement does not verify an external transfer. Member
        confirmation remains separate.
      </p>
    </div>
  );
}
import { demoMode } from '../../services/supabase/client';
