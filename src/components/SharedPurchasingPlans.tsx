import type { Activity, Store } from '../domain/models';
import { Badge, Empty, Panel, useFormat } from './ui';

export function SharedPurchasingPlans({ store, activity }: { store: Store; activity: Activity }) {
  const { money, date } = useFormat();
  const tasks = store.assignments.filter(t => t.activityId === activity.id);
  return <Panel title="Shared purchasing plans" subtitle="Read-only department plans · HOD changes use these same records">
    {!tasks.length ? <Empty title="No purchasing plans yet">Assigned HODs can plan purchases within their department allocations.</Empty> :
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Shared department purchasing plans"><table><thead><tr><th>PURCHASING TASK</th><th>DEPARTMENT</th><th>MEMBER</th><th>ITEM ESTIMATE</th><th>PURCHASING STATUS</th><th>DUE DATE</th><th>UNCLAIMED RESERVATION</th></tr></thead><tbody>{tasks.map(task => {
        const p = task.purchasing;
        return <tr key={task.id}><td><strong className="expense-title">{p?.name ?? 'Purchasing allocation'}</strong><small className="cell-sub">{task.id}</small></td><td>{activity.departments.find(d => d.id === task.departmentId)?.name}</td><td>{store.directory?.users.find(u => u.id === p?.assigneeId)?.name ?? 'Unassigned'}</td><td className="money">{money(task.budget)}</td><td><Badge tone={p?.status === 'Completed' ? 'green' : p?.status === 'Cancelled' ? 'neutral' : 'gold'}>{p?.status ?? 'Not Started'}</Badge></td><td>{p ? date(p.dueDate) : '—'}</td><td className="money">{money(task.expenseId || p?.status === 'Cancelled' ? 0 : task.budget)}</td></tr>;
      })}</tbody></table></div>}
    <p className="data-note panel-note">Purchasing completion does not approve a claim or record payment. Cancelled estimates are excluded from commitments; completed purchases without claims remain reserved.</p>
  </Panel>;
}
