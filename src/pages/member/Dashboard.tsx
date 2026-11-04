import { Bell, ClipboardList, Clock, FolderKanban, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMember } from '../../context/member-context';
import { useSession } from '../../context/session-context';
import { memberNotifications } from '../../domain/member-notifications';
import {
  MemberClaimTable,
  MemberTaskTable,
  memberDepartmentPath,
} from '../../components/member/MemberTables';
import { MetricCards } from '../../components/MetricCards';
import { Empty, PageHeader, Panel, Progress, TextLink, useFormat } from '../../components/ui';
export function MemberDashboard() {
  const { data } = useMember(),
    { actor } = useSession(),
    { money, time } = useFormat();
  if (!data) return null;
  const mine = data.assignments.filter((t) => t.purchasing?.assigneeId === data.userId);
  const pending = mine.filter((t) => ['Not Started', 'In Progress'].includes(t.purchasing!.status));
  const completed = mine.filter((t) =>
    ['Purchased', 'Claim Submitted', 'Completed'].includes(t.purchasing!.status),
  );
  const awaiting = data.expenses.filter((e) => ['Pending review', 'In review'].includes(e.state));
  const unpaid = data.expenses.filter(
    (e) => e.state === 'Approved' && !data.payments.some((p) => p.expenseId === e.id),
  );
  const notes = memberNotifications(data);
  return (
    <div className="stack dashboard">
      <PageHeader
        eyebrow="COMMITTEE MEMBER WORKSPACE"
        title={`${actor.name.split(' ')[0]}, here’s your part of the plan.`}
        description="Your department’s purpose, your next purchase, and a clear path to reimbursement."
      >
        <Link className="btn primary" to="/member/tasks">
          View my purchases
        </Link>
      </PageHeader>
      {!data.scopes.length && (
        <Empty title="No active departments assigned">
          Your Director must explicitly add your Member profile to an activity department. Your
          private saved accounts remain available.
        </Empty>
      )}
      <MetricCards
        items={[
          {
            label: 'My activities',
            value: String(new Set(data.scopes.map((s) => s.activity.id)).size).padStart(2, '0'),
            icon: FolderKanban,
            note: `${data.scopes.length} assigned departments`,
          },
          {
            label: 'My assigned tasks',
            value: String(mine.length).padStart(2, '0'),
            icon: ClipboardList,
            note: 'Shared HOD purchasing plans',
            tone: 'violet',
          },
          {
            label: 'Claims awaiting review',
            value: String(awaiting.length).padStart(2, '0'),
            icon: Clock,
            note: 'Pending + in review',
            tone: 'gold',
          },
          {
            label: 'Total reimbursed',
            value: money(
              data.payments.reduce((s, p) => s + p.amount, 0),
              true,
            ),
            icon: Wallet,
            note: 'Manually recorded · check receipt status',
            tone: 'green',
          },
        ]}
      />
      <div className="member-counts">
        {[
          ['Pending purchases', pending.length, '/member/tasks'],
          ['Completed purchases', completed.length, '/member/tasks'],
          [
            'Approved claims',
            data.expenses.filter((e) => e.state === 'Approved').length,
            '/member/claims',
          ],
          ['Pending reimbursements', unpaid.length, '/member/claims'],
        ].map(([label, value, to]) => (
          <Link key={label} to={String(to)}>
            <span>{label}</span>
            <strong>{String(value).padStart(2, '0')}</strong>
          </Link>
        ))}
      </div>
      <Panel
        title="My upcoming tasks"
        subtitle="Open purchases, ordered by their actual HOD deadline"
        action={<TextLink to="/member/tasks">All my tasks</TextLink>}
      >
        <MemberTaskTable
          tasks={pending
            .sort((a, b) => a.purchasing!.dueDate.localeCompare(b.purchasing!.dueDate))
            .slice(0, 4)}
          data={data}
        />
      </Panel>
      <div className="member-two-col">
        <Panel
          title="Department purchasing progress"
          subtitle="Coordination visibility · purchase progress is separate from reimbursement"
        >
          <div className="member-content stack">
            {data.scopes.map((s) => {
              const tasks = data.assignments.filter(
                  (t) =>
                    t.activityId === s.activity.id &&
                    t.departmentId === s.department.id &&
                    t.purchasing!.status !== 'Cancelled',
                ),
                done = tasks.filter((t) =>
                  ['Purchased', 'Claim Submitted', 'Completed'].includes(t.purchasing!.status),
                ).length;
              return (
                <div key={`${s.activity.id}:${s.department.id}`} className="member-progress-row">
                  <Link to={memberDepartmentPath(s.activity.id, s.department.id)}>
                    {s.department.name}
                    <small className="cell-sub">{s.activity.name}</small>
                  </Link>
                  <small>
                    {done} of {tasks.length} purchased or claimed
                  </small>
                  <Progress
                    value={tasks.length ? (done / tasks.length) * 100 : 0}
                    label={`${s.department.name} purchasing progress`}
                    tone="green"
                  />
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Claim status overview"
          subtitle="Only your own reimbursement records"
          action={<TextLink to="/member/claims">My claims</TextLink>}
        >
          <div className="member-content stack">
            {['Pending review', 'In review', 'Approved', 'Declined'].map((state) => (
              <div className="member-status-row" key={state}>
                <span>{state}</span>
                <strong>{data.expenses.filter((e) => e.state === state).length}</strong>
              </div>
            ))}
            <p className="field-hint">
              Approved claims stay unpaid until the Treasurer records a reimbursement. Only you can
              confirm its receipt.
            </p>
          </div>
        </Panel>
      </div>
      <Panel
        title="Recent claims"
        subtitle="Shared Treasurer status, evidence, and payment history"
        action={<TextLink to="/member/claims">All my claims</TextLink>}
      >
        <MemberClaimTable
          claims={[...data.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)}
          data={data}
        />
      </Panel>
      <Panel
        title="Recent notifications"
        subtitle="Real assignments, deadlines, and shared claim events"
        action={<TextLink to="/member/notifications">View notifications</TextLink>}
      >
        <div className="member-content stack">
          {notes.slice(0, 4).map((n) => (
            <Link className="member-notification" to={n.to} key={n.id}>
              <span className="timeline-icon">
                <Bell size={15} />
              </span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.detail}</p>
                <small>{time(n.at)}</small>
              </div>
              {!n.read && <span className="member-unread" aria-label="Unread" />}
            </Link>
          ))}
          {!notes.length && (
            <Empty title="You’re up to date">
              Notifications will follow actual changes to your responsibilities and claims.
            </Empty>
          )}
        </div>
      </Panel>
    </div>
  );
}
