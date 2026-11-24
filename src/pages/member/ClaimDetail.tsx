import { Link, useParams } from 'react-router-dom';
import { useMember } from '../../context/member-context';
import { demoProfiles } from '../../domain/session';
import { paymentState } from '../../domain/risk';
import { memberClaimService } from '../../services/member-claims';
import { ReceiptReview } from '../../components/treasurer/ReceiptReview';
import { ClaimDestination } from '../../components/member/ClaimDestination';
import { ClaimProgress, claimStep } from '../../components/ClaimProgress';
import { Badge, Empty, PageHeader, Panel, Status, paymentLabel, useFormat } from '../../components/ui';
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
        You can only open your own claims.
      </Empty>
    );
  const task = data.assignments.find((t) => t.expenseId === claim.id),
    scope = data.scopes.find(
      (s) => s.activity.id === claim.activityId && s.department.id === claim.departmentId,
    )!;
  const payments = data.payments.filter((p) => p.expenseId === claim.id),
    events = data.events.filter((e) => e.assignmentId === task?.id);
  const state = paymentState(data, claim);
  const step = claimStep(claim, payments);
  const next = claim.state === 'Declined'
    ? { title: 'Read the Treasurer’s reason', detail: 'This claim was declined. The reason is shown below.' }
    : [
        { title: 'Wait for the Treasurer', detail: 'Your claim is in the queue. You’ll get a notification when it is reviewed.' },
        { title: 'Wait for a decision', detail: 'The Treasurer is checking your receipt and the budget.' },
        { title: 'Wait for payment', detail: 'Approved means the club owes you. The Treasurer will pay you and upload proof.' },
        { title: 'Confirm you got the money', detail: 'Check your bank or TNG, then confirm on the payment page.' },
        { title: 'All done', detail: 'You confirmed you received the money.' },
      ][step];
  return (
    <div className="stack">
      <Link className="back-link" to="/member/claims">
        ← Back to my claims
      </Link>
      <PageHeader
        eyebrow={`MY CLAIM · ${claim.id}`}
        title={claim.description}
        description={`${scope.activity.name} / ${scope.department.name}`}
      >
        {<Link className="btn primary" to={`/member/claims/${claim.id}/payment`}>
          {payments.length ? 'See payment & confirm you got it' : 'See payment status'}
        </Link>}
      </PageHeader>
      <div className="treasury-record-bar">
        <Status value={claim.lifecycle ?? claim.state} />
        <Badge
          tone={
            state === 'Received confirmed'
              ? 'green'
              : claim.state === 'Declined'
                ? 'danger'
                : 'gold'
          }
        >
          {paymentLabel(state, 'member')}
        </Badge>
      </div>
      <ClaimProgress claim={claim} payments={payments} next={next} />
      <Panel
        title="Your submitted claim"
        subtitle="Locked after you submitted"
      >
        <dl className="treasury-facts">
          {[
            ['Final claimed amount', money(claim.amount)],
            ['Item budget', task ? money(task.budget) : '—'],
            ['Submitted', time(claim.review?.submittedAt ?? claim.date)],
            ['Purchasing task', task?.purchasing?.name ?? '—'],
            ['Status', claim.state],
            [
              'Reviewer',
              demoProfiles.find((p) => p.userId === claim.review?.reviewer)?.name ??
                (claim.review?.reviewer ? 'Treasurer' : 'Awaiting review'),
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
          {claim.review?.justification || 'No note added.'}
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
      <Panel title="Claim status timeline" subtitle="What happened and when">
        <div className="treasury-evidence-history">
          {!events.some((e) => e.action === 'Claim submitted') && <article>
            <h3>Claim submitted</h3>
            <p>
              {time(claim.review?.submittedAt ?? claim.date)} · {money(claim.amount)} requested
            </p>
          </article>}
          {events.map((e) => (
            <article key={e.id}>
              <div className="row between wrap">
                <h3>{e.action}</h3>
                <small>
                  {e.actor} · {time(e.at)}
                </small>
              </div>
              <details>
                <summary>Details</summary>
                <p>{e.detail}</p>
              </details>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
