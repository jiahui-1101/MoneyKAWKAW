import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/workspace-context';
import type { Activity, Department } from '../domain/models';
import { parseMoney, summarize } from '../domain/budget';
import { removeDepartment, upsertDepartment } from '../services/director';
import { Badge, Empty, Modal, Panel, Progress, useFormat } from './ui';
import { Field } from './Field';

export function Departments({ activity }: { activity: Activity }) {
  const { store, mutate, busy } = useWorkspace();
  const { money, currency } = useFormat();
  const [editing, setEditing] = useState<Department | 'new' | null>(null);
  const [removing, setRemoving] = useState<Department | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const allocated = activity.departments.reduce((s, d) => s + d.allocation, 0);
  if (!store) return null;
  return (
    <div className="stack">
      <div className="allocation-banner">
        <div>
          <small>OVERALL BUDGET</small>
          <strong className="money">{money(activity.budget)}</strong>
        </div>
        <div>
          <small>DEPARTMENT ALLOCATIONS</small>
          <strong className="money">{money(allocated)}</strong>
        </div>
        <div>
          <small>STILL TO ALLOCATE</small>
          <strong className="money good-text">{money(activity.budget - allocated)}</strong>
        </div>
        <Progress
          value={(allocated / activity.budget) * 100}
          label="Budget assigned to departments"
          tone="green"
        />
      </div>
      <Panel
        title="The teams behind the activity"
        subtitle="Configure departments and give each one a clear allocation"
        action={
          <button
            className="btn primary"
            onClick={() => {
              setError('');
              setEditing('new');
            }}
          >
            <Plus size={15} />
            Add department
          </button>
        }
      >
        {activity.departments.length > 0 && (
          <div className="department-search">
            <input
              aria-label="Search departments"
              placeholder="Search departments or leads…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
        <div className="department-grid">
          {activity.departments
            .filter((d) => `${d.name} ${d.head}`.toLowerCase().includes(query.toLowerCase()))
            .map((d) => {
              const s = summarize(store, activity.id, d.id);
              const over = s.recorded > d.allocation;
              return (
                <article className="department-card" key={d.id}>
                  <div className="row between">
                    <span className="department-icon">
                      <Users size={19} />
                    </span>
                    <div className="row">
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${d.name}`}
                        onClick={() => {
                          setError('');
                          setEditing(d);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Remove ${d.name}`}
                        onClick={() => {
                          setError('');
                          setRemoving(d);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="row between">
                    <h3>{d.name}</h3>
                    {over && <Badge tone="danger">Over allocation</Badge>}
                  </div>
                  <p>{d.description || 'No description added.'}</p>
                  <div className="department-lead">
                    <span className="mini-avatar">
                      {d.head
                        ? d.head
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')
                        : '–'}
                    </span>
                    <span>{d.head || 'Lead not assigned'}</span>
                  </div>
                  <div className="department-amounts">
                    <div>
                      <small>Allocated</small>
                      <strong className="money">{money(d.allocation)}</strong>
                    </div>
                    <div>
                      <small>Recorded expenses</small>
                      <strong className="money">{money(s.recorded)}</strong>
                    </div>
                  </div>
                  <Progress
                    value={s.utilization}
                    label={`${d.name} spending utilization`}
                    tone={over ? 'danger' : 'green'}
                  />
                  <div className="row between department-remaining">
                    <span className={over ? 'danger-text' : ''}>
                      {money(s.remaining)} remaining
                    </span>
                    <span>{s.utilization.toFixed(1)}% used</span>
                  </div>
                  {over && (
                    <p className="department-warning">
                      Expenses exceed this allocation by {money(-s.remaining)}. Review the
                      allocation.
                    </p>
                  )}
                </article>
              );
            })}
        </div>
        {!activity.departments.length && (
          <Empty
            title="Every great activity needs a team"
            action={
              <button className="btn" onClick={() => setEditing('new')}>
                <Plus size={15} />
                Create your first department
              </button>
            }
          >
            Add departments such as Logistics, Programme, or Marketing, then allocate part of your
            overall budget.
          </Empty>
        )}
        {activity.departments.length > 0 &&
          !activity.departments.some((d) =>
            `${d.name} ${d.head}`.toLowerCase().includes(query.toLowerCase()),
          ) && <Empty title="No departments match">Try another department name or lead.</Empty>}
      </Panel>
      {editing && (
        <DepartmentForm
          key={typeof editing === 'string' ? 'new' : editing.id}
          activity={activity}
          department={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && (
        <Modal title={`Remove ${removing.name}?`} onClose={() => setRemoving(null)}>
          <p>
            This releases its {money(removing.allocation)} allocation back to the activity.
            Departments linked to expenses or assignments are protected from removal.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="btn" onClick={() => setRemoving(null)}>
              Cancel
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                try {
                  await mutate(
                    (s) => removeDepartment(s, activity.id, removing.id),
                    'Department removed. Its allocation is available again.',
                  );
                  setRemoving(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Unable to remove department.');
                }
              }}
            >
              Remove department
            </button>
          </div>
        </Modal>
      )}
      <p className="data-note">
        All allocations are in {currency}. Reducing an allocation below recorded expenses is allowed
        and shows an overspending indicator; historical records are preserved.
      </p>
    </div>
  );
}

function DepartmentForm({
  activity,
  department,
  onClose,
}: {
  activity: Activity;
  department?: Department;
  onClose: () => void;
}) {
  const { mutate, busy } = useWorkspace();
  const { money, currency } = useFormat();
  const [name, setName] = useState(department?.name ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [head, setHead] = useState(department?.head ?? '');
  const [allocation, setAllocation] = useState(
    department ? (department.allocation / 100).toFixed(2) : '0.00',
  );
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const available =
    activity.budget -
    activity.departments
      .filter((d) => d.id !== department?.id)
      .reduce((s, d) => s + d.allocation, 0);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    try {
      await mutate(
        (s) =>
          upsertDepartment(
            s,
            activity.id,
            { name, description, head, allocation: parseMoney(allocation) },
            department?.id,
          ),
        department
          ? 'Department and allocation updated.'
          : 'Department created and budget allocated.',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save department.');
    }
  };
  return (
    <Modal
      title={department ? `Edit ${department.name}` : 'Make room for your team'}
      onClose={onClose}
    >
      <form className="stack" onSubmit={save} noValidate>
        <div className="inline-info">
          Available for this department <strong className="money">{money(available)}</strong>
        </div>
        <Field
          label="Department name"
          id="department-name"
          required
          error={attempted && !name.trim()}
        >
          <input
            autoFocus
            id="department-name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={attempted && !name.trim()}
            placeholder="e.g. Logistics"
          />
        </Field>
        <Field label="Department description" id="department-description">
          <textarea
            id="department-description"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will this team look after?"
          />
        </Field>
        <Field label="Department lead (optional)" id="department-head">
          <input
            id="department-head"
            value={head}
            maxLength={100}
            onChange={(e) => setHead(e.target.value)}
            placeholder="e.g. Sarah Tan"
          />
        </Field>
        <Field label={`Budget allocation (${currency})`} id="department-allocation" required>
          <div className="amount-field">
            <span>{currency}</span>
            <input
              id="department-allocation"
              inputMode="decimal"
              value={allocation}
              onChange={(e) => setAllocation(e.target.value)}
            />
          </div>
        </Field>
        <p className="field-hint">
          Start at zero if the allocation is still being planned. Naming a lead here is descriptive;
          it does not grant role access.
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : department ? 'Save department' : 'Create department'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
