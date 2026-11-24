import { Link } from 'react-router-dom';
import type { Assignment, Expense } from '../../domain/models';
import type { MemberSnapshot } from '../../domain/member';
import { departmentToday, isOverdue } from '../../domain/hod';
import { paymentState } from '../../domain/risk';
import { PurchaseBadge } from '../hod/HodWidgets';
import { Badge, Empty, Status, paymentLabel, useFormat } from '../ui';
export const memberDepartmentPath = (activity: string, department: string) =>
  `/member/activities/${activity}/departments/${department}`;
export function MemberTaskTable({ tasks, data }: { tasks: Assignment[]; data: MemberSnapshot }) {
  const { money, date } = useFormat(),
    today = departmentToday(data.settings.timezone);
  if (!tasks.length)
    return (
      <Empty title="No matching purchases">
        No purchases match. Try clearing filters.
      </Empty>
    );
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Member purchasing assignments"
    >
      <table>
        <thead>
          <tr>
            {[
              'PURCHASE / DEPARTMENT',
              'ASSIGNED TO',
              'ITEM BUDGET',
              'DUE DATE',
              'PRIORITY',
              'STATUS',
              'ACTION',
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const p = task.purchasing!,
              scope = data.scopes.find(
                (s) => s.activity.id === task.activityId && s.department.id === task.departmentId,
              ),
              own = p.assigneeId === data.userId;
            return (
              <tr key={task.id}>
                <td>
                  <Link className="activity-name" to={`/member/tasks/${task.id}`}>
                    {p.name}
                  </Link>
                  <small className="cell-sub">
                    {scope?.activity.name} / {scope?.department.name}
                  </small>
                </td>
                <td>
                  {data.directory.users.find((u) => u.id === p.assigneeId)?.name ?? 'Unassigned'}
                  {own && <small className="cell-sub good-text">Your purchase</small>}
                </td>
                <td className="money">{money(task.budget)}</td>
                <td>
                  {date(p.dueDate)}
                  {isOverdue(task, today) && (
                    <small className="cell-sub danger-text">Overdue</small>
                  )}
                </td>
                <td>
                  <Badge tone={p.priority === 'High' ? 'gold' : 'neutral'}>{p.priority}</Badge>
                </td>
                <td>
                  <PurchaseBadge task={task} />
                </td>
                <td>
                  <Link className="text-link" to={`/member/tasks/${task.id}`}>
                    {own ? 'Manage my purchase' : 'View details'}
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
export function MemberClaimTable({ claims, data }: { claims: Expense[]; data: MemberSnapshot }) {
  const { money, date } = useFormat();
  if (!claims.length)
    return (
      <Empty
        title="No matching claims"
        action={
          <Link className="btn" to="/member/tasks">
            Find my purchases
          </Link>
        }
      >
        No claims yet. Start a claim from a purchase you’ve bought.
      </Empty>
    );
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="My reimbursement claims">
      <table>
        <thead>
          <tr>
            {[
              'CLAIM / PURPOSE',
              'ACTIVITY / DEPARTMENT',
              'CLAIMED',
              'SUBMITTED',
              'CLAIM STATUS',
              'PAYMENT',
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => {
            const scope = data.scopes.find(
              (s) => s.activity.id === claim.activityId && s.department.id === claim.departmentId,
            );
            return (
              <tr key={claim.id}>
                <td>
                  <Link className="activity-name" to={`/member/claims/${claim.id}`}>
                    {claim.description}
                  </Link>
                  <small className="cell-sub member-id">{claim.id}</small>
                </td>
                <td>
                  {scope?.activity.name}
                  <small className="cell-sub">{scope?.department.name}</small>
                </td>
                <td className="money">{money(claim.amount)}</td>
                <td>{date(claim.date)}</td>
                <td>
                  <Status value={claim.lifecycle ?? claim.state} />
                </td>
                <td>{paymentLabel(paymentState(data, claim), 'member')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
