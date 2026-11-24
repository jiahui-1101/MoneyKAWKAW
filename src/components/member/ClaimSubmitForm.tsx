import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Assignment } from '../../domain/models';
import type { ClaimDraft } from '../../domain/member';
import { useMember } from '../../context/member-context';
import { draftService } from '../../services/member-drafts';
import { memberClaimService } from '../../services/member-claims';
import { Field } from '../Field';
import { Badge, Empty, Modal, Panel, useFormat } from '../ui';
import type { DraftChange } from './useMemberDraft';
type Summary = Awaited<ReturnType<typeof memberClaimService.context>>;
export function ClaimSubmitForm({
  draft,
  task,
  saving,
  change,
}: {
  draft: ClaimDraft;
  task: Assignment;
  saving: boolean;
  change: DraftChange;
}) {
  const { data, run, busy } = useMember(),
    { money } = useFormat(),
    navigate = useNavigate();
  const [account, setAccount] = useState(draft.accountId),
    [reason, setReason] = useState(draft.justification),
    [summary, setSummary] = useState<Summary | null>(null),
    [confirm, setConfirm] = useState<Summary | null>(null),
    [submissionKey] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    memberClaimService
      .context(draft.id)
      .then((s) => {
        if (active) setSummary(s);
      })
      .catch((e) => {
        if (active) {
          setSummary(null);
          setError(e instanceof Error ? e.message : 'Couldn’t check this draft. Try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [draft.id, draft.updatedAt]);
  if (!data) return null;
  const scope = data.scopes.find(
    (s) => s.activity.id === task.activityId && s.department.id === task.departmentId,
  );
  const review = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await change(
        () => draftService.preferences(draft.id, draft.updatedAt, account, reason),
        'Draft saved.',
      );
      const current = await memberClaimService.context(draft.id);
      if (current.needsJustification && reason.trim().length < 3)
        throw new Error('Please explain why this costs more than the budget.');
      setConfirm(current);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to prepare submission.');
    }
  };
  const submit = async () => {
    if (!confirm) return;
    setError('');
    try {
      const claimId = await run(
        () =>
          memberClaimService.submit(
            draft.id,
            confirm.draftUpdatedAt,
            confirm.taskUpdatedAt,
            confirm.accountUpdatedAt,
            submissionKey,
          ),
        'Claim sent to the Treasurer. You’ll be notified when it’s decided.',
      );
      navigate(`/member/claims/${claimId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit claim.');
    }
  };
  return (
    <Panel
      title="Submit your claim"
      subtitle="The amount comes from the items you chose"
    >
      <form className="member-content stack" onSubmit={review} noValidate>
        <p className="settings-copy">
          {scope?.activity.name} / {scope?.department.name} · {task.purchasing!.name}
        </p>
        {loading ? (
          <p role="status">Checking your claim against the budget…</p>
        ) : (
          summary && (
            <>
              <dl className="member-submit-facts">
                <div>
                  <dt>Budget</dt>
                  <dd>{money(task.budget)}</dd>
                </div>
                <div>
                  <dt>You’re claiming</dt>
                  <dd>{money(summary.amount)}</dd>
                </div>
                <div>
                  <dt>Over (+) or under (−) budget</dt>
                  <dd className={summary.variance > 0 ? 'danger-text' : ''}>
                    {money(summary.variance)} · {summary.variancePercent.toFixed(2)}%
                  </dd>
                </div>
              </dl>
              {summary.needsJustification && (
                <div className="member-scope-banner">
                  <Badge tone="gold">Over-budget explanation required</Badge>
                  <p>
                    {summary.variance > 0 ? 'The claim exceeds its allocated item budget. ' : ''}
                    {summary.departmentExceeded ? 'Department funds would be exceeded. ' : ''}
                    {summary.activityExceeded ? 'Activity funds would be exceeded. ' : ''}You may
                    submit with a reason; the Treasurer makes the decision.
                  </p>
                </div>
              )}
            </>
          )
        )}
        <Field
          id="claim-justification"
          label={
            summary?.needsJustification
              ? 'Why is it over budget?'
              : 'Note for the Treasurer (optional)'
          }
          required={summary?.needsJustification}
        >
          <textarea
            id="claim-justification"
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain any higher cost and its purpose for the activity."
          />
        </Field>
        {data.accounts.length ? (
          <Field id="claim-account" label="Pay me to" required>
            <select id="claim-account" value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="">Choose one of my saved accounts</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {a.masked}
                  {a.isDefault ? ' · default' : ''}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Empty
            title="Add a payment account first"
            action={
              <Link className="btn primary" to="/member/accounts">
                Manage my accounts
              </Link>
            }
          >
            Your draft is saved. Add a payment account, then come back.
          </Empty>
        )}
        <p className="field-hint">
          We’ll pay this claim to the account you choose here, even if you change your default
          later.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="btn primary"
          disabled={saving || busy || loading || !summary || !data.accounts.length}
        >
          Review & submit
        </button>
      </form>
      {confirm && (
        <Modal
          title="Submit this claim for review?"
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <div className="stack">
            <h3>{task.purchasing!.name}</h3>
            <p className="settings-copy">
              {scope?.activity.name} / {scope?.department.name}
            </p>
            <p>
              Item budget: {money(task.budget)} · Requested:{' '}
              <strong>{money(confirm.amount)}</strong>
            </p>
            <p className="settings-copy">
              Pay to: {confirm.destination?.label} · {confirm.destination?.masked}
              <br />
              {confirm.destination?.holder} · {confirm.destination?.institution}
            </p>
            <p className="settings-copy">
              After you submit, your receipt, changes and payment account are saved and can’t be
              edited. The Treasurer will review it. Approval and payment happen later, separately.
            </p>
            {reason && <p className="member-quote">{reason}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions">
              <button className="btn" disabled={busy} onClick={() => setConfirm(null)}>
                Go back
              </button>
              <button className="btn primary" disabled={busy} onClick={() => void submit()}>
                {busy ? 'Submitting…' : 'Submit claim'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Panel>
  );
}
