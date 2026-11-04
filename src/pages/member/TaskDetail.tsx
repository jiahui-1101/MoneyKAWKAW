import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMember } from '../../context/member-context';
import { memberService } from '../../services/member';
import { draftService } from '../../services/member-drafts';
import type { PurchasingStatus } from '../../domain/models';
import { memberDepartmentPath } from '../../components/member/MemberTables';
import { PurchaseBadge } from '../../components/hod/HodWidgets';
import { Badge, Empty, PageHeader, Panel, Status, useFormat } from '../../components/ui';
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
        This purchase is outside your current department memberships.
      </Empty>
    );
  const p = task.purchasing!,
    own = p.assigneeId === data.userId,
    scope = data.scopes.find(
      (s) => s.activity.id === task.activityId && s.department.id === task.departmentId,
    )!;
  const claim = data.expenses.find((e) => e.id === task.expenseId),
    draft = data.drafts.find((d) => d.taskId === task.id);
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
        {own && !task.expenseId && ['Purchased', 'Completed'].includes(p.status) && (
          <button className="btn primary" disabled={busy} onClick={() => void begin()}>
            {draft ? 'Continue claim draft' : 'Prepare reimbursement claim'}
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
        <Badge tone={own ? 'green' : 'neutral'}>
          {own ? 'Assigned to you' : 'Read-only coordination'}
        </Badge>
        {claim && <Status value={claim.state} />}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Panel
        title="The HOD’s purchasing brief"
        subtitle="Assignment purpose, budget, assignee, and deadline are controlled by the HOD"
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
            ['Estimated item budget', money(task.budget)],
            ['Due date', date(p.dueDate)],
            ['Priority', p.priority],
            ['Purchase stage', p.status],
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
          subtitle="Completing a purchase never approves a claim or records reimbursement"
        >
          <div className="member-content stack">
            <p className="settings-copy">
              {task.expenseId
                ? 'This purchase has a submitted claim. Its original assignment and claim evidence are protected. Follow the Treasurer’s decision and payment updates in My claims.'
                : p.status === 'Cancelled'
                  ? 'Your HOD cancelled this purchase. No claim can be prepared against it.'
                  : 'Update the physical purchase, then prepare a receipt-backed claim. Your HOD still controls the assignment details.'}
            </p>
            <div className="row wrap">
              {!task.expenseId && p.status === 'Not Started' && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => void progress('In Progress')}
                >
                  Start purchase
                </button>
              )}
              {!task.expenseId && ['Not Started', 'In Progress'].includes(p.status) && (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => void progress('Purchased')}
                >
                  Mark purchased
                </button>
              )}
              {!task.expenseId && p.status === 'Purchased' && (
                <button className="btn" disabled={busy} onClick={() => void progress('Completed')}>
                  Complete purchase checklist
                </button>
              )}
              {claim && (
                <Link className="btn" to={`/member/claims/${claim.id}`}>
                  Track reimbursement
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
            . You can view the purchasing plan; updates and private claim details belong to its
            owner.
          </p>
        </div>
      )}
      <Link className="text-link" to={memberDepartmentPath(task.activityId, task.departmentId)}>
        View department purchasing progress →
      </Link>
    </div>
  );
}
