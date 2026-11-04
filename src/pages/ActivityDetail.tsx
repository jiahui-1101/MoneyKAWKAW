import { ArrowLeft, ArrowUpRight, CalendarDays, Pencil, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useWorkspace } from '../context/workspace-context';
import { summarize } from '../domain/budget';
import type { Activity, Store } from '../domain/models';
import { BudgetLifecycle, Metrics, Overspending, RecentActivity } from '../components/Finance';
import { Departments } from '../components/Departments';
import { Empty, Panel, Progress, Status, TextLink, useFormat } from '../components/ui';

export function ActivityDetail({
  tab = 'overview',
}: {
  tab?: 'overview' | 'departments' | 'budget';
}) {
  const { id } = useParams();
  const { store } = useWorkspace();
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
        It may not exist in this browser’s demo workspace.
      </Empty>
    );
  const summary = summarize(store, a.id);
  const path = `/director/activities/${a.id}`;
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
            <Status value={a.status} />
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
        <Link className="btn" to={`${path}/edit`}>
          <Pencil size={14} />
          Edit activity
        </Link>
      </div>
      <nav className="detail-tabs" aria-label="Activity sections">
        {[
          ['overview', 'Overview', path],
          ['departments', 'Departments', `${path}/departments`],
          ['budget', 'Budget dashboard', `${path}/budget`],
        ].map(([key, label, to]) => (
          <NavLink key={key} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
            {key === 'departments' && <span>{a.departments.length}</span>}
          </NavLink>
        ))}
      </nav>
      <Overspending store={store} activityId={a.id} />
      {tab === 'departments' ? (
        <>
          <div className="section-intro">
            <h2>A clear role. A thoughtful allocation.</h2>
            <p>Keep the team’s total allocations within the overall budget of {money(a.budget)}.</p>
          </div>
          <Departments activity={a} />
        </>
      ) : (
        <>
          <Metrics summary={summary} />
          {tab === 'overview' && (
            <Panel
              title="About this activity"
              action={<TextLink to={`${path}/budget`}>Open budget dashboard</TextLink>}
            >
              <div className="panel-body">
                <p className="activity-description">{a.description}</p>
                <div className="activity-setup-note">
                  <span>{money(summary.budget - summary.allocated)} remains unallocated.</span>
                  <TextLink to={`${path}/departments`}>Configure departments</TextLink>
                </div>
              </div>
            </Panel>
          )}
          <BudgetLifecycle summary={summary} />
          <DepartmentBreakdown store={store} activity={a} />
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
          Manage allocations
        </TextLink>
      }
    >
      {!activity.departments.length ? (
        <Empty
          title="Your budget is ready for a team"
          action={
            <Link className="btn primary" to={`/director/activities/${activity.id}/departments`}>
              Configure departments <ArrowUpRight size={15} />
            </Link>
          }
        >
          Add departments to start distributing your overall budget.
        </Empty>
      ) : (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable financial table"
        >
          <table>
            <thead>
              <tr>
                <th>DEPARTMENT</th>
                <th>ALLOCATION</th>
                <th>RECORDED</th>
                <th>REMAINING</th>
                <th>UTILIZATION</th>
                <th>SHARE OF EXPENSES</th>
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
                      <small className="cell-sub">{d.head || 'Lead not assigned'}</small>
                    </td>
                    <td className="money">{money(d.allocation)}</td>
                    <td className="money">{money(s.recorded)}</td>
                    <td className={`money ${over ? 'danger-text' : ''}`}>{money(s.remaining)}</td>
                    <td>
                      <div className="utilization-cell">
                        <span className={over ? 'danger-text' : ''}>
                          {s.utilization.toFixed(0)}%
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
                <td>Total departments</td>
                <td className="money">{money(summary.allocated)}</td>
                <td className="money">{money(summary.recorded)}</td>
                <td className="money">{money(summary.allocated - summary.recorded)}</td>
                <td colSpan={2}>{money(summary.budget - summary.allocated)} unallocated</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="data-note panel-note">
        Remaining = allocation less recorded expenses. Utilization above 100% indicates an exceeded
        allocation.
      </p>
    </Panel>
  );
}

function ExpenseRecords({ store, activity }: { store: Store; activity: Activity }) {
  const { money, date } = useFormat();
  const [state, setState] = useState('');
  const expenses = store.expenses.filter(
    (e) => e.activityId === activity.id && (!state || e.state === state),
  );
  return (
    <Panel
      title="Recorded expenses"
      subtitle="Read-only, fictional claim records · approval and payment are separate"
      action={
        <select
          className="compact-select"
          aria-label="Filter expense status"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">All review states</option>
          <option>Pending review</option>
          <option>Approved</option>
        </select>
      }
    >
      {expenses.length ? (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable financial table"
        >
          <table>
            <thead>
              <tr>
                <th>EXPENSE / SOURCE</th>
                <th>DEPARTMENT</th>
                <th>REVIEW STATE</th>
                <th>AMOUNT</th>
                <th>PAYMENT RECORDED</th>
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
        <Empty title="No recorded expenses">
          Expenses will appear here when claims are recorded. Director setup does not create claims
          or payments.
        </Empty>
      )}
    </Panel>
  );
}
