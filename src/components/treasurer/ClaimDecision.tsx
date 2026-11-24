import { useState, type FormEvent } from 'react';
import type { Expense } from '../../domain/models';
import { useTreasury } from '../../context/treasury-context';
import { treasuryService } from '../../services/treasury';
import { Field } from '../Field';
import { Modal, useFormat } from '../ui';
export function ClaimDecision({
  claim,
  decision,
  onClose,
}: {
  claim: Expense;
  decision: 'Approved' | 'Declined';
  onClose: () => void;
}) {
  const { busy, run } = useTreasury();
  const { money } = useFormat();
  const [reason, setReason] = useState(''),
    [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await run(
        () => treasuryService.decide(claim.id, claim.review!.updatedAt, decision, reason),
        `Claim ${decision.toLowerCase()}. Your decision and risk check were saved.`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to record decision.');
    }
  };
  return (
    <Modal
      title={decision === 'Approved' ? 'Approve this claim?' : 'Decline this claim?'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="stack" onSubmit={submit} noValidate>
        <p>
          {claim.description} · <strong>{money(claim.amount)}</strong>
        </p>
        <p className="settings-copy">
          {decision === 'Approved'
            ? 'Check the original receipt, any edits and the budget impact. Approving means the club owes this amount. It does not mark it as paid.'
            : 'The member will see this reason in My claims. The claim and receipt stay in the history.'}
        </p>
        <Field
          id="decision-reason"
          label={decision === 'Declined' ? 'Reason for declining' : 'Note (optional)'}
          required={decision === 'Declined'}
        >
          <textarea
            id="decision-reason"
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!error}
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="btn" type="button" disabled={busy} onClick={onClose}>
            Keep reviewing
          </button>
          <button
            className={`btn ${decision === 'Approved' ? 'primary' : 'danger'}`}
            disabled={busy}
          >
            {busy
              ? 'Recording decision…'
              : decision === 'Approved'
                ? 'Confirm approval'
                : 'Confirm decline'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
