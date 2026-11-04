import { ArrowLeft, ArrowRight, Check, Info, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../context/Workspace';
import { activityStatuses, activityTypes, type ActivityInput } from '../domain/models';
import { parseMoney } from '../domain/budget';
import { upsertActivity } from '../services/director';
import { Empty, Modal, PageHeader, useFormat } from '../components/ui';
import { DateField } from '../components/DateField';
import { Field } from '../components/Field';

export function ActivityForm() {
  const { id } = useParams();
  const { store, mutate, busy } = useWorkspace();
  const { currency, money } = useFormat();
  const navigate = useNavigate();
  const existing = store?.activities.find((a) => a.id === id);
  const initial = {
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    type: existing?.type ?? 'Workshop',
    status: existing?.status ?? 'Planning',
    startDate: existing?.startDate ?? '',
    endDate: existing?.endDate ?? '',
    budget: existing ? (existing.budget / 100).toFixed(2) : '',
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<string[]>([]);
  const [discard, setDiscard] = useState(false);
  const back = id ? `/director/activities/${id}` : '/director/activities';
  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setInvalid((fields) => fields.filter((f) => f !== key));
    setError('');
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  if (id && !existing)
    return (
      <Empty
        title="Activity not found"
        action={
          <Link className="btn" to="/director/activities">
            Back to activities
          </Link>
        }
      >
        Choose an activity from your workspace.
      </Empty>
    );
  const cancel = () => (dirty ? setDiscard(true) : navigate(back));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const required = ['name', 'description', 'startDate', 'endDate', 'budget'] as const;
    const missing = required.filter((key) => !form[key].trim());
    if (missing.length) {
      setInvalid([...missing]);
      setError('Complete the highlighted fields before saving.');
      return;
    }
    try {
      const input: ActivityInput = {
        ...form,
        type: form.type as ActivityInput['type'],
        status: form.status as ActivityInput['status'],
        budget: parseMoney(form.budget),
      };
      const saved = await mutate(
        (s) => upsertActivity(s, input, id),
        id
          ? 'Activity updated successfully.'
          : 'Activity created. Next, configure your departments.',
      );
      const activityId = id ?? saved.activities[0].id;
      navigate(`/director/activities/${activityId}${id ? '' : '/departments'}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save this activity.');
    }
  };
  return (
    <div className="stack">
      <button className="back-link" onClick={cancel}>
        <ArrowLeft size={15} />
        {id ? 'Back to activity' : 'Back to activities'}
      </button>
      <PageHeader
        eyebrow={id ? 'ACTIVITY SETTINGS' : 'SOMETHING GOOD STARTS HERE'}
        title={id ? 'Refine the plan.' : 'Create your next activity.'}
        description="A clear purpose, a thoughtful budget, and a team ready to go."
      />
      {!id && (
        <div className="setup-steps">
          <span className="current">
            <b>1</b>Activity details
          </span>
          <span className="step-line" />
          <span>
            <b>2</b>Set up departments
          </span>
          <span className="step-line" />
          <span>
            <b>3</b>Review your budget
          </span>
        </div>
      )}
      <div className="form-layout">
        <form className="panel activity-form" onSubmit={submit} noValidate>
          <div className="form-section">
            <div className="form-section-title">
              <span>01</span>
              <div>
                <h2>Give your activity a purpose</h2>
                <p>The essentials that bring everyone onto the same page.</p>
              </div>
            </div>
            <Field label="Activity name" id="name" required error={invalid.includes('name')}>
              <input
                id="name"
                value={form.name}
                maxLength={100}
                aria-invalid={invalid.includes('name')}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Innovation Summit 2026"
              />
            </Field>
            <Field
              label="Description"
              id="description"
              required
              error={invalid.includes('description')}
            >
              <textarea
                id="description"
                maxLength={2000}
                value={form.description}
                aria-invalid={invalid.includes('description')}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What is this activity about? What do you want to achieve?"
              />
            </Field>
            <div className="form-grid">
              <Field label="Activity type" id="type">
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) => update('type', e.target.value)}
                >
                  {activityTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status" id="status">
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                >
                  {activityStatuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-grid">
              <Field
                label="Start date"
                id="startDate"
                required
                error={invalid.includes('startDate')}
              >
                <DateField
                  id="startDate"
                  value={form.startDate}
                  invalid={invalid.includes('startDate')}
                  onChange={(value) => update('startDate', value)}
                />
              </Field>
              <Field label="End date" id="endDate" required error={invalid.includes('endDate')}>
                <DateField
                  id="endDate"
                  min={form.startDate}
                  value={form.endDate}
                  invalid={invalid.includes('endDate')}
                  onChange={(value) => update('endDate', value)}
                />
              </Field>
            </div>
          </div>
          <div className="form-section">
            <div className="form-section-title">
              <span>02</span>
              <div>
                <h2>Set the financial foundation</h2>
                <p>The overall limit for all your activity’s departments.</p>
              </div>
            </div>
            <Field
              label={`Overall budget (${currency})`}
              id="budget"
              required
              error={invalid.includes('budget')}
            >
              <div className="amount-field">
                <span>{currency}</span>
                <input
                  id="budget"
                  inputMode="decimal"
                  value={form.budget}
                  aria-invalid={invalid.includes('budget')}
                  onChange={(e) => update('budget', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </Field>
            <p className="field-hint">
              Department allocations must stay within this budget.
              {existing &&
                ` Currently allocated: ${money(existing.departments.reduce((s, d) => s + d.allocation, 0))}.`}
            </p>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <button className="btn" type="button" disabled={busy} onClick={cancel}>
              Cancel
            </button>
            <button className="btn primary" disabled={busy} type="submit">
              {busy ? 'Saving…' : id ? 'Save changes' : 'Create & set up departments'}
              {id ? <Save size={15} /> : <ArrowRight size={15} />}
            </button>
          </div>
        </form>
        <aside className="form-aside">
          <span className="aside-icon">
            <Info size={22} />
          </span>
          <h2>A little planning goes a long way.</h2>
          <p>
            Start with an overall budget. You can divide it between departments once the activity is
            created.
          </p>
          <ul>
            <li>
              <Check size={15} />
              Keep unallocated funds for flexibility
            </li>
            <li>
              <Check size={15} />
              Track spending as a team
            </li>
            <li>
              <Check size={15} />
              Adjust the plan as things evolve
            </li>
          </ul>
          <div className="aside-note">
            This is a local demo. Your changes are saved in this browser.
          </div>
        </aside>
      </div>
      {discard && (
        <Modal title="Discard unsaved changes?" onClose={() => setDiscard(false)}>
          <p>Your changes to this form have not been saved.</p>
          <div className="form-actions">
            <button className="btn" onClick={() => setDiscard(false)}>
              Keep editing
            </button>
            <button className="btn danger" onClick={() => navigate(back)}>
              Discard changes
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
