import { useState, type FormEvent } from 'react';
import { useTreasury } from '../../context/treasury-context';
import { treasuryService } from '../../services/treasury';
import { Field } from '../Field';
import { Modal } from '../ui';
export function RiskRulesForm({ onClose }: { onClose: () => void }) {
  const { data, busy, run } = useTreasury();
  const [rules, setRules] = useState(data!.treasury!.rules),
    [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await run(
        () => treasuryService.rules(rules),
        'Risk thresholds saved. Existing decision snapshots are unchanged.',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save rules.');
    }
  };
  return (
    <Modal
      title="Configure advisory rules"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="stack" onSubmit={submit} noValidate>
        <p className="settings-copy">
          These club-wide demo thresholds apply to future analyses. A high factor determines a High
          band; otherwise any medium factor determines Medium. No rule makes a claim decision.
        </p>
        {(
          [
            ['mediumVariance', 'Medium item variance (%)'],
            ['highVariance', 'High item variance (%)'],
            ['lowHeadroomPercent', 'Low headroom threshold (%)'],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} id={key} label={label}>
            <input
              id={key}
              type="number"
              min="1"
              max={key === 'lowHeadroomPercent' ? 100 : 1000}
              value={rules[key]}
              onChange={(e) => setRules((r) => ({ ...r, [key]: Number(e.target.value) }))}
            />
          </Field>
        ))}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save thresholds'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
