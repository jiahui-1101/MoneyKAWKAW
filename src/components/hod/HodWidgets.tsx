import {
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  PiggyBank,
  Wallet,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useHod } from '../../context/hod-context';
import {
  departmentBudget,
  departmentToday,
  isOverdue,
  scopePath,
  type HodScope,
  type HodSnapshot,
} from '../../domain/hod';
import type { Assignment } from '../../domain/models';
import { MetricCards } from '../MetricCards';
import { Badge, Empty, Panel, Progress, Status, TextLink, useFormat } from '../ui';
import { demoMode } from '../../services/supabase/client';

export function useDepartmentScope() {
  const { data } = useHod();
  const { activityId, departmentId } = useParams();
  const scope = activityId
    ? data?.scopes.find((s) => s.activity.id === activityId && s.department.id === departmentId)
    : data?.scopes[0];
  if (!data || !scope) throw new Error('You don’t have access to this department.');
  return {
    data,
    scope,
    base: scopePath(scope.activity.id, scope.department.id),
    summary: departmentBudget(data, scope.activity.id, scope.department.id),
    tasks: data.assignments.filter(
      (t) => t.activityId === scope.activity.id && t.departmentId === scope.department.id,
    ),
  };
}
export function PurchaseBadge({ task }: { task: Assignment }) {
  const state = task.purchasing?.status ?? 'Not Started';
  return (
    <Badge
      tone={
        state === 'Completed'
          ? 'green'
          : state === 'Claim Submitted'
            ? 'violet'
            : state === 'Purchased'
              ? 'gold'
              : state === 'In Progress'
                ? 'brand'
                : 'neutral'
      }
    >
      {state}
    </Badge>
  );
}
export function DepartmentMetrics({ data, scope }: { data: HodSnapshot; scope: HodScope }) {
  const { money } = useFormat();
  const s = departmentBudget(data, scope.activity.id, scope.department.id);
  return (
    <MetricCards
      items={[
        {
          label: 'Department budget',
          value: money(s.budget, true),
          icon: Wallet,
          note: 'Allocated by the Director',
          tone: 'brand',
        },
        {
          label: 'Planned purchases',
          value: money(s.planned, true),
          icon: ClipboardList,
          note: 'Total of task estimates (not cancelled)',
          tone: 'violet',
        },
        {
          label: demoMode ? 'Recorded spending' : 'Claim spending',
          value: money(s.recorded, true),
          icon: CircleDollarSign,
          note: 'Claims approved or already paid',
          tone: 'gold',
        },
        {
          label: 'Available for purchases',
          value: money(s.available, true),
          icon: PiggyBank,
          note: demoMode ? 'After claims and open tasks' : 'Budget left after open tasks',
          tone: s.available < 0 ? 'danger' : 'green',
        },
      ]}
    />
  );
}
export function DepartmentBalances({ data, scope }: { data: HodSnapshot; scope: HodScope }) {
  const { money } = useFormat();
  const s = departmentBudget(data, scope.activity.id, scope.department.id);
  return (
    <div className="lifecycle">
      {[
        [demoMode ? 'Left after claims' : 'Available to plan', money(s.available), demoMode ? 'Budget minus claims' : 'Budget left after open tasks'],
        [demoMode ? 'Committed' : 'Set aside, not paid yet', money(s.committed), demoMode ? 'Open tasks + approved claims not yet paid' : 'Active task estimates · cancelled tasks excluded'],
        ['Pending claim review', money(s.pending), demoMode ? 'Decision remains with Treasurer' : 'Total only; receipts are private'],
        ['Paid reimbursements', money(s.paid), demoMode ? 'Fictional shared payment records' : 'Payments sent; the member confirms receipt separately'],
        ['Budget used', `${s.utilization.toFixed(1)}%`, demoMode ? 'Actual claims / department budget' : 'Approved and paid claims ÷ department budget'],
      ].map(([label, value, note]) => (
        <div key={label}>
          <small>{label}</small>
          <strong className="money">{value}</strong>
          <span>{note}</span>
        </div>
      ))}
    </div>
  );
}
export function TaskTable({ tasks, data }: { tasks: Assignment[]; data: HodSnapshot }) {
  const { money, date } = useFormat();
  const today = departmentToday(data.settings.timezone);
  if (!tasks.length)
    return (
      <Empty title="No purchases to show">
        Create a purchasing task or adjust the filters to see your team’s work.
      </Empty>
    );
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Department purchasing tasks"
    >
      <table className="hod-task-table">
        <thead>
          <tr>
            <th>ITEM / PURPOSE</th>
            <th>ASSIGNED TO</th>
            <th>ITEM BUDGET</th>
            <th>DUE DATE</th>
            <th>PRIORITY</th>
            <th>PURCHASING</th>
            <th>CLAIM REVIEW</th>
            <th>
              <span className="sr-only">Open task</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const p = task.purchasing!;
            const claim = data.expenses.find((e) => e.id === task.expenseId);
            const overdue = isOverdue(task, today);
            const href = `${scopePath(task.activityId, task.departmentId)}/tasks/${task.id}`;
            return (
              <tr key={task.id}>
                <td>
                  <Link className="activity-name" to={href}>
                    {p.name}
                  </Link>
                  <small className="cell-sub">
                    {task.expenseId
                      ? 'Claim submitted'
                      : p.status === 'Purchased'
                        ? demoMode ? 'Bought, waiting for claim' : 'Purchased'
                        : p.status === 'Completed'
                          ? 'Done · no claim yet'
                          : 'Department purchasing plan'}
                  </small>
                </td>
                <td>
                  <span className={p.assigneeId ? '' : 'attention-text'}>
                    {data.directory.users.find((u) => u.id === p.assigneeId)?.name ?? 'Unassigned'}
                  </span>
                </td>
                <td className="money">{money(task.budget)}</td>
                <td>
                  <span className={overdue ? 'danger-text' : ''}>{date(p.dueDate)}</span>
                  {overdue && <small className="cell-sub danger-text">Overdue</small>}
                </td>
                <td>
                  <Badge
                    tone={
                      p.priority === 'High'
                        ? 'danger'
                        : p.priority === 'Medium'
                          ? 'gold'
                          : 'neutral'
                    }
                  >
                    {p.priority}
                  </Badge>
                </td>
                <td>
                  <PurchaseBadge task={task} />
                </td>
                <td>
                  {claim ? <Status value={claim.state} /> : <span className="muted">{demoMode ? 'No claim yet' : 'Private'}</span>}
                </td>
                <td>
                  <Link className="table-arrow" to={href} aria-label={`Open ${p.name}`}>
                    <ArrowUpRight size={16} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function ProcurementFlow({ tasks, base }: { tasks: Assignment[]; base: string }) {
  const active = tasks.filter((t) => t.purchasing?.status !== 'Cancelled');
  return (
    <Panel
      title="From plan to purchase"
      subtitle="Buying progress only. This is not claim payment."
    >
      <div className="procurement-flow">
        {['Not Started', 'In Progress', 'Purchased', 'Claim Submitted', 'Completed'].map(
          (state, index) => {
            const count = active.filter((t) => t.purchasing?.status === state).length;
            return (
              <Link key={state} to={`${base}/tasks?status=${encodeURIComponent(state)}`}>
                <span className={`flow-step chart-color-${index}`}>
                  <i />
                  {state}
                </span>
                <strong>{count.toString().padStart(2, '0')}</strong>
                <Progress
                  value={active.length ? (count / active.length) * 100 : 0}
                  label={`${state} proportion`}
                  tone={state === 'Completed' ? 'green' : 'brand'}
                />
              </Link>
            );
          },
        )}
      </div>
    </Panel>
  );
}
export function DepartmentActivity({
  data,
  scope,
  all = false,
}: {
  data: HodSnapshot;
  scope: HodScope;
  all?: boolean;
}) {
  const { time } = useFormat();
  const events = data.events.filter(
    (e) => e.activityId === scope.activity.id && e.departmentId === scope.department.id,
  );
  return (
    <Panel title="Recent department activity" subtitle="A record of your team’s purchasing changes">
      <div className="timeline">
        {events.slice(0, all ? undefined : 8).map((e) => (
          <div className="timeline-item" key={e.id}>
            <span className="timeline-icon">
              <ClipboardList size={15} />
            </span>
            <div>
              {e.assignmentId ? (
                <Link to={`${scopePath(e.activityId, e.departmentId!)}/tasks/${e.assignmentId}`}>
                  {e.action}
                </Link>
              ) : (
                <h3>{e.action}</h3>
              )}
              <p>{e.actor}</p>
              <details>
                <summary>Change details</summary>
                <p className="audit-detail">{e.detail}</p>
              </details>
            </div>
            <time dateTime={e.at}>{time(e.at)}</time>
          </div>
        ))}
        {!events.length && (
          <Empty title="No activity yet">
            New purchasing tasks, reassignments, and progress changes appear here.
          </Empty>
        )}
      </div>
    </Panel>
  );
}
export function UpcomingPurchases({
  tasks,
  data,
  base,
}: {
  tasks: Assignment[];
  data: HodSnapshot;
  base: string;
}) {
  const { date } = useFormat();
  const today = departmentToday(data.settings.timezone);
  const due = tasks
    .filter((t) => ['Not Started', 'In Progress'].includes(t.purchasing!.status))
    .sort((a, b) => a.purchasing!.dueDate.localeCompare(b.purchasing!.dueDate))
    .slice(0, 4);
  return (
    <Panel
      title="Due soon"
      subtitle="Next tasks to buy"
      action={<TextLink to={`${base}/tasks?attention=overdue`}>See overdue tasks</TextLink>}
    >
      <div className="deadline-list">
        {due.map((task) => (
          <Link className="deadline-row" to={`${base}/tasks/${task.id}`} key={task.id}>
            <span className={`deadline-icon ${isOverdue(task, today) ? 'danger-text' : ''}`}>
              <CalendarClock size={18} />
            </span>
            <div>
              <strong>{task.purchasing!.name}</strong>
              <small>
                {data.directory.users.find((u) => u.id === task.purchasing!.assigneeId)?.name ??
                  'Unassigned'}
              </small>
            </div>
            <span className={isOverdue(task, today) ? 'danger-text' : 'muted'}>
              {date(task.purchasing!.dueDate)}
            </span>
          </Link>
        ))}
        {!due.length && (
          <Empty title="Nothing due">
            No tasks are waiting to be bought.
          </Empty>
        )}
      </div>
    </Panel>
  );
}
