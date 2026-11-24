import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/workspace-context';
import type { Activity, Department } from '../domain/models';
import { parseMoney, summarize, validateDepartment } from '../domain/budget';
import { removeDepartment, upsertDepartment } from '../services/director';
import { Badge, Empty, Modal, Panel, Progress, useFormat } from './ui';
import { Field } from './Field';
import { DepartmentAccessFields } from './DepartmentAccessFields';
import { configureDepartmentAccess } from '../services/department-access';
import { demoMode } from '../services/supabase/client';
import { saveDepartmentSetup } from '../services/supabase/business';

export function Departments({ activity }: { activity: Activity }) {
  const { store, mutate, busy } = useWorkspace();
  const { money, currency } = useFormat();
  const [editing, setEditing] = useState<Department | 'new' | null>(null);
  const [removing, setRemoving] = useState<Department | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const allocated = activity.departments.reduce((s, d) => s + d.allocation, 0);
  const editable = !activity.financialState || activity.financialState === 'Open';
  if (!store) return null;
  return (
    <div className="stack">
      <div className="allocation-banner">
        <div>
          <small>ACTIVITY BUDGET</small>
          <strong className="money">{money(activity.budget)}</strong>
        </div>
        <div>
          <small>GIVEN TO DEPARTMENTS</small>
          <strong className="money">{money(allocated)}</strong>
        </div>
        <div>
          <small>NOT GIVEN OUT YET</small>
          <strong className="money good-text">{money(activity.budget - allocated)}</strong>
        </div>
        <Progress
          value={(allocated / activity.budget) * 100}
          label="Budget assigned to departments"
          tone="green"
        />
      </div>
      <Panel
        title="Departments"
        subtitle={editable ? 'Add departments and give each one a budget' : 'This activity is closing, so budgets can’t be changed'}
        action={
          editable && <button
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
              placeholder="Search by department or head…"
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
              const used = demoMode ? s.recorded : s.committed;
              const remaining = demoMode ? s.remaining : s.available;
              const utilization = d.allocation ? (used / d.allocation) * 100 : 0;
              const over = used > d.allocation;
              return (
                <article className="department-card" key={d.id}>
                  <div className="row between">
                    <span className="department-icon">
                      <Users size={19} />
                    </span>
                    <div className="row">
                      {demoMode && <button
                        className="icon-btn"
                        aria-label={`Edit ${d.name}`}
                        onClick={() => {
                          setError('');
                          setEditing(d);
                        }}
                      >
                        <Pencil size={14} />
                      </button>}
                      {demoMode && (
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
                      )}
                    </div>
                  </div>
                  <div className="row between">
                    <h3>{d.name}</h3>
                    {over && <Badge tone="danger">Over budget</Badge>}
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
                    <span>{d.head || 'No head yet'}</span>
                  </div>
                  <div className="department-amounts">
                    <div>
                      <small>Budget</small>
                      <strong className="money">{money(d.allocation)}</strong>
                    </div>
                    <div>
                      <small>{demoMode ? 'Claimed' : 'Set aside'}</small>
                      <strong className="money">{money(used)}</strong>
                    </div>
                  </div>
                  <Progress
                    value={utilization}
                    label={`${d.name} budget used`}
                    tone={over ? 'danger' : 'green'}
                  />
                  <div className="row between department-remaining">
                    <span className={over ? 'danger-text' : ''}>
                      {money(remaining)} {demoMode ? 'left' : 'free to spend'}
                    </span>
                    <span>{utilization.toFixed(1)}% {demoMode ? 'used' : 'set aside'}</span>
                  </div>
                  {over && (
                    <p className="department-warning">
                      Over budget by {money(-remaining)}. Raise its budget or cancel a purchase.
                    </p>
                  )}
                </article>
              );
            })}
        </div>
        {!activity.departments.length && (
          <Empty
            title="No departments yet"
            action={
              editable && <button className="btn" onClick={() => setEditing('new')}>
                <Plus size={15} />
                Add department
              </button>
            }
          >
            Add departments such as Logistics, Programme or Marketing, then give each one part of
            the budget.
          </Empty>
        )}
        {activity.departments.length > 0 &&
          !activity.departments.some((d) =>
            `${d.name} ${d.head}`.toLowerCase().includes(query.toLowerCase()),
          ) && <Empty title="No departments match">Try another department name or lead.</Empty>}
      </Panel>
      {editable && editing && (
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
            Its {money(removing.allocation)} budget goes back to the activity. You can’t remove a
            department that has claims or tasks.
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
                    'Department removed. Its budget is free again.',
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
        {demoMode
          ? `All budgets are in ${currency}. If you set a budget lower than what is already claimed, it shows as Over budget. Past records stay.`
          : `All budgets are in ${currency}. Money for open purchase tasks is set aside until the task is done or cancelled.`}
      </p>
      {!demoMode && <p className="data-note">Departments can’t be removed yet, so their tasks and history stay safe.</p>}
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
  const { store, mutate, run, busy } = useWorkspace();
  const [setupRevision] = useState(store?.setupRevision ?? 0);
  const { money, currency } = useFormat();
  const [name, setName] = useState(department?.name ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [head, setHead] = useState(department?.head ?? '');
  const [allocation, setAllocation] = useState(
    department ? (department.allocation / 100).toFixed(2) : '0.00',
  );
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [hodId, setHodId] = useState(department?.hodUserId ?? '');
  const [memberIds, setMemberIds] = useState(
    () =>
      store?.directory?.memberships
        .filter(
          (m) =>
            m.active &&
            m.role === 'Member' &&
            m.activityId === activity.id &&
            m.departmentId === department?.id,
        )
        .map((m) => m.userId) ?? [],
  );
  const available =
    activity.budget -
    activity.departments
      .filter((d) => d.id !== department?.id)
      .reduce((s, d) => s + d.allocation, 0);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    try {
      const allocationSen = parseMoney(allocation);
      if (demoMode) {
        await mutate(
          (s) => {
            if ((s.setupRevision ?? 0) !== setupRevision)
              throw new Error('Someone else changed this department. Close and reopen this form.');
            const next = upsertDepartment(s, activity.id,
              { name, description, head, allocation: allocationSen }, department?.id);
            const target = department?.id ?? next.activities.find((a) => a.id === activity.id)!.departments.at(-1)!.id;
            return configureDepartmentAccess(next, activity.id, target, hodId, memberIds);
          },
          department ? 'Department and allocation updated.' : 'Department created and budget allocated.',
        );
      } else {
        const others = activity.departments.filter((d) => d.id !== department?.id);
        validateDepartment(
          { name, description, head, allocation: allocationSen },
          activity.budget,
          others.reduce((sum, d) => sum + d.allocation, 0),
          others.some((d) => d.name.toLowerCase() === name.trim().toLowerCase()),
        );
        await run(
          () => saveDepartmentSetup({
            activityId: activity.id,
            departmentId: department?.id,
            name,
            description,
            head,
            allocation: allocationSen,
            hodUserId: hodId || undefined,
            memberUserIds: memberIds,
          }),
          department ? 'Department saved.' : 'Department created.',
        );
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save department.');
    }
  };
  return (
    <Modal
      title={department ? `Edit ${department.name}` : 'Add department'}
      onClose={onClose}
    >
      <form className="stack" onSubmit={save} noValidate>
        <div className="inline-info">
          You can give this department up to <strong className="money">{money(available)}</strong>
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
        <Field label="Head’s name (for display only)" id="department-head">
          <input
            id="department-head"
            value={head}
            maxLength={100}
            onChange={(e) => setHead(e.target.value)}
            placeholder="e.g. Sarah Tan"
          />
        </Field>
        <Field label={`Department budget (${currency})`} id="department-allocation" required>
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
          Leave at 0 if you haven’t decided. Typing a name doesn’t give access; choose the HOD
          below.
        </p>
        {store?.directory && (
          <DepartmentAccessFields
            directory={store.directory}
            hodId={hodId}
            members={memberIds}
            setHodId={(id) => {
              setHodId(id);
              if (id) setHead(store.directory!.users.find((u) => u.id === id)!.name);
            }}
            setMembers={setMemberIds}
          />
        )}
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
