import { ArrowLeft, ArrowUpRight, CalendarDays, Pencil, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useWorkspace } from '../context/workspace-context';
import { summarize } from '../domain/budget';
import type { Activity, Store } from '../domain/models';
import { BudgetLifecycle, Metrics, Overspending, RecentActivity } from '../components/Finance';
import { Departments } from '../components/Departments';
import { SharedPurchasingPlans } from '../components/SharedPurchasingPlans';
import { Empty, Panel, Progress, Status, TextLink, useFormat } from '../components/ui';
import { demoMode } from '../services/supabase/client';
import { ActivityClosingPanel } from '../components/ActivityClosingPanel';
import { financialStateLabel } from '../domain/activity-closing';
import { MoneyMap } from '../components/charts/MoneyMap';

export function ActivityDetail({
  tab = 'overview',
}: {
  tab?: 'overview' | 'map' | 'departments' | 'budget' | 'closing';
}) {
  const { id } = useParams();
  const { store, reload } = useWorkspace();
  const { date, money } = useFormat();
  const a = store?.activities.find((a) => a.id === id);
  if (!store || !a)
    return (
      <Empty
        title="This activity isn’t here"
        action={
          <Link className="btn" to="/director/activities">
            Back to activities
          </Link>
        }
      >
        It may have been deleted, or the link is wrong.
      </Empty>
    );
  const summary = summarize(store, a.id);
  const path = `/director/activities/${a.id}`;
  const editable = !a.financialState || a.financialState === 'Open';
  return (
    <div className="stack activity-detail">
      <Link className="back-link" to="/director/activities">
        <ArrowLeft size={15} />
        Activities <span>/</span> {a.name}
      </Link>
      <div className="activity-detail-heading">
        <div>
          <div className="row">
            <span className="eyebrow">{a.type}</span>
            <Status value={financialStateLabel(a.financialState, a.status)} />
          </div>
          <h1>{a.name}</h1>
          <div className="detail-meta">
            <span>
              <CalendarDays size={14} />
              {date(a.startDate)}
              {a.endDate !== a.startDate ? ` — ${date(a.endDate)}` : ''}
            </span>
            <span>
              <Users size={14} />
              {a.departments.length} departments
            </span>
          </div>
        </div>
        {editable && <Link className="btn" to={`${path}/edit`}>
          <Pencil size={14} />
          Edit activity
        </Link>}
      </div>
      <nav className="detail-tabs" aria-label="Activity sections">
        {[
          ['overview', 'Overview', path],
          ['map', 'Money map', `${path}/map`],
          ['departments', 'Departments', `${path}/departments`],
          ['budget', 'Budget',  `${path}/budget`],
          ...(!demoMode ? [['closing', 'Close activity',  `${path}/closing`]] : []),
        ].map(([key, label, to]) => (
          <NavLink key={key} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
            {key === 'departments' && <span>{a.departments.length}</span>}
          </NavLink>
        ))}
      </nav>
      <Overspending store={store} activityId={a.id} />
      {tab === 'closing' && !demoMode ? (
        <ActivityClosingPanel key={a.id} activity={a} workspaceRole="Director" reload={reload} />
      ) : tab === 'map' ? (
        <Panel title="Money map" subtitle="Tap a box to see where its money comes from and goes, or show it as a list">
          <div className="panel-body"><MoneyMap store={store} activity={a} /></div>
        </Panel>
      ) : tab === 'departments' ? (
        <>
          <div className="section-intro">
            <h2>Split the budget between departments</h2>
            <p>Department budgets must add up to {money(a.budget)} or less.</p>
          </div>
          <Departments activity={a} />
        </>
      ) : (
        <>
          <Metrics summary={summary} />
          {tab === 'overview' && (
            <Panel
              title="About this activity"
              action={<TextLink to={`${path}/budget`}>See budget</TextLink>}
            >
              <div className="panel-body">
                <p className="activity-description">{a.description}</p>
                <div className="activity-setup-note">
                  <span>{money(summary.budget - summary.allocated)} not given to a department yet.</span>
                  <TextLink to={`${path}/departments`}>Manage departments</TextLink>
                </div>
              </div>
            </Panel>
          )}
          <BudgetLifecycle summary={summary} />
          <DepartmentBreakdown store={store} activity={a} />
          {tab === 'budget' && <SharedPurchasingPlans store={store} activity={a} />}
          <ExpenseRecords store={store} activity={a} />
          {tab === 'overview' && <RecentActivity store={store} activityId={a.id} />}
        </>
      )}
    </div>
  );
}

function DepartmentBreakdown({ store, activity }: { store: Store; activity: Activity }) {
  const { money } = useFormat();
  const summary = summarize(store, activity.id);
  return (
    <Panel
      title="Department spending breakdown"
      subtitle="See each team’s allocation, spending, and contribution to total expenses"
      action={
        <TextLink to={`/director/activities/${activity.id}/departments`}>
          Edit department budgets
        </TextLink>
      }
    >
      {!activity.departments.length ? (
        <Empty
          title="No departments yet"
          action={
            <Link className="btn primary" to={`/director/activities/${activity.id}/departments`}>
              Add departments <ArrowUpRight size={15} />
            </Link>
          }
        >
          Add departments to split the budget.
        </Empty>
      ) : (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Department budgets table"
        >
          <table>
            <thead>
              <tr>
                <th>DEPARTMENT</th>
                <th>BUDGET</th>
                <th>CLAIMED</th>
                <th>LEFT</th>
                <th>USED %</th>
                <th>SHARE OF CLAIMS</th>
              </tr>
            </thead>
            <tbody>
              {activity.departments.map((d) => {
                const s = summarize(store, activity.id, d.id);
                const over = s.recorded > d.allocation;
                return (
                  <tr key={d.id}>
                    <td>
                      <strong className="department-table-name">{d.name}</strong>
                      <small className="cell-sub">{d.head || 'No head yet'}</small>
                    </td>
                    <td className="money">{money(d.allocation)}</td>
                    <td className="money">{money(s.recorded)}</td>
                    <td className={`money ${over ? 'danger-text' : ''}`}>{money(s.remaining)}</td>
                    <td>
                      <div className="utilization-cell">
                        <span className={over ? 'danger-text' : ''}>
                          {s.utilization.toFixed(1)}%
                        </span>
                        <Progress
                          value={s.utilization}
                          label={`${d.name} utilization`}
                          tone={
                            over
                              ? 'danger'
                              : s.utilization >= store.settings.warningPercent
                                ? 'gold'
                                : 'green'
                          }
                        />
                      </div>
                    </td>
                    <td>
                      {summary.recorded ? ((s.recorded / summary.recorded) * 100).toFixed(1) : '0'}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>All departments</td>
                <td className="money">{money(summary.allocated)}</td>
                <td className="money">{money(summary.recorded)}</td>
                <td className="money">{money(summary.allocated - summary.recorded)}</td>
                <td colSpan={2}>{money(summary.budget - summary.allocated)} not given out</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="data-note panel-note">
        Left = budget minus claimed. Over 100% used means the department is over budget.
      </p>
    </Panel>
  );
}

function ExpenseRecords({ store, activity }: { store: Store; activity: Activity }) {
  const { money, date } = useFormat();
  const [state, setState] = useState('');
  if (!demoMode) return <Panel title="Claims are private" subtitle="You see totals only">
    <p className="data-note">Only the member and the Treasurer can see each claim, receipt and bank detail. The
      totals above include them.</p>
  </Panel>;
  const expenses = store.expenses.filter(
    (e) => e.activityId === activity.id && (!state || e.state === state),
  );
  return (
    <Panel
      title="Claims"
      subtitle="Sample claims (view only). Approved doesn’t mean paid."
      action={
        <select
          className="compact-select"
          aria-label="Filter expense status"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="Pending review">Waiting for review</option>
          <option>In review</option>
          <option>Approved</option>
          <option>Declined</option>
        </select>
      }
    >
      {expenses.length ? (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Claims table"
        >
          <table>
            <thead>
              <tr>
                <th>CLAIM</th>
                <th>DEPARTMENT</th>
                <th>STATUS</th>
                <th>AMOUNT</th>
                <th>PAID</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const paid = store.payments
                  .filter((p) => p.expenseId === e.id)
                  .reduce((sum, p) => sum + p.amount, 0);
                return (
                  <tr key={e.id}>
                    <td>
                      <strong className="expense-title">{e.description}</strong>
                      <small className="cell-sub">
                        {e.id} <span>·</span> {date(e.date)}
                      </small>
                    </td>
                    <td>{activity.departments.find((d) => d.id === e.departmentId)?.name}</td>
                    <td>
                      <Status value={e.state} />
                    </td>
                    <td className="money">{money(e.amount)}</td>
                    <td>
                      <span className={paid ? 'good-text' : 'muted'}>
                        {paid ? money(paid) : 'Not paid'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No claims yet">
          Claims show here after members submit them.
        </Empty>
      )}
    </Panel>
  );
}
