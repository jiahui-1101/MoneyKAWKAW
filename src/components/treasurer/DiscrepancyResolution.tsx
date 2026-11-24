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
        'Reply saved. The member still needs to confirm they got the money.',
      );
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to record this resolution.');
    }
  };
  return (
    <form className="stack" onSubmit={save} noValidate>
      <Field id="issue-resolution" label="Your reply to the member" required>
        <textarea
          id="issue-resolution"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you do, or what should the member check?"
        />
      </Field>
      <p className="field-hint">
        This app doesn’t send money. The original payment and report stay on record. Only the
        member can confirm they got the money.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save reply'}
      </button>
    </form>
  );
}
