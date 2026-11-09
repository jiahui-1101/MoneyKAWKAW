import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, FolderKanban, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { summarize } from '../../domain/budget';
import { BudgetComparison } from '../../components/Finance';
import { MetricCards } from '../../components/MetricCards';
import { PageHeader, Panel, TextLink, useFormat } from '../../components/ui';
import {
  ClaimDistribution,
  FinancialAlerts,
  SpendingChart,
  TreasuryLifecycle,
} from '../../components/treasurer/FinancialCharts';
import { demoMode } from '../../services/supabase/client';

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
  if (!demoMode) return <div className="stack dashboard">
    <PageHeader eyebrow="TREASURER WORKSPACE" title="Budgets and purchasing plans."
      description="Read-only budget oversight and submitted claim evidence from the connected club database. Decisions and payments begin in Phase 04." />
    <div className="overview-toolbar"><span className="section-label">Authorized budget overview</span>
      <span className="period-tag">{data.activities.length} activities</span></div>
    <MetricCards items={[
      { label: 'Total activity budget', value: money(s.budget, true), icon: Wallet, note: 'Director-managed budget ceilings' },
      { label: 'Department allocations', value: money(s.allocated, true), icon: FolderKanban, note: 'Allocated by activity departments' },
      { label: 'Planned purchasing commitments', value: money(s.committed, true), icon: CircleDollarSign, note: 'Active task estimates · cancelled tasks excluded' },
      { label: 'Uncommitted budget', value: money(s.available, true), icon: ArrowDownLeft, note: 'Budget less planned commitments' },
    ]} />
    <Panel title="Activity budgets and task commitments" subtitle="Purchasing estimates are not actual expenses">
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Activity budgets and purchasing commitments">
        <table><thead><tr><th>ACTIVITY</th><th>OVERALL BUDGET</th><th>ALLOCATED</th><th>PLANNED TASKS</th><th>UNCOMMITTED</th></tr></thead>
          <tbody>{data.activities.map((activity) => {
            const budget = summarize(data, activity.id);
            const tasks = data.assignments.filter((task) => task.activityId === activity.id).length;
            return <tr key={activity.id}><td><Link className="activity-name" to={`/treasurer/activities/${activity.id}`}>{activity.name}</Link><small className="cell-sub">{tasks} purchasing tasks</small></td>
              <td className="money">{money(budget.budget)}</td><td className="money">{money(budget.allocated)}</td><td className="money">{money(budget.committed)}</td><td className="money">{money(budget.available)}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </Panel>
    <p className="data-note">Submitted claims are available in the read-only claim queue. Pending requests remain separate from planned commitments; decisions and payment recording begin in Phase 04.</p>
  </div>;
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
            note: 'Pending + approved claims',
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
        {counts.map((c) => (
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
      <TreasuryLifecycle data={data} />
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
        Local demo · recording a reimbursement does not verify an external transfer. Member
        confirmation remains separate.
      </p>
    </div>
  );
}
