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
import { Badge, Empty, Modal, PageHeader, Panel, useFormat } from '../../components/ui';
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
        Reimbursement records are available only for your own active-department claims.
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
          'Receipt confirmed by you. The shared reimbursement record is updated.',
        );
      else
        await run(
          () =>
            memberService.discrepancy(
              payment.id,
              reason,
              amount.trim() ? parseMoney(amount) : undefined,
            ),
          'Payment issue recorded. Receipt remains unconfirmed.',
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
        title="Evidence of payment. Your acknowledgment."
        description={claim.description}
      />
      <div className="treasury-record-bar">
        <Badge tone={manual?.receivedConfirmedAt ? 'green' : 'gold'}>
          {paymentState(data, claim)}
        </Badge>
        <Badge tone="neutral">External transfer not independently verified</Badge>
      </div>
      <Panel
        title="Recorded transfer information"
        subtitle="Approval, manual transfer recording, and your receipt acknowledgment are separate events"
      >
        <dl className="treasury-facts">
          {[
            [
              'Approved claim amount',
              claim.state === 'Approved' ? money(claim.amount) : 'Not approved',
            ],
            ['Paid amount', payment ? money(payment.amount) : 'No payment recorded'],
            ['Payment date', payment ? date(payment.date) : 'Awaiting Treasurer'],
            ['Transaction reference', manual?.reference ?? 'Not retained / not yet recorded'],
            ['Payment method', manual?.payout.kind ?? 'Not yet available'],
            ['Used destination', manual?.payout.masked ?? 'No recorded destination'],
            [
              'Recorded by',
              demoProfiles.find((p) => p.userId === manual?.recordedBy)?.name ??
                'Not retained / awaiting Treasurer',
            ],
            [
              'Receipt confirmed',
              manual?.receivedConfirmedAt
                ? `${time(manual.receivedConfirmedAt)} · you`
                : 'Awaiting your acknowledgment',
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
          title={claim.state === 'Approved' ? 'Payment is pending' : 'Treasurer review comes first'}
          action={
            <Link className="btn" to={`/member/claims/${id}`}>
              View claim status
            </Link>
          }
        >
          There is no recorded transfer to acknowledge. You can confirm only after a manual payment
          is recorded and you have actually received it.
        </Empty>
      ) : !manual ? (
        <Empty title="Historical payment metadata is unavailable">
          This legacy sample has no retained proof or confirmation metadata. No receipt
          acknowledgment is fabricated.
        </Empty>
      ) : (
        <>
          <Panel
            title="Preserved payment proof"
            subtitle="Uploaded by the authorized Treasurer for this claim"
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
                  ? 'Reported issue retained · resolved by receipt acknowledgment'
                  : 'Payment discrepancy reported'}
              </Badge>
              <p>{manual.discrepancy.reason}</p>
              {manual.discrepancy.receivedAmount !== undefined && (
                <p>Amount reported received: {money(manual.discrepancy.receivedAmount)}</p>
              )}
              <small>Reported {time(manual.discrepancy.reportedAt)}</small>
            </div>
          )}
          {!manual.receivedConfirmedAt ? (
            <div className="member-scope-banner">
              <h2>Confirm only after receiving the money.</h2>
              <p>
                If the transfer has not arrived or the amount differs, keep it awaiting confirmation
                or report the issue. A local proof record alone does not establish delivery.
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
                  Confirm received
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
                  Report payment issue
                </button>
              </div>
            </div>
          ) : (
            <div className="member-scope-banner">
              <Badge tone="green">Received confirmed</Badge>
              <p>
                Your acknowledgment is retained with your identity and time. No duplicate
                confirmation is available.
              </p>
            </div>
          )}
        </>
      )}
      {dialog && payment && (
        <Modal
          title={
            dialog === 'confirm'
              ? 'Confirm the reimbursement was received?'
              : 'Report a payment discrepancy'
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
                  ? 'Confirm only if you have now received the full amount. This acknowledgment resolves your reported issue while retaining its original report.'
                  : 'Your acknowledgment records receipt; it does not independently verify a bank transaction.'
                : 'Describe the missing or different payment. Your claim stays awaiting confirmation and the Treasurer can see your report.'}
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
                Keep awaiting confirmation
              </button>
              <button
                className={`btn ${dialog === 'confirm' ? 'primary' : 'danger'}`}
                disabled={busy}
              >
                {busy
                  ? 'Saving…'
                  : dialog === 'confirm'
                    ? 'Confirm receipt acknowledgment'
                    : 'Save discrepancy report'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
