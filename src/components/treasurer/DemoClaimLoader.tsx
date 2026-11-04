import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { parseMoney } from '../../domain/budget';
import { fixtureTasks, loadDemoClaim } from '../../services/treasury-fixtures';
import { Field } from '../Field';
import { Empty, Modal, useFormat } from '../ui';
export function DemoClaimLoader({ onClose }: { onClose: () => void }) {
  const { data, busy, run } = useTreasury();
  const { money, currency } = useFormat();
  const navigate = useNavigate();
  const [taskId, setTaskId] = useState(''),
    [amount, setAmount] = useState(''),
    [reason, setReason] = useState(''),
    [error, setError] = useState('');
  if (!data) return null;
  const tasks = fixtureTasks(data);
  const task = tasks.find((t) => t.id === taskId);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      let id = '';
      await run(async () => {
        const result = await loadDemoClaim(taskId, parseMoney(amount), reason);
        id = result.claimId;
        return result.data;
      }, 'Fictional claim fixture saved.');
      onClose();
      navigate(`/treasurer/claims/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load sample claim.');
    }
  };
  return (
    <Modal
      title="Load a fictional claim"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="stack" onSubmit={submit} noValidate>
        <p className="settings-copy">
          Test the shared workflow using an existing assigned task. This creates fictional receipt
          evidence and a clearly non-payable destination. It does not implement member submission.
        </p>
        {!tasks.length ? (
          <Empty title="No eligible tasks">
            An HOD can first create an assigned purchase in an activity authorized for this
            Treasurer.
          </Empty>
        ) : (
          <>
            <Field id="fixture-task" label="Existing purchasing task" required>
              <select
                id="fixture-task"
                value={taskId}
                onChange={(e) => {
                  setTaskId(e.target.value);
                  setError('');
                }}
              >
                <option value="">Choose a task</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.purchasing!.name} ·{' '}
                    {data.activities.find((a) => a.id === t.activityId)?.name} · {money(t.budget)}
                  </option>
                ))}
              </select>
            </Field>
            {task && (
              <p className="field-hint">
                Assignee:{' '}
                {data.directory?.users.find((u) => u.id === task.purchasing!.assigneeId)?.name} ·
                Item budget {money(task.budget)}
              </p>
            )}
            <Field id="fixture-amount" label={`Fictional claim amount (${currency})`} required>
              <input
                id="fixture-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="190.00"
              />
            </Field>
            <Field id="fixture-reason" label="Over-budget justification">
              <textarea
                id="fixture-reason"
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain any difference from the item budget."
              />
            </Field>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy || !tasks.length}>
            {busy ? 'Loading fixture…' : 'Load fictional claim'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
