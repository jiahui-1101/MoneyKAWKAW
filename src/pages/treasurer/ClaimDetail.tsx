import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { claimContext, paymentState } from '../../domain/risk';
import { summarize } from '../../domain/budget';
import { demoProfiles } from '../../domain/session';
import { treasuryService } from '../../services/treasury';
import { ReceiptReview } from '../../components/treasurer/ReceiptReview';
import { ClaimDecision } from '../../components/treasurer/ClaimDecision';
import { ClaimProgress, claimStep } from '../../components/ClaimProgress';
import { Badge, Empty, PageHeader, Panel, Status, TextLink, paymentLabel, useFormat } from '../../components/ui';
import { demoMode } from '../../services/supabase/client';
export function TreasuryClaimDetail() {
  const { id } = useParams();
  const { data, busy, run } = useTreasury();
  const { money, time } = useFormat();
  const [error, setError] = useState(''),
    [decision, setDecision] = useState<'Approved' | 'Declined' | null>(null),
    [destination, setDestination] = useState<Awaited<ReturnType<typeof treasuryService.destination>> | null>(null);
  const claim = data?.expenses.find((e) => e.id === id);
  const claimId = claim?.id;
  useEffect(() => {
    let active = true;
    if (demoMode || !claimId) { setDestination(null); return () => { active = false; }; }
    treasuryService.destination(claimId).then((value) => { if (active) setDestination(value); })
      .catch(() => { if (active) setDestination(null); });
    return () => { active = false; };
  }, [claimId]);
  if (!data || !claim)
    return (
      <Empty
        title="Claim not found"
        action={
          <Link className="btn" to="/treasurer/claims">
            Back to claims
          </Link>
        }
      >
        This claim doesn’t exist or isn’t in an activity you manage.
      </Empty>
    );
  const c = claimContext(data, claim);
  const dep = summarize(data, claim.activityId, claim.departmentId);
  const claimPayments = data.payments.filter((p) => p.expenseId === claim.id);
  const paid = claimPayments.length > 0;
  const nextSteps = [
    { title: 'Start the review', detail: 'Open the review so the member knows you are checking the receipt.' },
    { title: 'Approve or decline', detail: c.variance > 0 ? 'This claim is over its item budget. Run the budget check before you approve.' : 'Check the receipt below, then approve or decline.' },
    { title: 'Pay the member, then record it', detail: 'Send the money through your bank or TNG, then record the payment with proof.' },
    { title: 'Wait for the member to confirm', detail: 'Only the member can confirm the money arrived.' },
    { title: 'All done', detail: 'The member confirmed they received the money.' },
  ];
  const next = claim.state === 'Declined'
    ? { title: 'All done', detail: 'This claim was declined. The member can see your reason.' }
    : nextSteps[claimStep(claim, claimPayments)];
  const events = data.events.filter(
    (e) => (c.task && e.assignmentId === c.task.id) || e.detail.includes(claim.id),
  );
  const review = async () => {
    setError('');
    try {
      await run(
        () => treasuryService.review(claim.id, claim.review!.updatedAt),
        'Claim is now in review.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start review.');
    }
  };
  return (
    <div className="stack">
      <Link className="back-link" to="/treasurer/claims">
        ← Back to claims
      </Link>
      <PageHeader
        eyebrow={`CLAIM · ${claim.id}`}
        title={claim.description}
        description={`${c.activity.name} / ${c.department.name}`}
      >
        {<Link className="btn" to={`/treasurer/claims/${id}/risk`}>
          Check budget risk
        </Link>}
        {claim.state === 'Pending review' && (
          <button className="btn primary" disabled={busy} onClick={() => void review()}>
            Start review
          </button>
        )}
        {claim.state === 'In review' && (
          <>
            <button className="btn danger" disabled={busy} onClick={() => setDecision('Declined')}>
              Decline claim
            </button>
            <button className="btn primary" disabled={busy} onClick={() => setDecision('Approved')}>
              Approve claim
            </button>
          </>
        )}
        {claim.state === 'Approved' &&
          (paid ? (
            <TextLink to={`/treasurer/history?claim=${id}`}>View payment record</TextLink>
          ) : (
            <Link className="btn primary" to={`/treasurer/claims/${id}/reimburse`}>
              Record payment
            </Link>
          ))}
      </PageHeader>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="treasury-record-bar">
        <Status value={claim.lifecycle ?? claim.state} />
        <Badge tone={paid ? 'green' : 'neutral'}>{paymentLabel(paymentState(data, claim))}</Badge>
        <span>Submitted {time(claim.review?.submittedAt ?? claim.date)}</span>
      </div>
      <ClaimProgress claim={claim} payments={claimPayments} next={next} />
      <Panel
        title="Claim summary"
        subtitle="What the member claimed vs. the planned budget"
      >
        <dl className="treasury-facts">
          {[
            [
              'Submitted by',
              data.directory?.users.find((u) => u.id === claim.review?.claimantId)?.name ??
                'Member unknown',
            ],
            ['Purchase', c.task?.purchasing?.name ?? 'No linked purchase'],
            ['Item budget', c.task ? money(c.task.budget) : 'Unavailable'],
            ['Amount claimed', money(claim.amount)],
            ['Over / under item budget', `${money(c.variance)} (${c.variancePercent.toFixed(2)}%)`],
            ['Department free to spend', money(dep.available)],
            [
              'Reviewer',
              data.directory?.users.find((u) => u.id === claim.review?.reviewer)?.name ??
              demoProfiles.find((p) => p.userId === claim.review?.reviewer)?.name ??
                'Review not started',
            ],
            [
              'Decision time',
              claim.review?.reviewedAt ? time(claim.review.reviewedAt) : 'Not decided yet',
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <div className="treasury-justification">
        <span className="eyebrow">MEMBER’S EXPLANATION</span>
        <h2>{c.variance > 0 ? 'Why it is over budget' : 'Why this was bought'}</h2>
        <p>
          {claim.review?.justification || 'The member gave no explanation.'}
        </p>
      </div>
      {!demoMode && destination && <Panel title="Member’s payment details" subtitle="Partly hidden. Full details appear only when you record the payment.">
        <dl className="treasury-facts"><div><dt>Label</dt><dd>{destination.label}</dd></div>
          <div><dt>Type</dt><dd>{destination.kind}</dd></div>
          <div><dt>Account holder</dt><dd>{destination.holder}</dd></div>
          <div><dt>Bank</dt><dd>{destination.institution}</dd></div>
          <div><dt>Account / phone no.</dt><dd>{destination.masked}</dd></div></dl>
      </Panel>}
      {claim.review?.reason && (
        <div className={`treasury-decision ${claim.state === 'Declined' ? 'is-declined' : ''}`}>
          <h2>Reason for {claim.state === 'Declined' ? 'declining' : 'approving'}</h2>
          <p>{claim.review.reason}</p>
        </div>
      )}
      <ReceiptReview claimId={claim.id} amount={claim.amount} />
      <Panel
        title="Claim history"
        subtitle="Every step is logged and can’t be edited"
      >
        <div className="treasury-evidence-history">
          {!events.some((e) => e.action === 'Claim submitted') && <article>
            <h3>Claim submitted</h3>
            <p>
              {time(claim.review?.submittedAt ?? claim.date)} · {money(claim.amount)} · original
              receipt and the member’s edits are kept.
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
              <p>{e.detail}</p>
            </article>
          ))}
        </div>
      </Panel>
      {decision && (
        <ClaimDecision claim={claim} decision={decision} onClose={() => setDecision(null)} />
      )}
    </div>
  );
}
