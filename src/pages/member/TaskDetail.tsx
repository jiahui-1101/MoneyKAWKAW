import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMember } from '../../context/member-context';
import { memberService } from '../../services/member';
import { draftService } from '../../services/member-drafts';
import type { PurchasingStatus } from '../../domain/models';
import { memberDepartmentPath } from '../../components/member/MemberTables';
import { PurchaseBadge } from '../../components/hod/HodWidgets';
import { Badge, Empty, PageHeader, Panel, Status, useFormat } from '../../components/ui';
import { canPlanActivity, financialStateLabel } from '../../domain/activity-closing';
export function MemberTaskDetail() {
  const { id } = useParams(),
    { data, busy, run } = useMember(),
    { money, date } = useFormat(),
    navigate = useNavigate();
  const [error, setError] = useState('');
  const task = data?.assignments.find((t) => t.id === id);
  if (!data || !task)
    return (
      <Empty
        title="Task access restricted"
        action={
          <Link className="btn" to="/member/tasks">
            My purchases
          </Link>
        }
      >
        You can’t open this purchase. It isn’t in your department.
      </Empty>
    );
  const p = task.purchasing!,
    own = p.assigneeId === data.userId,
    scope = data.scopes.find(
      (s) => s.activity.id === task.activityId && s.department.id === task.departmentId,
    )!;
  const claim = data.expenses.find((e) => e.id === task.expenseId),
    draft = data.drafts.find((d) => d.taskId === task.id);
  const open = canPlanActivity(scope.activity.financialState);
  const closing = scope.activity.financialState === 'Closing';
  const progress = async (status: PurchasingStatus) => {
    setError('');
    try {
      await run(
        () => memberService.progress(task.id, p.updatedAt, status),
        'Your purchasing progress was updated.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update this purchase.');
    }
  };
  const begin = async () => {
    setError('');
    try {
      const draftId = await run(() => draftService.begin(task.id), 'Claim preparation is ready.');
      navigate(`/member/drafts/${draftId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start the claim.');
    }
  };
  return (
    <div className="stack">
      <Link className="back-link" to="/member/tasks">
        ← Purchasing tasks / Purchase detail
      </Link>
      <PageHeader
        eyebrow={`${scope.activity.name.toUpperCase()} · ${scope.department.name.toUpperCase()}`}
        title={p.name}
        description={p.description}
      >
        {own && !task.expenseId && !p.resolvedAtClosure && (open || (closing && draft)) && ['Purchased', 'Completed'].includes(p.status) && (
          <button className="btn primary" disabled={busy} onClick={() => void begin()}>
            {draft ? 'Continue claim draft' : 'Start claim'}
          </button>
        )}
        {claim && (
          <Link className="btn primary" to={`/member/claims/${claim.id}`}>
            View my claim
          </Link>
        )}
      </PageHeader>
      <div className="treasury-record-bar">
        <PurchaseBadge task={task} />
        {!open && <Badge tone="neutral">{financialStateLabel(scope.activity.financialState, '')}</Badge>}
        {p.resolvedAtClosure && <Badge tone="green">Resolved at closing</Badge>}
        <Badge tone={own ? 'green' : 'neutral'}>
          {own ? 'Assigned to you' : 'View only'}
        </Badge>
        {claim && <Status value={claim.state} />}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Panel
        title="Purchase details"
        subtitle="Set by your HOD"
      >
        <dl className="treasury-facts">
          {[
            ['Activity', scope.activity.name],
            ['Department', scope.department.name],
            [
              'Assigned by',
              data.directory.users.find((u) => u.id === p.createdBy)?.name ??
                scope.department.head ??
                'HOD',
            ],
            [
              'Assigned member',
              data.directory.users.find((u) => u.id === p.assigneeId)?.name ?? 'Unassigned',
            ],
            ['Item budget', money(task.budget)],
            ['Due date', date(p.dueDate)],
            ['Priority', p.priority],
            ['Status', p.status],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      {own ? (
        <Panel
          title="My purchasing progress"
          subtitle="Marking it as bought doesn’t send a claim. Start a claim after buying."
        >
          <div className="member-content stack">
            <p className="settings-copy">
              {task.expenseId
                ? 'You’ve already claimed this. Track it in My claims.'
                : p.status === 'Cancelled'
                  ? 'Your HOD cancelled this purchase. No claim can be prepared against it.'
                  : 'Mark it as bought, then start a claim with your receipt.'}
            </p>
            <div className="row wrap">
              {open && !task.expenseId && p.status === 'Not Started' && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => void progress('In Progress')}
                >
                  Start purchase
                </button>
              )}
              {open && !task.expenseId && ['Not Started', 'In Progress'].includes(p.status) && (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => void progress('Purchased')}
                >
                  Mark purchased
                </button>
              )}
              {(open || closing) && !p.resolvedAtClosure && !task.expenseId && p.status === 'Purchased' && (
                <button className="btn" disabled={busy} onClick={() => void progress('Completed')}>
                  Mark as done
                </button>
              )}
              {claim && (
                <Link className="btn" to={`/member/claims/${claim.id}`}>
                  View my claim
                </Link>
              )}
            </div>
          </div>
        </Panel>
      ) : (
        <div className="member-scope-banner">
          <h2>Coordinate with your department</h2>
          <p>
            This assignment belongs to{' '}
            {data.directory.users.find((u) => u.id === p.assigneeId)?.name ??
              'an unassigned team member'}
            . Only they can update it.
          </p>
        </div>
      )}
      <Link className="text-link" to={memberDepartmentPath(task.activityId, task.departmentId)}>
        View department purchasing progress →
      </Link>
    </div>
  );
}
