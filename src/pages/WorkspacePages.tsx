import { AlertCircle, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { RecentActivity } from '../components/Finance';
import { Modal, PageHeader, Panel } from '../components/ui';
import { Field } from '../components/Field';
import { updateSettings } from '../services/director';
import { demoMode } from '../services/supabase/client';

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
        eyebrow="HISTORY"
        title="History"
        description="Every change to activities and department budgets."
      />
      <div className="history-filters">
        <input
          aria-label="Search history"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by change or person…"
        />
        <select
          aria-label="Filter by activity"
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
        {demoMode
          ? 'Demo history stays on this device and is cleared by a demo reset.'
          : 'History is saved for the club and can’t be edited or deleted.'}
      </p>
    </div>
  );
}

export function Settings() {
  const { store, mutate, busy, reset } = useWorkspace();
  const [timezone, setTimezone] = useState(store?.settings.timezone ?? 'Asia/Kuala_Lumpur');
  const [threshold, setThreshold] = useState(String(store?.settings.warningPercent ?? 85));
  const [setupRevision, setSetupRevision] = useState(store?.setupRevision ?? 0);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  if (!store) return null;
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const saved = await mutate((s) => {
        if ((s.setupRevision ?? 0) !== setupRevision)
          throw new Error(
            'Workspace setup changed in another view. Reload before saving preferences.',
          );
        return updateSettings(s, { ...s.settings, timezone, warningPercent: Number(threshold) });
      }, 'Workspace preferences saved.');
      setSetupRevision(saved.setupRevision ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save settings.');
    }
  };
  return (
    <div className="stack">
      <PageHeader
        eyebrow="MAKE IT YOUR WORKSPACE"
        title="Settings"
        description="Choose your time zone and budget warning level."
      />
      <div className="settings-layout">
        <Panel
          title="Workspace preferences"
          subtitle="Time zone and budget warning"
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
              Currency is set to RM for this club.
            </p>
            <Field label="Time zone" id="timezone">
              <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="Asia/Kuala_Lumpur">Kuala Lumpur (UTC+08:00)</option>
                <option value="Asia/Singapore">Singapore (UTC+08:00)</option>
                <option value="UTC">UTC (world time)</option>
              </select>
            </Field>
            <Field label="Warn me when budget used reaches (%)" id="threshold">
              <input
                id="threshold"
                inputMode="numeric"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </Field>
            <p className="field-hint">
              Choose 1–100. Activity and department progress bars turn yellow at this percentage.
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
              <h3>What you can do</h3>
              <p>
                As Director you set up activities, budgets and departments. Typing a department
                head’s name doesn’t give them access; choose the HOD in the department form.
              </p>
              <p>
                Only the Treasurer approves and pays claims.
              </p>
            </div>
          </Panel>
          <Panel title="Demo data">
            <div className="panel-body stack">
              <p className="settings-copy">
                Your changes are saved in this browser. Sample claims and payments are made up. Reset
                to go back to the sample data.
              </p>
              <button className="btn" onClick={() => setConfirm(true)}>
                <RotateCcw size={14} />
                Reset demo data
              </button>
            </div>
          </Panel>
        </div>
      </div>
      {confirm && (
        <Modal title="Reset demo data?" onClose={() => setConfirm(false)}>
          <div className="row">
            <AlertCircle size={22} className="danger-text" />
            <p>
              This deletes the activities, departments, settings and history you changed, and brings
              back the sample data. You can’t undo this.
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
                  setSetupRevision(0);
                  setConfirm(false);
                } catch {
                  setError('This browser can’t save data. Allow site storage, then try again.');
                }
              }}
            >
              Reset demo data
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
