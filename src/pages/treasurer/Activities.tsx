import { Search, Wallet, CircleDollarSign, ArrowDownLeft, Percent } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { summarize } from '../../domain/budget';
import { MetricCards } from '../../components/MetricCards';
import { ClaimList } from '../../components/treasurer/ClaimList';
import { FinancialAlerts, TreasuryLifecycle } from '../../components/treasurer/FinancialCharts';
import {
  Badge,
  Empty,
  PageHeader,
  Panel,
  Progress,
  TextLink,
  useFormat,
} from '../../components/ui';
import { demoMode } from '../../services/supabase/client';

export function TreasuryActivities() {
  const { data } = useTreasury();
  const { money } = useFormat();
  const [query, setQuery] = useState(''),
    [type, setType] = useState('');
  if (!data) return null;
  const activities = data.activities.filter(
    (a) => a.name.toLowerCase().includes(query.toLowerCase()) && (!type || a.type === type),
  );
  if (!demoMode) return <div className="stack">
    <PageHeader eyebrow="ACTIVITY BUDGETS" title="Activity budgets and purchasing plans."
      description="Read-only summaries from the connected club database. Task estimates are planned commitments, not actual expenses." />
    <Panel title="Authorized activities" subtitle={`${activities.length} visible in your Treasurer scope`}>
      <div className="filters">
        <div className="search-field"><Search size={16} /><input aria-label="Search activities" placeholder="Search activities…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <select className="compact-select" aria-label="Activity type" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All types</option>{[...new Set(data.activities.map((activity) => activity.type))].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      {activities.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Activity budgets and task commitments">
        <table><thead><tr><th>ACTIVITY</th><th>OVERALL BUDGET</th><th>ALLOCATED</th><th>PLANNED TASK COMMITMENTS</th><th>UNCOMMITTED</th></tr></thead>
          <tbody>{activities.map((activity) => {
            const summary = summarize(data, activity.id);
            return <tr key={activity.id}><td><Link className="activity-name" to={`/treasurer/activities/${activity.id}`}>{activity.name}</Link><small className="cell-sub">{activity.type} · {activity.status}</small></td>
              <td className="money">{money(summary.budget)}</td><td className="money">{money(summary.allocated)}</td><td className="money">{money(summary.committed)}</td><td className="money">{money(summary.available)}</td></tr>;
          })}</tbody>
        </table>
      </div> : <Empty title="No matching activities">Try a different activity name or type.</Empty>}
    </Panel>
    <p className="data-note">Claim amounts, reimbursement, and payment proof are unavailable until Phase 03.</p>
  </div>;
  return (
    <div className="stack">
      <PageHeader
        eyebrow="ACTIVITY FINANCES"
        title="The plan. The spending. The balance."
        description="Director-managed budgets across the activities under your oversight."
      />
      <Panel
        title="Authorized activities"
        subtitle={`${data.activities.length} activities · budgets are managed by the Director`}
      >
        <div className="filters">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search activities"
              placeholder="Search activities…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="compact-select"
            aria-label="Activity type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {[...new Set(data.activities.map((a) => a.type))].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        {activities.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Activity financial overview"
          >
            <table>
              <thead>
                <tr>
                  {[
                    'ACTIVITY',
                    'OVERALL BUDGET',
                    'ALLOCATED',
                    'RECORDED',
                    'AVAILABLE',
                    'PENDING',
                    'UTILIZATION',
                    'FINANCIAL STATUS',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => {
                  const s = summarize(data, a.id);
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link className="activity-name" to={`/treasurer/activities/${a.id}`}>
                          {a.name}
                        </Link>
                        <small className="cell-sub">
                          {a.type} · {a.status}
                        </small>
                      </td>
                      <td className="money">{money(s.budget)}</td>
                      <td className="money">{money(s.allocated)}</td>
                      <td className="money">{money(s.recorded)}</td>
                      <td className={`money ${s.available < 0 ? 'danger-text' : ''}`}>
                        {money(s.available)}
                      </td>
                      <td className="money">{money(s.pending)}</td>
                      <td>
                        <div className="utilization-cell">
                          <span>{s.utilization.toFixed(1)}%</span>
                          <Progress value={s.utilization} label={`${a.name} utilization`} />
                        </div>
                      </td>
                      <td>
                        <Badge
                          tone={
                            s.available < 0
                              ? 'danger'
                              : s.utilization >= data.settings.warningPercent
                                ? 'gold'
                                : 'green'
                          }
                        >
                          {s.available < 0
                            ? 'Deficit'
                            : s.utilization >= data.settings.warningPercent
                              ? 'Attention'
                              : 'Within plan'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching activities"
            action={
              <button
                className="btn"
                onClick={() => {
                  setQuery('');
                  setType('');
                }}
              >
                Clear filters
              </button>
            }
          >
            Try another activity name or type.
          </Empty>
        )}
      </Panel>
    </div>
  );
}
export function TreasuryActivityDetail() {
  const { id } = useParams();
  const { data } = useTreasury();
  const { money } = useFormat();
  if (!data) return null;
  const activity = data.activities.find((a) => a.id === id);
  if (!activity)
    return (
      <Empty
        title="Activity access restricted"
        action={
          <Link className="btn" to="/treasurer/activities">
            Back to activities
          </Link>
        }
      >
        This record is unavailable within your Treasurer oversight.
      </Empty>
    );
  const scope = {
    ...data,
    activities: [activity],
    expenses: data.expenses.filter((e) => e.activityId === id),
  };
  const s = summarize(scope);
  if (!demoMode) return <div className="stack">
    <Link className="back-link" to="/treasurer/activities">← Activities / Budget summary</Link>
    <PageHeader eyebrow={`${activity.type.toUpperCase()} · ${activity.status.toUpperCase()}`} title={activity.name} description={activity.description} />
    <MetricCards items={[
      { label: 'Overall budget', value: money(s.budget, true), icon: Wallet, note: 'Director-managed ceiling' },
      { label: 'Department allocations', value: money(s.allocated, true), icon: CircleDollarSign, note: 'Current allocations' },
      { label: 'Planned task commitments', value: money(s.committed, true), icon: ArrowDownLeft, note: 'Active purchasing estimates' },
      { label: 'Uncommitted budget', value: money(s.available, true), icon: Percent, note: 'Budget less planned tasks' },
    ]} />
    <Panel title="Department purchasing plans" subtitle="No claims or payment records are included">
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Department purchasing plans">
        <table><thead><tr><th>DEPARTMENT</th><th>ALLOCATION</th><th>PLANNED TASKS</th><th>UNCOMMITTED</th></tr></thead>
          <tbody>{activity.departments.map((department) => {
            const tasks = data.assignments.filter((task) => task.departmentId === department.id && task.activityId === activity.id && task.purchasing?.status !== 'Cancelled');
            const planned = tasks.reduce((total, task) => total + task.budget, 0);
            return <tr key={department.id}><td>{department.name}<small className="cell-sub">{tasks.length} active purchasing tasks</small></td><td className="money">{money(department.allocation)}</td><td className="money">{money(planned)}</td><td className="money">{money(department.allocation - planned)}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </Panel>
  </div>;
  return (
    <div className="stack">
      <Link className="back-link" to="/treasurer/activities">
        ← Activities / Financial dashboard
      </Link>
      <PageHeader
        eyebrow={`${activity.type.toUpperCase()} · ${activity.status.toUpperCase()}`}
        title={activity.name}
        description={activity.description}
      >
        <TextLink to={`/treasurer/history?activity=${id}`}>Payment history</TextLink>
      </PageHeader>
      <MetricCards
        items={[
          {
            label: 'Overall budget',
            value: money(s.budget, true),
            icon: Wallet,
            note: 'Director-managed ceiling',
          },
          {
            label: 'Recorded claims',
            value: money(s.recorded, true),
            icon: CircleDollarSign,
            note: 'Pending + approved',
            tone: 'violet',
          },
          {
            label: 'Remaining budget',
            value: money(s.remaining, true),
            icon: ArrowDownLeft,
            note: 'Budget less recorded',
            tone: 'green',
          },
          {
            label: 'Budget utilization',
            value: `${s.utilization.toFixed(1)}%`,
            icon: Percent,
            note: 'Recorded / overall budget',
            tone: 'gold',
          },
        ]}
      />
      <TreasuryLifecycle data={scope} />
      <FinancialAlerts data={scope} />
      <Panel
        title="Department spending breakdown"
        subtitle="Available funds also reserve open purchasing tasks"
      >
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Department balances">
          <table>
            <thead>
              <tr>
                {[
                  'DEPARTMENT',
                  'ALLOCATION',
                  'RECORDED',
                  'PENDING',
                  'COMMITTED',
                  'PAID',
                  'AVAILABLE',
                  'UTILIZATION',
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.departments.map((d) => {
                const b = summarize(data, id, d.id);
                return (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.name}</strong>
                      <small className="cell-sub">{d.head || 'No HOD assigned'}</small>
                    </td>
                    {[b.budget, b.recorded, b.pending, b.committed, b.paid, b.available].map(
                      (n, i) => (
                        <td key={i} className={`money ${n < 0 ? 'danger-text' : ''}`}>
                          {money(n)}
                        </td>
                      ),
                    )}
                    <td>{b.utilization.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!activity.departments.length && (
          <Empty title="No departments yet">
            The Director can configure this activity’s departments and allocations.
          </Empty>
        )}
      </Panel>
      <Panel
        title="Activity claims & payment status"
        subtitle="Filter the shared records by department, member, submission date, and review status"
      >
        <ClaimList activityId={id} />
      </Panel>
    </div>
  );
}
