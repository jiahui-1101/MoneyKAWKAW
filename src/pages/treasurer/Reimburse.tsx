import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import type { PayoutSnapshot, ProofFile } from '../../domain/treasury';
import { departmentToday } from '../../domain/hod';
import { reimbursementService } from '../../services/reimbursements';
import { readProof } from '../../services/payment-proof';
import { Field } from '../../components/Field';
import { DateField } from '../../components/DateField';
import { Badge, Empty, Modal, PageHeader, useFormat } from '../../components/ui';
import { ProofPreview } from '../../components/treasurer/ProofPreview';
import { dataMode, demoMode } from '../../services/supabase/client';

export function TreasuryReimburse() {
  const { id } = useParams();
  const { data, busy, run } = useTreasury();
  const { money, currency } = useFormat();
  const navigate = useNavigate();
  const reviewedDestination = useRef('');
  const claim = data?.expenses.find((e) => e.id === id);
  const paid = data?.payments.some((p) => p.expenseId === id);
  const [payout, setPayout] = useState<PayoutSnapshot | null>(null),
    [payoutError, setPayoutError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [reveal, setReveal] = useState(false),
    [date, setDate] = useState(() => departmentToday(data!.settings.timezone)),
    [reference, setReference] = useState('');
  const [proof, setProof] = useState<ProofFile | null>(null),
    [reading, setReading] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setPayout(null);
    setPayoutError('');
    setReveal(false);
    setConfirmed(false);
    setConfirm(false);
    if (id && claim?.state === 'Approved' && !paid)
      reimbursementService
        .destination(id)
        .then((p) => {
          if (active) {
            if (reviewedDestination.current && reviewedDestination.current !== p.revision)
              setError(
                'The selected payment destination changed. Review the current instructions and reconfirm the transfer details.',
              );
            reviewedDestination.current = p.revision;
            setPayout(p);
          }
        })
        .catch((e) => {
          if (active)
            setPayoutError(e instanceof Error ? e.message : 'Unable to load selected destination.');
        });
    return () => {
      active = false;
    };
  }, [id, claim?.state, claim?.review?.updatedAt, paid, attempt]);
  if (!data || !claim)
    return (
      <Empty title="Claim access restricted">
        This claim is unavailable within your authorized activities.
      </Empty>
    );
  if (claim.state !== 'Approved' || paid)
    return (
      <Empty
        title={paid ? 'A payment is already recorded' : 'Approval is required first'}
        action={
          <Link
            className="btn primary"
            to={paid ? `/treasurer/history?claim=${id}` : `/treasurer/claims/${id}`}
          >
            {paid ? 'View payment record' : 'Back to claim'}
          </Link>
        }
      >
        You can only record payment for an approved claim that hasn’t been paid yet.
      </Empty>
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!date || !reference.trim() || !proof || !confirmed || !payout) {
      setError('Add the payment date, reference number and proof, then tick the confirmation box.');
      return;
    }
    setConfirm(true);
  };
  const save = async () => {
    setError('');
    try {
      await run(
        () =>
          reimbursementService.record(claim.id, {
            destinationRevision: payout?.revision ?? '',
            amount: claim.amount,
            date,
            reference,
            proof: proof!,
            confirmed,
          }),
        'Payment recorded. Waiting for the member to confirm they received it.',
      );
      setConfirm(false);
      navigate(`/treasurer/history?claim=${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t record the payment. Try again.');
      setConfirm(false);
    }
  };
  return (
    <div className="stack">
      <Link className="back-link" to={`/treasurer/claims/${id}`}>
        ← Claim detail / Reimbursement
      </Link>
      <PageHeader
        eyebrow="REIMBURSEMENT"
        title="Record payment"
        description={`${claim.description} · ${money(claim.amount)} approved`}
      />
      <div className="treasury-justification">
        <Badge tone="gold">Paid outside this app</Badge>
        {!demoMode && payout && <Badge tone="neutral">Approved · not paid yet</Badge>}
        <p>
          This app doesn’t send or check bank transfers. The payment details come from the member’s claim.
          {dataMode !== 'supabase' && ' Test mode: use sample details and proof only.'}
          {' '}Recording a payment doesn’t prove the money arrived.
        </p>
      </div>
      <div className="form-layout">
        <form className="panel activity-form" onSubmit={submit} noValidate>
          <div className="form-section">
            <h2>Member’s payment details</h2>
            <p className="field-hint">
              Chosen by the member for this claim. You can’t edit them here.
            </p>
            {payoutError ? (
              <Empty
                title="Couldn’t load payment details"
                action={
                  <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
                    Try again
                  </button>
                }
              >
                {payoutError}
              </Empty>
            ) : !payout ? (
              <p role="status">Loading payment details…</p>
            ) : (
              <>
                <dl className="treasury-payout">
                  {[
                    ['Account holder', payout.holder],
                    ['Method', payout.kind === 'Bank' ? 'Bank account' : 'TNG eWallet'],
                    ['Saved as', payout.label],
                    ['Bank', payout.institution],
                    ['Account / phone no.', reveal ? payout.identifier : payout.masked],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  className="btn"
                  type="button"
                  aria-pressed={reveal}
                  onClick={() => setReveal((v) => !v)}
                >
                  {reveal ? 'Hide account number' : 'Show full account number'}
                </button>
              </>
            )}
          </div>
          <div className="form-section">
            <h2>Payment details</h2>
            <Field id="paid-amount" label={`Amount paid (${currency})`}>
              <input id="paid-amount" readOnly value={(claim.amount / 100).toFixed(2)} />
            </Field>
            <Field id="payment-date" label="Payment date" required>
              <DateField
                id="payment-date"
                calendarLabel="Choose payment date"
                min={claim.date}
                max={departmentToday(data.settings.timezone)}
                value={date}
                onChange={setDate}
              />
            </Field>
            <Field id="payment-reference" label="Reference number" required>
              <input
                id="payment-reference"
                maxLength={120}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="From your bank or TNG receipt"
              />
            </Field>
            <Field id="payment-proof" label="Payment proof" required>
              <input
                id="payment-proof"
                type="file"
                accept={demoMode ? 'image/png,image/jpeg,application/pdf' : 'image/png,image/jpeg'}
                disabled={reading || busy}
                onChange={async (e) => {
                  setProof(null);
                  setError('');
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setReading(true);
                  try {
                    setProof(await readProof(file));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Couldn’t read this file.');
                  } finally {
                    setReading(false);
                  }
                }}
              />
            </Field>
            <p className="field-hint">
              {demoMode ? 'PNG, JPEG, or PDF' : 'PNG or JPEG'} · screenshot of the transfer · max 1 MB
            </p>
            {reading && <p role="status">Checking file…</p>}
            {proof && <ProofPreview proof={proof} />}
            <label className="treasury-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                {dataMode === 'supabase' ? 'I have already sent this money to the member.' :
                  'This is a test, or I have already sent this money to the member.'}
              </span>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="form-actions">
            <Link className="btn" to={`/treasurer/claims/${id}`}>
              Back to claim
            </Link>
            <button className="btn primary" disabled={busy || reading || !payout}>
              {busy ? 'Recording…' : 'Record payment'}
            </button>
          </div>
        </form>
        <aside className="form-aside">
          <h2>What happens next</h2>
          <p>
            Record one full payment per claim. Approving a claim doesn’t pay it.
          </p>
          <p>
            We save the proof, date, amount, reference and your name. The member then confirms they
            received the money.
          </p>
        </aside>
      </div>
      {confirm && (
        <Modal
          title="Record this payment?"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <div className="stack">
            <p>
              {money(claim.amount)} · {reference} · {date}
            </p>
            <p className="settings-copy">
              This saves the payment and proof. You can’t edit it later. The member will be asked to
              confirm they received it.
            </p>
            <div className="form-actions">
              <button className="btn" disabled={busy} onClick={() => setConfirm(false)}>
                Keep editing
              </button>
              <button className="btn primary" disabled={busy} onClick={() => void save()}>
                {busy ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
