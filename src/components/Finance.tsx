import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  FolderKanban,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { summarize } from '../domain/budget';
import { MetricCards } from './MetricCards';
import type { Activity, BudgetSummary, Store } from '../domain/models';
import { Badge, Empty, Panel, Progress, Status, TextLink, useFormat } from './ui';

export function Metrics({ summary, count }: { summary: BudgetSummary; count?: number }) {
  const { money } = useFormat();
  const items = [
    {
      label: count === undefined ? 'Overall budget' : 'Total allocated budget',
      value: money(summary.budget, true),
      icon: Wallet,
      note: count === undefined ? 'Activity budget ceiling' : 'Overall budgets across activities',
      tone: 'brand',
    },
    {
      label: 'Recorded expenses',
      value: money(summary.recorded, true),
      icon: CircleDollarSign,
      note: 'Pending + approved claims',
      tone: 'violet',
    },
    {
      label: 'Remaining budget',
      value: money(summary.remaining, true),
      icon: ArrowDownLeft,
      note: 'Budget less recorded expenses',
      tone: summary.remaining < 0 ? 'danger' : 'green',
    },
    {
      label: count === undefined ? 'Budget utilization' : 'Total activities',
      value:
        count === undefined ? `${summary.utilization.toFixed(1)}%` : String(count).padStart(2, '0'),
      icon: count === undefined ? ArrowUpRight : FolderKanban,
      note:
        count === undefined ? 'Recorded expenses / overall budget' : 'Every idea, in one workspace',
      tone: 'gold',
    },
  ];
  return <MetricCards items={items} />;
}

export function BudgetLifecycle({ summary }: { summary: BudgetSummary }) {
  const { money } = useFormat();
  return (
    <div className="lifecycle">
      {[
        ['Department allocations', summary.allocated, 'Portion assigned to departments'],
        ['Committed', summary.committed, 'Open assignments + approved unpaid'],
        ['Pending review', summary.pending, 'Submitted claims awaiting decision'],
        ['Paid (sample records)', summary.paid, 'Recorded separately from approval'],
        ['Available to plan', summary.available, 'Budget less paid, pending, committed'],
      ].map(([label, amount, note]) => (
        <div key={label}>
          <small>{label}</small>
          <strong className={`money ${Number(amount) < 0 ? 'danger-text' : ''}`}>
            {money(Number(amount))}
          </strong>
          <span>{note}</span>
        </div>
      ))}
    </div>
  );
}

export function ActivityTable({
  activities,
  store,
  limit,
}: {
  activities: Activity[];
  store: Store;
  limit?: number;
}) {
  const { money, date } = useFormat();
  if (!activities.length)
    return (
      <Empty title="No activities found">
        Try a different search or create an activity to get started.
      </Empty>
    );
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Scrollable financial table"
    >
      <table>
        <thead>
          <tr>
            <th>ACTIVITY</th>
            <th>STATUS</th>
            <th>BUDGET</th>
            <th>EXPENSES</th>
            <th>UTILIZATION</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {activities.slice(0, limit).map((a, i) => {
            const s = summarize(store, a.id);
            const warning = s.utilization >= store.settings.warningPercent;
            return (
              <tr key={a.id}>
                <td>
                  <div className="row">
                    <span className={`activity-icon chart-color-${i % 5}`}>
                      <CalendarDays size={17} />
                    </span>
                    <div>
                      <Link className="activity-name" to={`/director/activities/${a.id}`}>
                        {a.name}
                      </Link>
                      <small className="cell-sub">
                        {a.type} <span>·</span> {date(a.startDate)}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <Status value={a.status} />
                </td>
                <td className="money">{money(a.budget, true)}</td>
                <td className="money">{money(s.recorded, true)}</td>
                <td>
                  <div className="utilization-cell">
                    <span className={s.recorded > s.budget ? 'danger-text' : ''}>
                      {s.utilization.toFixed(0)}%
                    </span>
                    <Progress
                      value={s.utilization}
                      tone={s.recorded > s.budget ? 'danger' : warning ? 'gold' : 'green'}
                      label={`${a.name} utilization`}
                    />
                  </div>
                </td>
                <td>
                  <Link
                    className="table-arrow"
                    to={`/director/activities/${a.id}`}
                    aria-label={`View ${a.name}`}
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BudgetComparison({ activities, store, root='/director' }: { activities: Activity[]; store: Store; root?: string }) {
  const { money } = useFormat();
  const max = Math.max(
    ...activities.map((a) => Math.max(a.budget, summarize(store, a.id).recorded)),
    1,
  );
  return (
    <Panel
      title="Budget & spending"
      subtitle="A clear view of where each activity stands"
      action={
        <div className="chart-legend">
          <span>
            <i className="swatch budget-swatch" />
            Budget
          </span>
          <span>
            <i className="swatch expense-swatch" />
            Expenses
          </span>
        </div>
      }
    >
      {!activities.length ? (
        <Empty title="Your budget story starts here">
          Create an activity to see its spending breakdown.
        </Empty>
      ) : (
        <div
          className="comparison-chart"
          role="img"
          aria-label="Activity budget and recorded expense comparison. Exact figures follow each activity."
        >
          {activities.map((a) => {
            const recorded = summarize(store, a.id).recorded;
            return (
              <div className="comparison-row" key={a.id}>
                <Link to={`${root}/activities/${a.id}`}>{a.name}</Link>
                <div className="comparison-bars">
                  <div
                    className="comparison-budget"
                    style={{ width: `${(a.budget / max) * 100}%` }}
                  />
                  <div
                    className="comparison-expense"
                    style={{ width: `${(recorded / max) * 100}%` }}
                  />
                </div>
                <div className="comparison-value">
                  <strong>{money(recorded, true)}</strong>
                  <small>of {money(a.budget, true)}</small>
                </div>
              </div>
            );
          })}
          <div className="chart-axis">
            <span>0</span>
            <span>{money(max / 2, true)}</span>
            <span>{money(max, true)}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function Distribution({ activities }: { activities: Activity[] }) {
  const { money } = useFormat();
  const total = activities.reduce((s, a) => s + a.budget, 0);
  let offset = 0;
  return (
    <Panel title="Budget distribution" subtitle="Overall budget by activity">
      <div className="distribution">
        <div className="donut">
          <svg viewBox="0 0 180 180" role="img" aria-label={`Total overall budget ${money(total)}`}>
            <circle cx="90" cy="90" r="70" className="donut-track" fill="none" strokeWidth="19" />
            {activities
              .filter((a) => a.budget > 0)
              .map((a, i) => {
                const fraction = total ? a.budget / total : 0;
                const start = offset;
                offset += fraction;
                return (
                  <circle
                    key={a.id}
                    className={`donut-segment chart-color-${i % 5}`}
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
            <small>TOTAL BUDGET</small>
            <strong>{money(total, true)}</strong>
            <span>{activities.length} activities</span>
          </div>
        </div>
        <div className="distribution-legend">
          {activities.map((a, i) => (
            <Link key={a.id} to={`/director/activities/${a.id}`}>
              <span className={`swatch chart-color-${i % 5}`} />
              <span>{a.name}</span>
              <strong>{total ? ((a.budget / total) * 100).toFixed(0) : 0}%</strong>
            </Link>
          ))}
          {!activities.length && <p className="muted">No budget allocated yet.</p>}
        </div>
      </div>
    </Panel>
  );
}

export function RecentActivity({
  store,
  activityId,
  all = false,
}: {
  store: Store;
  activityId?: string;
  all?: boolean;
}) {
  const { time } = useFormat();
  const events = store.events.filter((e) => !activityId || e.activityId === activityId);
  return (
    <Panel
      title={all ? 'Workspace history' : 'Recent activity'}
      subtitle="Setup changes and sample financial history"
      action={!all && <TextLink to="/director/history">View all</TextLink>}
    >
      <div className="timeline">
        {events.slice(0, all ? undefined : 4).map((e) => (
          <div className="timeline-item" key={e.id}>
            <span className="timeline-icon">
              <ActivityIcon action={e.action} />
            </span>
            <div>
              <Link to={`/director/activities/${e.activityId}`}>{e.action}</Link>
              <p>
                {store.activities.find((a) => a.id === e.activityId)?.name} <span>·</span> {e.actor}
              </p>
              {all && (
                <details>
                  <summary>Change details</summary>
                  <p className="audit-detail">{e.detail}</p>
                </details>
              )}
            </div>
            <time dateTime={e.at}>{time(e.at)}</time>
          </div>
        ))}
        {!events.length && (
          <Empty title="A fresh start">
            Your activity and department changes will appear here.
          </Empty>
        )}
      </div>
    </Panel>
  );
}
function ActivityIcon({ action }: { action: string }) {
  return action.includes('created') ? (
    <FolderKanban size={15} />
  ) : action.includes('Expense') ? (
    <CircleDollarSign size={15} />
  ) : (
    <Wallet size={15} />
  );
}

export function Overspending({ store, activityId }: { store: Store; activityId?: string }) {
  const { money } = useFormat();
  const exceeded = store.activities
    .filter((a) => !activityId || a.id === activityId)
    .flatMap((a) => {
      const total = summarize(store, a.id);
      const rows =
        total.recorded > a.budget
          ? [{ name: a.name, id: a.id, over: total.recorded - a.budget }]
          : [];
      return [
        ...rows,
        ...a.departments.flatMap((d) => {
          const s = summarize(store, a.id, d.id);
          return s.recorded > d.allocation
            ? [{ name: `${a.name} / ${d.name}`, id: a.id, over: s.recorded - d.allocation }]
            : [];
        }),
      ];
    });
  return exceeded.length ? (
    <div className="overspending" role="status">
      <Badge tone="danger">Budget attention</Badge>
      {exceeded.map((e) => (
        <Link key={e.name} to={`/director/activities/${e.id}/budget`}>
          {e.name}: recorded expenses exceed budget by <strong>{money(e.over)}</strong>
          <ArrowUpRight size={13} />
        </Link>
      ))}
    </div>
  ) : null;
}
