import { ArrowUpRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DepartmentBalances,
  DepartmentMetrics,
  useDepartmentScope,
} from '../../components/hod/HodWidgets';
import { Empty, PageHeader, Panel, Progress, useFormat } from '../../components/ui';
import { isReservation } from '../../domain/claim-balances';
import { canPlanActivity, financialStateLabel } from '../../domain/activity-closing';

export function HodBudget() {
  const { data, scope, tasks, base, summary } = useDepartmentScope();
  const { money } = useFormat();
  const [overOnly, setOverOnly] = useState(false);
  const active = tasks.filter((t) => t.purchasing!.status !== 'Cancelled');
  const rows = active.filter(
    (t) => !overOnly || data.expenses.some((e) => e.id === t.expenseId && e.amount > t.budget),
  );
  return (
    <div className="stack">
      <PageHeader
        eyebrow={`${scope.department.name.toUpperCase()} · ${financialStateLabel(scope.activity.financialState, 'BUDGET & ALLOCATIONS')}`}
        title="Budget"
        description="Compare planned costs with real claims."
      >
        {canPlanActivity(scope.activity.financialState) && <Link className="btn primary" to={`${base}/tasks/new`}>
          <Plus size={15} />
          Create purchasing task
        </Link>}
      </PageHeader>
      <DepartmentMetrics data={data} scope={scope} />
      <DepartmentBalances data={data} scope={scope} />
      <Panel
        title="How much more you can plan"
        subtitle="Only the Director can change your budget"
      >
        <div className="panel-body stack">
          <div className="capacity-row">
            <div>
              <small>Left after claims and open tasks</small>
              <strong className={`money ${summary.available < 0 ? 'danger-text' : ''}`}>
                {money(summary.available)}
              </strong>
            </div>
            <div>
              <small>Budget minus all planned tasks</small>
              <strong className={`money ${summary.planned > summary.budget ? 'danger-text' : ''}`}>
                {money(summary.budget - summary.planned)}
              </strong>
            </div>
            <div>
              <small>Most you can set for a new task</small>
              <strong className="money good-text">
                {money(Math.max(0, summary.purchasingCapacity))}
              </strong>
            </div>
          </div>
          <div className="budget-comparison">
            <div>
              <span>Planned item budgets</span>
              <strong>{money(summary.planned)}</strong>
              <Progress
                value={summary.budget ? (summary.planned / summary.budget) * 100 : 0}
                label="Planned tasks as share of budget"
                tone={summary.planned > summary.budget ? 'danger' : 'brand'}
              />
            </div>
            <div>
              <span>Claimed so far</span>
              <strong>{money(summary.recorded)}</strong>
              <Progress
                value={summary.utilization}
                label="Actual department spending"
                tone={summary.recorded > summary.budget ? 'danger' : 'green'}
              />
            </div>
          </div>
          <p className="settings-copy">
            New item budgets must fit both limits above. Once a claim is recorded, its actual amount
            replaces the task estimate in financial commitments. Completed purchases without a claim
            retain their budget reservation.
          </p>
          {summary.purchasingCapacity < 0 && (
            <div className="form-error" role="status">
              Your claims or planned item allocations exceed the department limit. Review open tasks
              before allocating more funds; only the Director can change the department allocation.
            </div>
          )}
        </div>
      </Panel>
      <Panel
        title="Planned vs actual cost"
        subtitle="A + amount means the claim cost more than planned"
        action={
          <button
            className={`filter-chip ${overOnly ? 'selected' : ''}`}
            aria-pressed={overOnly}
            onClick={() => setOverOnly(!overOnly)}
          >
            {overOnly ? 'Show all items' : 'Show items over estimate'}
          </button>
        }
      >
        {rows.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Item budgets and spending variances"
          >
            <table>
              <thead>
                <tr>
                  <th>PURCHASING ITEM</th>
                  <th>ESTIMATE</th>
                  <th>CLAIM</th>
                  <th>DIFFERENCE</th>
                  <th>SET ASIDE (NO CLAIM YET)</th>
                  <th>
                    <span className="sr-only">Task details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => {
                  const claim = data.expenses.find((e) => e.id === task.expenseId);
                  const variance = claim ? claim.amount - task.budget : null;
                  return (
                    <tr key={task.id}>
                      <td>
                        <Link className="activity-name" to={`${base}/tasks/${task.id}`}>
                          {task.purchasing!.name}
                        </Link>
                        <small className="cell-sub">{task.purchasing!.status}</small>
                      </td>
                      <td className="money">{money(task.budget)}</td>
                      <td className="money">
                        {claim ? (
                          <>
                            {money(claim.amount)}
                            <small className="cell-sub">{claim.state}</small>
                          </>
                        ) : (
                          'No claim'
                        )}
                      </td>
                      <td
                        className={`money ${variance !== null && variance > 0 ? 'danger-text' : 'muted'}`}
                      >
                        {variance === null ? '—' : `${variance > 0 ? '+' : ''}${money(variance)}`}
                      </td>
                      <td className="money">
                        {isReservation(task, data.expenses) ? money(task.budget) : '—'}
                      </td>
                      <td>
                        <Link
                          className="table-arrow"
                          to={`${base}/tasks/${task.id}`}
                          aria-label={`View budget for ${task.purchasing!.name}`}
                        >
                          <ArrowUpRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              overOnly ? 'No items exceed their estimate' : 'No purchasing tasks yet'
            }
          >
            {overOnly
              ? 'Recorded claims are within their item estimates, or no claim has been recorded yet.'
              : 'Create a task to plan how to spend your budget.'}
          </Empty>
        )}
      </Panel>
    </div>
  );
}
