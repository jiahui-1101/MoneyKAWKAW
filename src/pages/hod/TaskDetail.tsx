import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useHod } from '../../context/hod-context';
import { departmentToday, isOverdue } from '../../domain/hod';
import { hodService } from '../../services/hod';
import { nextPurchasingStates } from '../../services/hod-tasks';
import { MetricCards } from '../../components/MetricCards';
import { PurchaseBadge, useDepartmentScope } from '../../components/hod/HodWidgets';
import { Badge, Empty, Modal, PageHeader, Panel, Status, useFormat } from '../../components/ui';

export function HodTaskDetail() {
  const { taskId } = useParams();
  const { data, scope, tasks, base } = useDepartmentScope();
  const { run, busy } = useHod();
  const { money, date, time } = useFormat();
  const [error, setError] = useState('');
  const [cancel, setCancel] = useState(false);
  const task = tasks.find((t) => t.id === taskId);
  if (!task)
    return (
      <Empty
        title="Purchasing task unavailable"
        action={
          <Link className="btn primary" to={`${base}/tasks`}>
            Back to my tasks
          </Link>
        }
      >
        This task is not available in your assigned department.
      </Empty>
    );
  const p = task.purchasing!;
  const claim = data.expenses.find((e) => e.id === task.expenseId);
  const paid = data.payments
    .filter((payment) => payment.expenseId === claim?.id)
    .reduce((sum, p) => sum + p.amount, 0);
  const variance = claim ? claim.amount - task.budget : 0;
  const editable = !task.expenseId && p.status !== 'Cancelled';
  const overdue = isOverdue(task, departmentToday(data.settings.timezone));
  const events = data.events.filter((e) => e.assignmentId === task.id);
  return (
    <div className="stack">
      <Link className="back-link" to={`${base}/tasks`}>
        <ArrowLeft size={15} />
        Purchasing tasks <span>/</span> Task details
      </Link>
      <PageHeader
        eyebrow={`${scope.department.name.toUpperCase()} · PURCHASING TASK`}
        title={p.name}
        description={`${scope.activity.name} · Assigned to ${data.directory.users.find((u) => u.id === p.assigneeId)?.name ?? 'no member yet'}`}
      >
        {editable && (
          <Link className="btn" to={`${base}/tasks/${task.id}/edit`}>
            <Pencil size={14} />
            Edit / reassign
          </Link>
        )}
      </PageHeader>
      <div className="row wrap">
        <PurchaseBadge task={task} />
        <Badge tone={p.priority === 'High' ? 'danger' : 'gold'}>{p.priority} priority</Badge>
        {overdue && <Badge tone="danger">Overdue purchase</Badge>}
        {claim && <Status value={claim.state} />}
      </div>
      <MetricCards
        items={[
          {
            label: 'Estimated item budget',
            value: money(task.budget),
            icon: Wallet,
            note: 'Reserved purchasing estimate',
            tone: 'brand',
          },
          {
            label: 'Recorded claim amount',
            value: claim ? money(claim.amount) : 'No claim',
            icon: CircleDollarSign,
            note: claim ? 'Fictional shared expense record' : 'No expense has been recorded',
            tone: 'violet',
          },
          {
            label: 'Variance against estimate',
            value: claim ? `${variance > 0 ? '+' : ''}${money(variance)}` : '—',
            icon: Clock,
            note: claim
              ? variance > 0
                ? 'Claim exceeds the item estimate'
                : 'Claim is within the item estimate'
              : 'Available when a claim is recorded',
            tone: variance > 0 ? 'danger' : 'green',
          },
          {
            label: 'Reimbursement recorded',
            value: money(paid),
            icon: CheckCircle2,
            note: paid ? 'Sample payment history' : 'Purchase completion is not payment',
            tone: 'green',
          },
        ]}
      />
      {variance > 0 && (
        <div className="form-error" role="status">
          The recorded claim is {money(variance)} over this item’s estimate. The Treasurer reviews
          the claim and any over-budget reason. No approval or payment action is available here.
        </div>
      )}
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      <div className="hod-two-columns">
        <Panel title="The purchase brief" subtitle="Clear context for the person doing the buying">
          <div className="panel-body stack">
            <p className="activity-description">{p.description}</p>
            <dl className="task-facts">
              <div>
                <dt>Assigned member</dt>
                <dd>
                  {data.directory.users.find((u) => u.id === p.assigneeId)?.name ?? 'Unassigned'}
                </dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd className={overdue ? 'danger-text' : ''}>{date(p.dueDate)}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{p.priority}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{time(p.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </Panel>
        <Panel
          title="Purchase progress"
          subtitle="Track procurement without changing reimbursement"
        >
          <div className="panel-body stack">
            <p className="settings-copy">
              {claim
                ? 'This task is linked to a submitted claim. Its purchasing details and status are protected.'
                : p.status === 'Completed'
                  ? 'The purchase is complete. Its estimated budget stays reserved until a claim is recorded or the plan is explicitly cancelled.'
                  : p.status === 'Cancelled'
                    ? 'This plan was cancelled. Its estimate is excluded from active purchasing commitments.'
                    : 'Update the purchasing stage as the work progresses. No claim or payment is created by this action.'}
            </p>
            {editable && (
              <div className="row wrap">
                {(nextPurchasingStates[p.status] ?? []).map((status) => (
                  <button
                    className="btn primary"
                    key={status}
                    disabled={busy}
                    onClick={async () => {
                      setError('');
                      try {
                        await run(
                          () =>
                            hodService.transition(
                              scope.activity.id,
                              scope.department.id,
                              task.id,
                              status,
                              p.updatedAt,
                            ),
                          `Purchasing stage updated to ${status}.`,
                        );
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : 'Unable to update purchasing progress.',
                        );
                      }
                    }}
                  >
                    {status === 'Completed' ? 'Complete purchase' : `Mark ${status}`}
                  </button>
                ))}
              </div>
            )}
            {editable && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  setError('');
                  setCancel(true);
                }}
              >
                <Trash2 size={14} />
                Cancel purchasing task
              </button>
            )}
          </div>
        </Panel>
      </div>
      <Panel
        title="Claim & reimbursement"
        subtitle="Monitoring only · sample records are fictional"
      >
        <div className="panel-body">
          <dl className="task-facts claim-facts">
            <div>
              <dt>Claim source</dt>
              <dd>{claim?.id ?? 'No submitted claim'}</dd>
            </div>
            <div>
              <dt>Review state</dt>
              <dd>
                {claim ? (
                  <Status value={claim.state} />
                ) : (
                  <span className="muted">Not submitted</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Payment state</dt>
              <dd>{paid ? `${money(paid)} recorded` : 'Not paid'}</dd>
            </div>
            <div>
              <dt>Unreimbursed claim amount</dt>
              <dd>{claim ? money(claim.amount - paid) : '—'}</dd>
            </div>
          </dl>
          <p className="data-note">
            HODs cannot approve claims, run risk reviews, record payments, or view payout account
            details.
          </p>
        </div>
      </Panel>
      <Panel
        title="Task history"
        subtitle="Creation, reassignment, and progress changes are preserved"
      >
        <div className="timeline">
          {events.map((e) => (
            <div className="timeline-item" key={e.id}>
              <span className="timeline-icon">
                <Clock size={15} />
              </span>
              <div>
                <h3>{e.action}</h3>
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
            <Empty title="Sample task history">
              This task comes from the fictional shared fixture. New department changes are recorded
              here.
            </Empty>
          )}
        </div>
      </Panel>
      {cancel && (
        <Modal title="Cancel this purchasing task?" onClose={() => setCancel(false)}>
          <p>
            Cancel only if the purchase was not made or has been reversed. This releases the{' '}
            {money(task.budget)} estimate from active commitments, preserves the task and history,
            and does not create or change a claim.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="btn" onClick={() => setCancel(false)}>
              Keep purchasing task
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                try {
                  await run(
                    () =>
                      hodService.cancel(
                        scope.activity.id,
                        scope.department.id,
                        task.id,
                        p.updatedAt,
                      ),
                    'Purchasing task cancelled. Its estimate is available again.',
                  );
                  setCancel(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Unable to cancel purchasing task.');
                }
              }}
            >
              Cancel task
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
