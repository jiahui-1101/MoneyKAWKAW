import { Link } from 'react-router-dom';
import type { Store } from '../../domain/models';
import { summarize } from '../../domain/budget';
import { reviewStates } from '../../domain/treasury';
import { Badge, Empty, Panel, Progress, useFormat } from '../ui';

export function ClaimDistribution({ data }: { data: Store }) {
  let offset = 0;
  const total = data.expenses.length;
  return (
    <Panel title="Claims at a glance" subtitle="Every submitted record, including declined claims">
      <div className="distribution">
        <div className="donut">
          <svg viewBox="0 0 180 180" role="img" aria-label={`${total} claims by review status`}>
            <circle cx="90" cy="90" r="70" className="donut-track" fill="none" strokeWidth="19" />
            {reviewStates.map((state, i) => {
              const count = data.expenses.filter((e) => e.state === state).length;
              const fraction = total ? count / total : 0;
              const start = offset;
              offset += fraction;
              return (
                <circle
                  key={state}
                  className={`donut-segment chart-color-${i}`}
                  cx="90"
                  cy="90"
                  r="70"
                  fill="none"
                  strokeWidth="19"
                  pathLength="1"
                  strokeDasharray={`${Math.max(0, fraction - 0.013)} ${1 - Math.max(0, fraction - 0.013)}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 90 90)"
                />
              );
            })}
          </svg>
          <div className="donut-label">
            <small>SUBMITTED CLAIMS</small>
            <strong>{total}</strong>
            <span>Across your activities</span>
          </div>
        </div>
        <div className="distribution-legend">
          {reviewStates.map((state, i) => (
            <Link key={state} to={`/treasurer/claims?status=${encodeURIComponent(state)}`}>
              <span className={`swatch chart-color-${i}`} />
              <span>{state}</span>
              <strong>{data.expenses.filter((e) => e.state === state).length}</strong>
            </Link>
          ))}
        </div>
      </div>
    </Panel>
  );
}
export function SpendingChart({
  data,
  departments = false,
}: {
  data: Store;
  departments?: boolean;
}) {
  const { money } = useFormat();
  const rows = data.activities.flatMap((a) =>
    departments
      ? a.departments.map((d) => ({
          id: d.id,
          name: d.name,
          context: a.name,
          value: summarize(data, a.id, d.id).recorded,
          to: `/treasurer/activities/${a.id}`,
        }))
      : [
          {
            id: a.id,
            name: a.name,
            context: a.type,
            value: summarize(data, a.id).recorded,
            to: `/treasurer/activities/${a.id}`,
          },
        ],
  );
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Panel
      title={`Spending by ${departments ? 'department' : 'activity'}`}
      subtitle="Recorded claims · pending + approved, excluding declined"
    >
      <div className="treasury-chart-list">
        {rows.map((r, i) => (
          <div key={r.id} className="treasury-chart-row">
            <div className="row between">
              <div>
                <Link to={r.to}>{r.name}</Link>
                <small className="cell-sub">{r.context}</small>
              </div>
              <strong className="money">{money(r.value, true)}</strong>
            </div>
            <div className="treasury-bar">
              <span
                className={`chart-color-${i % 5}`}
                style={{ width: `${total ? (r.value / total) * 100 : 0}%` }}
              />
            </div>
            <small>{total ? ((r.value / total) * 100).toFixed(1) : 0}% of recorded expenses</small>
          </div>
        ))}
      </div>
    </Panel>
  );
}
export function FinancialAlerts({ data }: { data: Store }) {
  const { money } = useFormat();
  const deficits = data.activities.flatMap((a) =>
    a.departments.flatMap((d) => {
      const s = summarize(data, a.id, d.id);
      return s.available < 0
        ? [
            {
              id: d.id,
              name: `${a.name} / ${d.name}`,
              value: -s.available,
              to: `/treasurer/activities/${a.id}`,
            },
          ]
        : [];
    }),
  );
  const over = data.expenses.filter(
    (e) =>
      e.state !== 'Declined' &&
      data.assignments.some((t) => t.expenseId === e.id && e.amount > t.budget),
  );
  return (
    <Panel
      title="Budget attention"
      subtitle="Item overruns and department deficits have separate limits"
    >
      <div className="treasury-alerts">
        {deficits.map((d) => (
          <Link key={d.id} to={d.to}>
            <Badge tone="danger">Deficit</Badge>
            <span>
              {d.name}
              <small className="cell-sub">Available funds below zero by {money(d.value)}</small>
            </span>
          </Link>
        ))}
        {over.map((e) => (
          <Link key={e.id} to={`/treasurer/claims/${e.id}/risk`}>
            <Badge tone="gold">Item variance</Badge>
            <span>
              {e.description}
              <small className="cell-sub">Review justification and budget impact</small>
            </span>
          </Link>
        ))}
        {!deficits.length && !over.length && (
          <Empty title="Within the current plan">
            No item overruns or department deficits are recorded.
          </Empty>
        )}
      </div>
    </Panel>
  );
}
export function TreasuryLifecycle({ data }: { data: Store }) {
  const s = summarize(data);
  const { money } = useFormat();
  return (
    <div className="budget-pulse">
      <div>
        <span className="eyebrow">THE WHOLE FINANCIAL PICTURE</span>
        <h2>{money(s.available)} available to plan</h2>
        <p>
          {money(s.pending)} awaiting decision · {money(s.committed)} committed · {money(s.paid)}{' '}
          payments recorded
        </p>
      </div>
      <div className="pulse-progress">
        <div className="row between">
          <span>Budget utilization</span>
          <strong>{s.utilization.toFixed(1)}%</strong>
        </div>
        <Progress
          value={s.utilization}
          label="Overall budget utilization"
          tone={s.utilization > 100 ? 'danger' : 'green'}
        />
      </div>
    </div>
  );
}
