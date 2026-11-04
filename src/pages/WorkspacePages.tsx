import { AlertCircle, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { RecentActivity } from '../components/Finance';
import { Modal, PageHeader, Panel } from '../components/ui';
import { Field } from '../components/Field';
import { updateSettings } from '../services/director';

export function History() {
  const { store } = useWorkspace();
  const [activity, setActivity] = useState('');
  const [query, setQuery] = useState('');
  if (!store) return null;
  const filtered = {
    ...store,
    events: store.events.filter(
      (e) =>
        (!activity || e.activityId === activity) &&
        `${e.action} ${e.actor} ${e.detail}`.toLowerCase().includes(query.toLowerCase()),
    ),
  };
  return (
    <div className="stack">
      <PageHeader
        eyebrow="A RECORD OF THE DETAILS"
        title="Every change has a story."
        description="Follow activity setup and allocation changes across the workspace."
      />
      <div className="history-filters">
        <input
          aria-label="Search history"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search changes, details, or actor…"
        />
        <select
          aria-label="History activity"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
        >
          <option value="">All activities</option>
          {store.activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <RecentActivity store={filtered} all />
      <p className="data-note">
        Local history is append-only through ordinary workspace controls. Demo reset clears local
        history. Future API authorization and durable audit storage are required for production.
      </p>
    </div>
  );
}

export function Settings() {
  const { store, mutate, busy, reset } = useWorkspace();
  const [timezone, setTimezone] = useState(store?.settings.timezone ?? 'Asia/Kuala_Lumpur');
  const [threshold, setThreshold] = useState(String(store?.settings.warningPercent ?? 85));
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  if (!store) return null;
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await mutate(
        (s) => updateSettings(s, { ...s.settings, timezone, warningPercent: Number(threshold) }),
        'Workspace preferences saved.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save settings.');
    }
  };
  return (
    <div className="stack">
      <PageHeader
        eyebrow="MAKE IT YOUR WORKSPACE"
        title="The details behind the clarity."
        description="Set display preferences and understand your demo workspace."
      />
      <div className="settings-layout">
        <Panel
          title="Workspace preferences"
          subtitle="Consistent dates and budget attention thresholds"
        >
          <form className="settings-form stack" onSubmit={save} noValidate>
            <Field label="Workspace currency" id="currency">
              <input
                id="currency"
                disabled
                value={`${store.settings.currency} · ${{ MYR: 'Malaysian ringgit', SGD: 'Singapore dollar', USD: 'US dollar' }[store.settings.currency]}`}
              />
            </Field>
            <p className="field-hint">
              Currency is configured in the mock workspace seed. Changing it requires migrating
              monetary records; this demo does not convert currencies.
            </p>
            <Field label="Display timezone" id="timezone">
              <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="Asia/Kuala_Lumpur">Kuala Lumpur (UTC+08:00)</option>
                <option value="Asia/Singapore">Singapore (UTC+08:00)</option>
                <option value="UTC">Coordinated Universal Time (UTC)</option>
              </select>
            </Field>
            <Field label="Utilization attention threshold (%)" id="threshold">
              <input
                id="threshold"
                inputMode="numeric"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </Field>
            <p className="field-hint">
              Choose 1–100. Activity and department progress bars turn amber at this percentage.
              Recorded spending above budget is always marked red.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div>
              <button className="btn primary" disabled={busy}>
                <Save size={15} />
                {busy ? 'Saving…' : 'Save preferences'}
              </button>
            </div>
          </form>
        </Panel>
        <div className="stack">
          <Panel title="Director access">
            <div className="panel-body access-note">
              <ShieldCheck size={25} />
              <h3>Activity setup & financial oversight</h3>
              <p>
                This workspace is limited to Director actions. Department lead names are descriptive
                and do not assign permissions.
              </p>
              <p>
                Real authentication, role assignments, and server authorization will be integrated
                in a later phase.
              </p>
            </div>
          </Panel>
          <Panel title="Local demo data">
            <div className="panel-body stack">
              <p className="settings-copy">
                Changes persist in this browser. Sample claims and payments are fictional. Restore
                the sample workspace to clear your local changes.
              </p>
              <button className="btn" onClick={() => setConfirm(true)}>
                <RotateCcw size={14} />
                Reset demo workspace
              </button>
            </div>
          </Panel>
        </div>
      </div>
      {confirm && (
        <Modal title="Reset your demo workspace?" onClose={() => setConfirm(false)}>
          <div className="row">
            <AlertCircle size={22} className="danger-text" />
            <p>
              This clears created activities, department changes, settings, and local history.
              Fictional sample records will be restored.
            </p>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="btn" onClick={() => setConfirm(false)}>
              Keep my changes
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                try {
                  await reset();
                  setTimezone('Asia/Kuala_Lumpur');
                  setThreshold('85');
                  setConfirm(false);
                } catch {
                  setError('Storage is unavailable. Enable browser storage and retry.');
                }
              }}
            >
              Reset workspace
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
