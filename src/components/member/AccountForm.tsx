import { useEffect, useState, type FormEvent } from 'react';
import { useMember } from '../../context/member-context';
import type { AccountInput } from '../../domain/member';
import { accountKinds } from '../../domain/accounts';
import { accountService } from '../../services/member-accounts';
import { Field } from '../Field';
import { Modal } from '../ui';
export function AccountForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const { busy, run } = useMember();
  const [form, setForm] = useState<AccountInput>({
    label: '',
    kind: 'Bank',
    holder: '',
    institution: '',
    identifier: '',
    isDefault: false,
  });
  const [revision, setRevision] = useState(''),
    [loading, setLoading] = useState(!!id),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0),
    [wasDefault, setWasDefault] = useState(false);
  useEffect(() => {
    let active = true;
    if (id) {
      setLoading(true);
      accountService
        .detail(id)
        .then((a) => {
          if (active) {
            setForm({
              label: a.label,
              kind: a.kind,
              holder: a.holder,
              institution: a.institution,
              identifier: a.identifier,
              isDefault: a.isDefault,
            });
            setRevision(a.updatedAt);
            setWasDefault(a.isDefault);
            setError('');
          }
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Unable to load this account.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [id, attempt]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await run(
        () => accountService.save(form, id, revision),
        'Payment destination saved. Submitted claims retain their selected snapshot.',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save account.');
    }
  };
  return (
    <Modal
      title={id ? 'Edit my payment account' : 'Add a payment destination'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="stack" onSubmit={submit} noValidate>
        <p className="settings-copy">
          Local demo storage is not production-secure. Use fictional destination details. These are
          payment instructions only; never enter passwords, PINs, or OTPs.
        </p>
        {loading ? (
          <p role="status">Loading your account…</p>
        ) : id && !revision ? (
          <>
            <p className="form-error" role="alert">
              {error}
            </p>
            <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
              Retry account
            </button>
          </>
        ) : (
          <>
            <Field id="account-kind" label="Account type">
              <select
                id="account-kind"
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kind: e.target.value as AccountInput['kind'] }))
                }
              >
                {accountKinds.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="account-label" label="Friendly label" required>
              <input
                id="account-label"
                maxLength={80}
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Demo reimbursement account"
              />
            </Field>
            <Field id="account-holder" label="Account holder" required>
              <input
                id="account-holder"
                maxLength={100}
                value={form.holder}
                onChange={(e) => setForm((f) => ({ ...f, holder: e.target.value }))}
              />
            </Field>
            {form.kind === 'Bank' && (
              <Field id="account-institution" label="Bank / institution" required>
                <input
                  id="account-institution"
                  maxLength={80}
                  value={form.institution}
                  onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
                  placeholder="Demo institution"
                />
              </Field>
            )}
            <Field
              id="account-identifier"
              label={
                form.kind === 'Bank' ? 'Account identifier' : 'Registered TNG phone identifier'
              }
              required
            >
              <input
                id="account-identifier"
                maxLength={form.kind === 'Bank' ? 34 : 20}
                inputMode={form.kind === 'TNG' ? 'tel' : 'text'}
                value={form.identifier}
                onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
                autoComplete="off"
              />
            </Field>
            <label className="member-check">
              <input
                type="checkbox"
                checked={form.isDefault}
                disabled={wasDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              <span>
                {wasDefault
                  ? 'This is your default. Choose a different default from the account list to replace it.'
                  : 'Make this my default for future drafts'}
              </span>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
        <div className="form-actions">
          <button className="btn" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy || loading || (!!id && !revision)}>
            {busy ? 'Saving…' : 'Save payment account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
