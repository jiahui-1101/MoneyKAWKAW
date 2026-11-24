import { CheckCircle2 } from 'lucide-react';
import type { Expense, Payment } from '../domain/models';

const stages = ['Waiting for review', 'In review', 'Approved · not paid yet', 'Paid · waiting for member', 'Member confirmed'];
const nextStage = ['In review', 'Approve or decline', 'Payment', 'Member confirms', ''];

/** Where a claim is: 0 waiting → 4 member confirmed. Declined claims stop at step 3. */
export function claimStep(claim: Pick<Expense, 'state'>, payments: Pick<Payment, 'manual'>[]) {
  if (claim.state === 'Declined') return 2;
  if (payments.some((p) => p.manual?.receivedConfirmedAt)) return 4;
  if (payments.length) return 3;
  return claim.state === 'Approved' ? 2 : claim.state === 'In review' ? 1 : 0;
}

/** Incident-style progress: segmented bar, "Step x of 5", and what happens next. */
export function ClaimProgress({ claim, payments, next }: {
  claim: Pick<Expense, 'state'>;
  payments: Pick<Payment, 'manual'>[];
  next: { title: string; detail: string };
}) {
  const declined = claim.state === 'Declined';
  const step = claimStep(claim, payments);
  const total = declined ? 3 : stages.length;
  const current = declined ? 'Declined' : stages[step];
  const done = declined || step === stages.length - 1;
  return (
    <section className="panel claim-progress" aria-label="Claim progress">
      <span className="eyebrow">Progress</span>
      <div className="row between wrap">
        <strong>{current}</strong>
        <span className="muted">Step {step + 1} of {total}</span>
      </div>
      <ol className={`claim-progress-bar${declined ? ' is-declined' : ''}`}>
        {Array.from({ length: total }, (_, i) => (
          <li key={i} className={i < step ? 'done' : i === step ? 'current' : ''}>
            <span className="sr-only">{declined && i === 2 ? 'Declined' : stages[i]}</span>
          </li>
        ))}
      </ol>
      {!done && <p className="muted">Next: {nextStage[step]}</p>}
      <span className="eyebrow">What to do next</span>
      <div className="claim-next">
        {done ? <CheckCircle2 size={20} aria-hidden /> : <span className="claim-next-num" aria-hidden>1</span>}
        <div>
          <strong>{next.title}</strong>
          <p className="muted">{next.detail}</p>
        </div>
      </div>
    </section>
  );
}
