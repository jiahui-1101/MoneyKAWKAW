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
import { ActionQueue } from '../../components/ActionQueue';
import { MemberInsights } from '../../components/charts/MemberInsights';
import { MetricCards } from '../../components/MetricCards';
import { Empty, PageHeader, Panel, Progress, TextLink, useFormat } from '../../components/ui';
import { demoMode } from '../../services/supabase/client';
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
  const toClaim = mine.filter((t) => t.purchasing!.status === 'Purchased' && !t.expenseId);
  const toConfirm = data.payments.filter((p) => !p.manual?.receivedConfirmedAt && data.expenses.some((e) => e.id === p.expenseId));
  const queue = [
    ...toConfirm.map((p) => ({ title: `Confirm you got ${money(p.amount)}`, detail: 'The Treasurer recorded a payment. Check your bank or TNG, then confirm.', to: `/member/claims/${p.expenseId}/payment`, action: 'Confirm' })),
    ...toClaim.map((t) => ({ title: `Claim for ${t.purchasing!.name}`, detail: 'You bought this. Upload the receipt to get paid back.', to: `/member/tasks/${t.id}`, action: 'Start claim' })),
    ...pending.slice(0, 3).map((t) => ({ title: `Buy ${t.purchasing!.name}`, detail: `Budget ${money(t.budget)} · due ${t.purchasing!.dueDate}`, to: `/member/tasks/${t.id}`, action: 'Open' })),
  ];
  return (
    <div className="stack dashboard">
      <PageHeader
        eyebrow="COMMITTEE MEMBER WORKSPACE"
        title={`Hi ${actor.name.split(' ')[0]}`}
        description={demoMode ? 'Your purchases and claims at a glance.' : 'Your purchases and claims at a glance.'}
      >
        <Link className="btn primary" to="/member/tasks">
          View my purchases
        </Link>
      </PageHeader>
      {!data.scopes.length && (
        <Empty title="No active departments assigned">
          Ask your Director to add you to a department.
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
            note: 'Set by your HOD',
            tone: 'violet',
          },
          ...([
          {
            label: 'Waiting for review',
            value: String(awaiting.length).padStart(2, '0'),
            icon: Clock,
            note: 'Not decided yet',
            tone: 'gold',
          },
          {
            label: 'Paid to you',
            value: money(
              data.payments.reduce((s, p) => s + p.amount, 0),
              true,
            ),
            icon: Wallet,
            note: 'Recorded by the Treasurer',
            tone: 'green',
          },
          ]),
        ]}
      />
      <ActionQueue items={queue} clear="Nothing to buy or confirm right now." />
      <MemberInsights tasks={mine} claims={data.expenses} payments={data.payments} />
      <div className="member-counts">
        {[
          ['Not yet bought', pending.length, '/member/tasks'],
          ['Bought', completed.length, '/member/tasks'],
          ...([
          [
            'Approved claims',
            data.expenses.filter((e) => e.state === 'Approved').length,
            '/member/claims',
          ],
          ['Approved, not paid yet', unpaid.length, '/member/claims'],
          ]),
        ].map(([label, value, to]) => (
          <Link key={label} to={String(to)}>
            <span>{label}</span>
            <strong>{String(value).padStart(2, '0')}</strong>
          </Link>
        ))}
      </div>
      <Panel
        title="My upcoming tasks"
        subtitle="Soonest due first"
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
          subtitle="How much your department has bought"
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
                    {done} of {tasks.length} bought
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
        {<Panel
          title="Claim status overview"
          subtitle="Only your own reimbursement records"
          action={<TextLink to="/member/claims">My claims</TextLink>}
        >
          <div className="member-content stack">
            {(demoMode ? ['Pending review', 'In review', 'Approved', 'Declined'] : ['Pending', 'Under Review', 'Approved', 'Rejected', 'Payment Pending', 'Paid', 'Received']).map((state) => (
              <div className="member-status-row" key={state}>
                <span>{state}</span>
                <strong>{data.expenses.filter((e) => (e.lifecycle ?? e.state) === state).length}</strong>
              </div>
            ))}
            <p className="field-hint">
              Approved doesn’t mean paid. When the Treasurer pays you, please confirm you got the
              money.
            </p>
          </div>
        </Panel>}
      </div>
      {<Panel
        title="Recent claims"
        subtitle="Your latest claims"
        action={<TextLink to="/member/claims">All my claims</TextLink>}
      >
        <MemberClaimTable
          claims={[...data.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)}
          data={data}
        />
      </Panel>}
      <Panel
        title="Recent notifications"
        subtitle="Your latest updates"
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
              New tasks and claim updates will show here.{demoMode ? ' and claims' : ''}.
            </Empty>
          )}
        </div>
      </Panel>
    </div>
  );
}
