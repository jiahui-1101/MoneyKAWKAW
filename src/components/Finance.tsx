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
import { financialStateLabel } from '../domain/activity-closing';
import { MetricCards } from './MetricCards';
import type { Activity, BudgetSummary, Store } from '../domain/models';
import { Badge, Empty, Panel, Progress, Status, TextLink, useFormat } from './ui';
import { demoMode } from '../services/supabase/client';

export function Metrics({ summary, count }: { summary: BudgetSummary; count?: number }) {
  const { money } = useFormat();
  const items = [
    {
      label: count === undefined ? 'Activity budget' : 'All activity budgets',
      value: money(summary.budget, true),
      icon: Wallet,
      note: count === undefined ? 'Most this activity can spend' : 'All activities added up',
      tone: 'brand',
    },
    {
      label: 'Claimed',
      value: money(summary.recorded, true),
      icon: CircleDollarSign,
      note: demoMode ? 'Waiting for review + approved claims' : 'Paid + approved, not paid yet',
      tone: 'violet',
    },
    {
      label: demoMode ? 'Left after claims' : 'Free to spend',
      value: money(demoMode ? summary.remaining : summary.available, true),
      icon: ArrowDownLeft,
      note: demoMode ? 'Budget minus claimed' : 'Left after paid and set-aside money',
      tone: (demoMode ? summary.remaining : summary.available) < 0 ? 'danger' : 'green',
    },
    {
      label: count === undefined ? 'Used %' : 'Total activities',
      value:
        count === undefined ? `${summary.utilization.toFixed(1)}%` : String(count).padStart(2, '0'),
      icon: count === undefined ? ArrowUpRight : FolderKanban,
      note:
        count === undefined ? 'Claimed ÷ budget' : 'Every activity in your club',
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
        ['Given to departments', summary.allocated, 'Part of the budget given to departments'],
        ['Set aside', summary.committed, 'Kept for open purchases and approved claims'],
        ['Waiting for review', summary.pending, 'Claims sent in, not decided yet'],
        ['Approved, not paid yet', Math.max(0, summary.recorded - summary.paid - (demoMode ? summary.pending : 0)), 'Waiting for the Treasurer to pay'],
        ['Paid', summary.paid, 'Money sent · the member confirms separately'],
        ['Free to spend', summary.available, 'Budget minus paid, waiting and set-aside money'],
      ].map(([label, amount, note]) => (
        <div key={label}>
          <small>{label}</small>
          <strong className={`money ${typeof amount === 'number' && amount < 0 ? 'danger-text' : ''}`}>
            {typeof amount === 'number' ? money(amount) : amount}
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
      aria-label="Activities table"
    >
      <table>
        <thead>
          <tr>
            <th>ACTIVITY</th>
            <th>STATUS</th>
            <th>BUDGET</th>
            <th>CLAIMED</th>
            <th>USED %</th>
            <th aria-label="Activity details">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {activities.slice(0, limit).map((a, i) => {
            const s = summarize(store, a.id);
            const utilization = s.utilization;
            const warning = utilization >= store.settings.warningPercent;
            return (
              <tr key={a.id}>
                <td aria-label={a.name}>
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
                  <Status value={financialStateLabel(a.financialState, a.status)} />
                </td>
                <td className="money">{money(a.budget, true)}</td>
                <td className="money">{money(s.recorded, true)}</td>
                <td>
                  <div className="utilization-cell">
                    <span className={utilization > 100 ? 'danger-text' : ''}>
                      {utilization.toFixed(1)}%
                    </span>
                    <Progress
                      value={utilization}
                      tone={utilization > 100 ? 'danger' : warning ? 'gold' : 'green'}
                      label={`${a.name} budget used`}
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

export function BudgetComparison({
  activities,
  store,
  root = '/director',
}: {
  activities: Activity[];
  store: Store;
  root?: string;
}) {
  const { money } = useFormat();
  const amountFor = (activity: Activity) => {
    const summary = summarize(store, activity.id);
    return demoMode ? summary.recorded : summary.committed;
  };
  const max = Math.max(...activities.map((a) => Math.max(a.budget, amountFor(a))), 1);
  return (
    <Panel
      title={demoMode ? 'Budget & spending' : 'Budget vs set aside'}
      subtitle={demoMode ? 'A clear view of where each activity stands' : 'How much of each budget is set aside'}
      action={
        <div className="chart-legend">
          <span>
            <i className="swatch budget-swatch" />
            Budget
          </span>
          <span>
            <i className="swatch expense-swatch" />
            {demoMode ? 'Claimed' : 'Set aside'}
          </span>
        </div>
      }
    >
      {!activities.length ? (
        <Empty title="No activities yet">
          Create an activity to see its spending breakdown.
        </Empty>
      ) : (
        <div
          className="comparison-chart"
          role="group"
          aria-label={`Activity budgets and ${demoMode ? 'recorded expenses' : 'planned purchases'} comparison. Exact figures follow each activity.`}
        >
          {activities.map((a) => {
            const amount = amountFor(a);
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
                    style={{ width: `${(amount / max) * 100}%` }}
                  />
                </div>
                <div className="comparison-value">
                  <strong>{money(amount, true)}</strong>
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
          {!activities.length && <p className="muted">No activities yet.</p>}
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
      title={all ? 'History' : 'Recent changes'}
      subtitle={demoMode ? 'Setup changes and sample financial history' : 'Changes to activities, budgets and purchases'}
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
          <Empty title="No changes yet">
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
      <Badge tone="danger">Over budget</Badge>
      {exceeded.map((e) => (
        <Link key={e.name} to={`/director/activities/${e.id}/budget`}>
          {e.name} is over budget by <strong>{money(e.over)}</strong>
          <ArrowUpRight size={13} />
        </Link>
      ))}
    </div>
  ) : null;
}
