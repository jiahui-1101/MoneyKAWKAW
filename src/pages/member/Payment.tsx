import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMember } from '../../context/member-context';
import { memberService } from '../../services/member';
import { parseMoney } from '../../domain/budget';
import { paymentState } from '../../domain/risk';
import { demoProfiles } from '../../domain/session';
import type { ProofFile } from '../../domain/treasury';
import { ProofPreview } from '../../components/treasurer/ProofPreview';
import { Field } from '../../components/Field';
import { PaymentIssueResolutions } from '../../components/PaymentIssueResolutions';
import { Badge, Empty, Modal, PageHeader, Panel, paymentLabel, useFormat } from '../../components/ui';
export function MemberPayment() {
  const { id } = useParams(),
    { data, busy, run } = useMember(),
    { money, date, time, currency } = useFormat();
  const claim = data?.expenses.find((e) => e.id === id),
    payment = data?.payments.find((p) => p.expenseId === id);
  const [proof, setProof] = useState<ProofFile | null>(null),
    [proofError, setProofError] = useState(''),
    [attempt, setAttempt] = useState(0),
    [dialog, setDialog] = useState<'confirm' | 'issue' | null>(null),
    [amount, setAmount] = useState(''),
    [reason, setReason] = useState(''),
    [ack, setAck] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setProof(null);
    setProofError('');
    if (payment?.manual)
      memberService
        .proof(payment.id)
        .then((p) => {
          if (active) setProof(p);
        })
        .catch((e) => {
          if (active)
            setProofError(e instanceof Error ? e.message : 'Unable to load payment proof.');
        });
    return () => {
      active = false;
    };
  }, [payment?.id, payment?.manual, attempt]);
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
  const manual = payment?.manual;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    setError('');
    try {
      if (dialog === 'confirm')
        await run(
          () => memberService.confirm(payment.id, parseMoney(amount), ack),
          'Thanks, you confirmed you got the money.',
        );
      else
        await run(
          () =>
            memberService.discrepancy(
              payment.id,
              reason,
              amount.trim() ? parseMoney(amount) : undefined,
            ),
          'Problem reported. The Treasurer will follow up.',
        );
      setDialog(null);
      setReason('');
      setAmount('');
      setAck(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update payment receipt status.');
    }
  };
  return (
    <div className="stack">
      <Link className="back-link" to={`/member/claims/${id}`}>
        ← My claim / Payment & receipt
      </Link>
      <PageHeader
        eyebrow="MY REIMBURSEMENT"
        title="Payment record"
        description={claim.description}
      />
      <div className="treasury-record-bar">
        <Badge tone={manual?.receivedConfirmedAt ? 'green' : 'gold'}>
          {paymentLabel(paymentState(data, claim), 'member')}
        </Badge>
        <Badge tone="neutral">Check your bank or TNG to be sure</Badge>
      </div>
      <Panel
        title="Recorded transfer information"
        subtitle="Approval, payment, and your confirmation are separate steps"
      >
        <dl className="treasury-facts">
          {[
            ['Claim ID', claim.id],
            [
              'Approved claim amount',
              claim.state === 'Approved' ? money(claim.amount) : 'Not approved yet',
            ],
            ['Paid amount', payment ? money(payment.amount) : 'No payment recorded'],
            ['Payment date', payment ? date(payment.date) : 'Awaiting Treasurer'],
            ['Transaction reference', manual?.reference ?? 'Not recorded yet'],
            ['Payment method', manual?.payout.kind ?? 'Not yet available'],
            ['Paid to', manual?.payout.masked ?? 'No recorded destination'],
            [
              'Recorded by',
              demoProfiles.find((p) => p.userId === manual?.recordedBy)?.name ??
                (manual?.recordedBy ? 'Authorized Treasurer' : 'Awaiting Treasurer'),
            ],
            [
              'Receipt confirmed',
              manual?.receivedConfirmedAt
                ? `${time(manual.receivedConfirmedAt)} · you`
                : 'Waiting for you to confirm',
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      {!payment ? (
        <Empty
          title={claim.state === 'Approved' ? 'Not paid yet' : 'Waiting for Treasurer approval'}
          action={
            <Link className="btn" to={`/member/claims/${id}`}>
              View claim status
            </Link>
          }
        >
          You’ll be able to confirm here after the Treasurer pays you.
        </Empty>
      ) : !manual ? (
        <Empty title="Payment details not available">
          This legacy sample has no retained proof or confirmation metadata. No receipt
          acknowledgment is fabricated.
        </Empty>
      ) : (
        <>
          <Panel
            title="Payment proof"
            subtitle="Uploaded by the Treasurer"
          >
            <div className="member-content">
              {proofError ? (
                <Empty
                  title="Proof could not load"
                  action={
                    <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
                      Retry proof
                    </button>
                  }
                >
                  {proofError}
                </Empty>
              ) : proof ? (
                <ProofPreview proof={proof} />
              ) : (
                <p role="status">Loading your payment proof…</p>
              )}
            </div>
          </Panel>
          {manual.discrepancy && (
            <div className="member-payment-issue">
              <Badge tone={manual.discrepancy.resolvedAt ? 'green' : 'danger'}>
                {manual.discrepancy.resolvedAt
                  ? 'Problem solved · you confirmed payment'
                  : 'Payment problem reported'}
              </Badge>
              <p>{manual.discrepancy.reason}</p>
              {manual.discrepancy.receivedAmount !== undefined && (
                <p>Amount reported received: {money(manual.discrepancy.receivedAmount)}</p>
              )}
              <small>Reported {time(manual.discrepancy.reportedAt)}</small>
              <PaymentIssueResolutions issue={manual.discrepancy} />
            </div>
          )}
          {!manual.receivedConfirmedAt ? (
            <div className="member-scope-banner">
              <h2>Did you get the money?</h2>
              <p>
                Only confirm after you see the money in your account. If nothing arrived or the amount
                is wrong, report a problem.
              </p>
              <div className="row wrap">
                <button
                  className="btn primary"
                  disabled={busy || !proof}
                  onClick={() => {
                    setError('');
                    setAmount('');
                    setDialog('confirm');
                  }}
                >
                  Yes, I got it
                </button>
                <button
                  className="btn danger"
                  disabled={busy || !!manual.discrepancy}
                  onClick={() => {
                    setError('');
                    setAmount('');
                    setDialog('issue');
                  }}
                >
                  No, or wrong amount
                </button>
              </div>
            </div>
          ) : (
            <div className="member-scope-banner">
              <Badge tone="green">Received confirmed</Badge>
              <p>
                Your confirmation is saved with your name and the time. Thank you!
              </p>
            </div>
          )}
        </>
      )}
      {dialog && payment && (
        <Modal
          title={
            dialog === 'confirm'
              ? 'Did you get the full amount?'
              : 'Report a payment problem'
          }
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <form className="stack" onSubmit={submit} noValidate>
            <p>
              Recorded transfer: <strong>{money(payment.amount)}</strong> · {date(payment.date)}
            </p>
            <p className="settings-copy">
              {dialog === 'confirm'
                ? manual?.discrepancy
                  ? 'Only confirm if you have now received the full amount. Confirming will close your reported problem.'
                  : 'Only confirm if the money is in your bank or TNG account.'
                : 'Tell the Treasurer what is wrong (for example, nothing arrived or the amount is wrong).'}
            </p>
            <Field
              id="member-received-amount"
              label={`Amount actually received (${currency})`}
              required={dialog === 'confirm'}
            >
              <input
                id="member-received-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={dialog === 'issue' ? 'Optional; use 0 if nothing arrived' : ''}
              />
            </Field>
            {dialog === 'confirm' ? (
              <label className="member-check-field">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>I have actually received the full recorded amount.</span>
              </label>
            ) : (
              <Field id="member-payment-issue" label="What went wrong?" required>
                <textarea
                  id="member-payment-issue"
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button
                className={`btn ${dialog === 'confirm' ? 'primary' : 'danger'}`}
                disabled={busy}
              >
                {busy
                  ? 'Saving…'
                  : dialog === 'confirm'
                    ? 'Yes, I got the money'
                    : 'Send report'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
