import { Landmark, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useMember } from '../../context/member-context';
import type { AccountSummary } from '../../domain/member';
import { accountService } from '../../services/member-accounts';
import { AccountForm } from '../../components/member/AccountForm';
import { Badge, Empty, Modal, PageHeader, Panel, useFormat } from '../../components/ui';
export function MemberAccounts() {
  const { data, busy, run } = useMember(),
    { time } = useFormat();
  const [editing, setEditing] = useState<string | null | undefined>(),
    [removing, setRemoving] = useState<AccountSummary | null>(null),
    [error, setError] = useState('');
  if (!data) return null;
  const makeDefault = async (id: string) => {
    setError('');
    try {
      await run(
        () => accountService.setDefault(id),
        'Default updated for future drafts. Existing claims are unchanged.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to change the default.');
    }
  };
  const remove = async () => {
    if (!removing) return;
    setError('');
    try {
      await run(() => accountService.remove(removing.id), 'Unused payment account removed.');
      setRemoving(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove this account.');
    }
  };
  return (
    <div className="stack">
      <PageHeader
        eyebrow="MY PAYMENT PREFERENCES"
        title="The right destination, chosen by you."
        description="Save your own reimbursement instructions and select a snapshot for each claim."
      >
        <button className="btn primary" onClick={() => setEditing(null)}>
          Add payment account
        </button>
      </PageHeader>
      <div className="member-scope-banner">
        <h2>Private to your profile.</h2>
        <p>
          Ordinary views stay masked. The authorized Treasurer can access only the destination
          selected for an approved, unpaid claim. Editing a saved account or default never redirects
          an existing claim.
        </p>
      </div>
      {error && !removing && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Panel
        title="My saved destinations"
        subtitle="Local demonstration only · use fictional details"
      >
        <div className="member-account-grid">
          {data.accounts.map((a) => (
            <article className="member-account-card" key={a.id}>
              <div className="row between">
                <span className="department-icon">
                  {a.kind === 'Bank' ? <Landmark size={21} /> : <Smartphone size={21} />}
                </span>
                {a.isDefault && <Badge tone="green">Default</Badge>}
              </div>
              <h2>{a.label}</h2>
              <p>{a.holder}</p>
              <p className="muted">{a.institution}</p>
              <strong className="member-account-mask">{a.masked}</strong>
              <small>Updated {time(a.updatedAt)}</small>
              <div className="row wrap">
                <button className="btn" onClick={() => setEditing(a.id)}>
                  Edit {a.label}
                </button>
                {!a.isDefault && (
                  <button className="btn" disabled={busy} onClick={() => void makeDefault(a.id)}>
                    Set default
                  </button>
                )}
                <button
                  className="btn danger"
                  disabled={busy || a.inUse}
                  aria-describedby={a.inUse ? `used-${a.id}` : undefined}
                  onClick={() => {
                    setError('');
                    setRemoving(a);
                  }}
                >
                  Remove
                </button>
              </div>
              {a.inUse && (
                <p className="field-hint" id={`used-${a.id}`}>
                  Referenced by a claim or draft. Removal is protected; submitted snapshots remain
                  unchanged when you edit.
                </p>
              )}
            </article>
          ))}
        </div>
        {!data.accounts.length && (
          <Empty
            title="Add your first destination"
            action={
              <button className="btn primary" onClick={() => setEditing(null)}>
                Add payment account
              </button>
            }
          >
            Choose Bank or TNG. Only the fields needed for that destination are collected.
          </Empty>
        )}
      </Panel>
      {editing !== undefined && (
        <AccountForm
          key={editing ?? 'new'}
          id={editing ?? undefined}
          onClose={() => setEditing(undefined)}
        />
      )}
      {removing && (
        <Modal
          title="Remove this unused destination?"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <div className="stack">
            <p>
              {removing.label} · {removing.masked}
            </p>
            <p className="settings-copy">
              This account has no claim or draft references.{' '}
              {removing.isDefault
                ? 'Another saved account, if present, will become your default.'
                : ''}{' '}
              Historical account-change audit entries remain.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button className="btn" disabled={busy} onClick={() => setRemoving(null)}>
                Keep account
              </button>
              <button className="btn danger" disabled={busy} onClick={() => void remove()}>
                {busy ? 'Removing…' : 'Confirm removal'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
