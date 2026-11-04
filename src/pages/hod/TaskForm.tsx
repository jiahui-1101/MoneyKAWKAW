import { ArrowLeft, ArrowRight, Check, Info, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useHod } from '../../context/hod-context';
import { eligibleMembers } from '../../domain/hod';
import { parseMoney } from '../../domain/budget';
import { priorities, type PurchasingDetails } from '../../domain/models';
import { hodService } from '../../services/hod';
import { useDepartmentScope } from '../../components/hod/HodWidgets';
import { Field } from '../../components/Field';
import { DateField } from '../../components/DateField';
import { Empty, Modal, PageHeader, useFormat } from '../../components/ui';

export function HodTaskForm() {
  const { taskId } = useParams();
  const { data, scope, tasks, base, summary } = useDepartmentScope();
  const { run, busy } = useHod();
  const { money, currency } = useFormat();
  const navigate = useNavigate();
  const task = tasks.find((t) => t.id === taskId);
  const p = task?.purchasing;
  const [baseline] = useState(() => ({
    name: p?.name ?? '',
    description: p?.description ?? '',
    assigneeId: p?.assigneeId ?? '',
    budget: task ? (task.budget / 100).toFixed(2) : '',
    dueDate: p?.dueDate ?? scope.activity.startDate,
    priority: p?.priority ?? 'Medium',
    version: p?.updatedAt,
  }));
  const [form, setForm] = useState(baseline);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const back = taskId ? `${base}/tasks/${taskId}` : `${base}/tasks`;
  const cancel = () => (dirty ? setDiscard(true) : navigate(back));
  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
    setInvalid((i) => i.filter((v) => v !== key));
  };
  if (taskId && !task)
    return (
      <Empty
        title="Purchasing task unavailable"
        action={
          <Link className="btn" to={`${base}/tasks`}>
            Back to my tasks
          </Link>
        }
      >
        This task is not part of your authorized department.
      </Empty>
    );
  if (task?.expenseId || p?.status === 'Cancelled')
    return (
      <Empty
        title={
          task?.expenseId ? 'Submitted purchases are protected' : 'This plan has been cancelled'
        }
        action={
          <Link className="btn primary" to={back}>
            View purchasing details
          </Link>
        }
      >
        Claim-linked and cancelled tasks cannot be edited. Claim decisions and reimbursement actions
        remain with the Treasurer.
      </Empty>
    );
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const required = ['name', 'description', 'assigneeId', 'budget', 'dueDate'] as const;
    const missing = required.filter((k) => !form[k].trim());
    if (missing.length) {
      setInvalid([...missing]);
      setError('Complete the highlighted fields before saving this purchase.');
      return;
    }
    try {
      const id = await run(
        () =>
          hodService.save(
            scope.activity.id,
            scope.department.id,
            {
              name: form.name,
              description: form.description,
              assigneeId: form.assigneeId,
              budget: parseMoney(form.budget),
              dueDate: form.dueDate,
              priority: form.priority as PurchasingDetails['priority'],
            },
            taskId,
            baseline.version,
          ),
        taskId ? 'Purchasing task updated.' : 'Purchasing task created and assigned.',
      );
      navigate(`${base}/tasks/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save purchasing task.');
    }
  };
  const available = Math.max(0, summary.purchasingCapacity + (task?.budget ?? 0));
  return (
    <div className="stack">
      <button className="back-link" onClick={cancel}>
        <ArrowLeft size={15} />
        Back to {taskId ? 'purchase' : 'task board'}
      </button>
      <PageHeader
        eyebrow={`${scope.department.name.toUpperCase()} · PURCHASING PLAN`}
        title={taskId ? 'Refine the purchasing plan.' : 'Give your next purchase a plan.'}
        description={`${scope.activity.name} · Clear ownership, a sensible estimate, and a deadline.`}
      />
      <div className="form-layout">
        <form className="panel activity-form" onSubmit={save} noValidate>
          <div className="form-section">
            <div className="form-section-title">
              <span>01</span>
              <div>
                <h2>What does the team need?</h2>
                <p>Describe the item and what a successful purchase looks like.</p>
              </div>
            </div>
            <Field label="Item name" id="purchase-name" required error={invalid.includes('name')}>
              <input
                id="purchase-name"
                maxLength={120}
                value={form.name}
                aria-invalid={invalid.includes('name')}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. HDMI cable"
              />
            </Field>
            <Field
              label="Purchase description"
              id="purchase-description"
              required
              error={invalid.includes('description')}
            >
              <textarea
                id="purchase-description"
                maxLength={2000}
                value={form.description}
                aria-invalid={invalid.includes('description')}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Specifications, quantity, purpose, and supplier notes…"
              />
            </Field>
            <Field
              label="Assigned department member"
              id="purchase-member"
              required
              error={invalid.includes('assigneeId')}
            >
              <select
                id="purchase-member"
                value={form.assigneeId}
                aria-invalid={invalid.includes('assigneeId')}
                onChange={(e) => update('assigneeId', e.target.value)}
              >
                <option value="">Choose an eligible member</option>
                {eligibleMembers(data, scope.activity.id, scope.department.id).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.id === data.actor.userId ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field
                label="Due date"
                id="purchase-due"
                required
                error={invalid.includes('dueDate')}
              >
                <DateField
                  id="purchase-due"
                  calendarLabel="Choose due date"
                  value={form.dueDate}
                  invalid={invalid.includes('dueDate')}
                  onChange={(v) => update('dueDate', v)}
                />
              </Field>
              <Field label="Priority" id="purchase-priority">
                <select
                  id="purchase-priority"
                  value={form.priority}
                  onChange={(e) => update('priority', e.target.value)}
                >
                  {priorities.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          <div className="form-section">
            <div className="form-section-title">
              <span>02</span>
              <div>
                <h2>A thoughtful item budget</h2>
                <p>This estimate reserves part of your department allocation.</p>
              </div>
            </div>
            <div className="inline-info">
              Maximum item budget <strong className="money">{money(available)}</strong>
            </div>
            <Field
              label={`Estimated item budget (${currency})`}
              id="purchase-budget"
              required
              error={invalid.includes('budget')}
            >
              <div className="amount-field">
                <span>{currency}</span>
                <input
                  id="purchase-budget"
                  inputMode="decimal"
                  value={form.budget}
                  aria-invalid={invalid.includes('budget')}
                  onChange={(e) => update('budget', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </Field>
            <p className="field-hint">
              The item must fit both your department’s planned allocations and the available funds
              after claims and open purchasing commitments.
            </p>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn" disabled={busy} onClick={cancel}>
              Cancel
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : taskId ? 'Save purchasing task' : 'Create purchasing task'}
              {taskId ? <Save size={15} /> : <ArrowRight size={15} />}
            </button>
          </div>
        </form>
        <aside className="form-aside">
          <span className="aside-icon">
            <Info size={22} />
          </span>
          <h2>A clear brief makes a confident purchase.</h2>
          <p>
            The Director has allocated {money(summary.budget)} to {scope.department.name}. Your team
            can distribute that budget across purchasing tasks.
          </p>
          <ul>
            <li>
              <Check size={15} />
              Assign only eligible department members
            </li>
            <li>
              <Check size={15} />
              Keep estimates separate from expenses
            </li>
            <li>
              <Check size={15} />
              Track purchasing and claims separately
            </li>
          </ul>
          <div className="aside-note">
            Saving this plan does not create a claim, approve an expense, or record a payment.
          </div>
        </aside>
      </div>
      {discard && (
        <Modal title="Discard unsaved purchasing changes?" onClose={() => setDiscard(false)}>
          <p>Your changes have not been saved.</p>
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
