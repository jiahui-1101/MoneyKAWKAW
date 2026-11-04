import { Link, useParams } from 'react-router-dom';
import { useMember } from '../../context/member-context';
import { demoProfiles } from '../../domain/session';
import { paymentState } from '../../domain/risk';
import { memberClaimService } from '../../services/member-claims';
import { ReceiptReview } from '../../components/treasurer/ReceiptReview';
import { ClaimDestination } from '../../components/member/ClaimDestination';
import { Badge, Empty, PageHeader, Panel, Status, useFormat } from '../../components/ui';
export function MemberClaimDetail() {
  const { id } = useParams(),
    { data } = useMember(),
    { money, time } = useFormat();
  const claim = data?.expenses.find((e) => e.id === id);
  if (!data || !claim)
    return (
      <Empty
        title="Claim access restricted"
        action={
          <Link className="btn" to="/member/claims">
            My claims
          </Link>
        }
      >
        Only your own claims in active departments are available here.
      </Empty>
    );
  const task = data.assignments.find((t) => t.expenseId === claim.id),
    scope = data.scopes.find(
      (s) => s.activity.id === claim.activityId && s.department.id === claim.departmentId,
    )!;
  const payments = data.payments.filter((p) => p.expenseId === claim.id),
    events = data.events.filter((e) => e.assignmentId === task?.id);
  const state = paymentState(data, claim);
  const stage =
    claim.state === 'Declined'
      ? 1
      : payments.some((p) => p.manual?.receivedConfirmedAt)
        ? 4
        : payments.length
          ? 3
          : claim.state === 'Approved'
            ? 2
            : claim.state === 'In review'
              ? 1
              : 0;
  return (
    <div className="stack">
      <Link className="back-link" to="/member/claims">
        ← My claims / Claim detail
      </Link>
      <PageHeader
        eyebrow={`MY CLAIM · ${claim.id}`}
        title={claim.description}
        description={`${scope.activity.name} / ${scope.department.name}`}
      >
        <Link className="btn primary" to={`/member/claims/${claim.id}/payment`}>
          {payments.length ? 'View payment proof & receipt status' : 'View reimbursement status'}
        </Link>
      </PageHeader>
      <div className="treasury-record-bar">
        <Status value={claim.state} />
        <Badge
          tone={
            state === 'Received confirmed'
              ? 'green'
              : claim.state === 'Declined'
                ? 'danger'
                : 'gold'
          }
        >
          {state}
        </Badge>
      </div>
      <ol className="member-state-steps" aria-label="Claim lifecycle">
        {['Submitted', 'Treasurer review', 'Approved / unpaid', 'Payment recorded', 'Received'].map(
          (label, i) => (
            <li key={label} className={i === stage ? 'current' : i < stage ? 'done' : ''}>
              <span>{i + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>
      <Panel
        title="Your submitted claim"
        subtitle="These values and the original receipt are protected after submission"
      >
        <dl className="treasury-facts">
          {[
            ['Final claimed amount', money(claim.amount)],
            ['Item budget', task ? money(task.budget) : 'Legacy task unavailable'],
            ['Submitted', time(claim.review?.submittedAt ?? claim.date)],
            ['Purchasing task', task?.purchasing?.name ?? 'Legacy source'],
            ['Treasurer decision', claim.state],
            [
              'Reviewer',
              demoProfiles.find((p) => p.userId === claim.review?.reviewer)?.name ??
                'Awaiting review',
            ],
            [
              'Decision time',
              claim.review?.reviewedAt ? time(claim.review.reviewedAt) : 'Awaiting decision',
            ],
            ['Payments recorded', money(payments.reduce((s, p) => s + p.amount, 0))],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <div className={`treasury-justification ${claim.state === 'Declined' ? 'is-declined' : ''}`}>
        <span className="eyebrow">YOUR PURCHASE CONTEXT</span>
        <p>
          {claim.review?.justification || 'No explanation was retained for this legacy record.'}
        </p>
        {claim.review?.reason && (
          <>
            <h2>{claim.state} · Treasurer’s reason</h2>
            <p>{claim.review.reason}</p>
          </>
        )}
      </div>
      <ClaimDestination claim={claim} />
      <ReceiptReview claimId={claim.id} amount={claim.amount} load={memberClaimService.receipt} />
      <Panel title="Claim status timeline" subtitle="Actual shared events, actors, and timestamps">
        <div className="treasury-evidence-history">
          <article>
            <h3>Claim submitted</h3>
            <p>
              {time(claim.review?.submittedAt ?? claim.date)} · {money(claim.amount)} requested
            </p>
          </article>
          {events.map((e) => (
            <article key={e.id}>
              <div className="row between wrap">
                <h3>{e.action}</h3>
                <small>
                  {e.actor} · {time(e.at)}
                </small>
              </div>
              <details>
                <summary>View event details</summary>
                <p>{e.detail}</p>
              </details>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
