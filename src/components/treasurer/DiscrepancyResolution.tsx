import { useState, type FormEvent } from 'react';
import type { Payment } from '../../domain/models';
import { useTreasury } from '../../context/treasury-context';
import { reimbursementService } from '../../services/reimbursements';
import { Field } from '../Field';
export function DiscrepancyResolution({ payment }: { payment: Payment }) {
  const { run, busy } = useTreasury();
  const [note, setNote] = useState(''),
    [error, setError] = useState('');
  if (!payment.manual?.discrepancy || payment.manual.receivedConfirmedAt) return null;
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await run(
        () => reimbursementService.resolveIssue(payment.id, note),
        'Resolution recorded. Member receipt confirmation is still required.',
      );
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to record this resolution.');
    }
  };
  return (
    <form className="stack" onSubmit={save} noValidate>
      <Field id="issue-resolution" label="Resolution / follow-up note" required>
        <textarea
          id="issue-resolution"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe the action taken or the information the member should check."
        />
      </Field>
      <p className="field-hint">
        This app does not transfer money. Keep the original payment and issue report; only the
        claimant can confirm receiving the recorded amount.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary" disabled={busy}>
        {busy ? 'Saving…' : 'Record issue resolution'}
      </button>
    </form>
  );
}
