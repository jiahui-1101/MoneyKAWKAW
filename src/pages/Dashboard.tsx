import { ArrowUpRight, CalendarDays, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { activityStatuses } from '../domain/models';
import { summarize } from '../domain/budget';
import {
  ActivityTable,
  BudgetComparison,
  BudgetLifecycle,
  Distribution,
  Metrics,
  Overspending,
  RecentActivity,
} from '../components/Finance';
import { PageHeader, Panel, TextLink } from '../components/ui';
import { BudgetInsights } from '../components/charts/Insights';

export function Dashboard({ budgets = false }: { budgets?: boolean }) {
  const { store } = useWorkspace();
  const [status, setStatus] = useState('');
  const [activityId, setActivityId] = useState('');
  if (!store) return null;
  const activities = store.activities.filter(
    (a) => (!status || a.status === status) && (!activityId || a.id === activityId),
  );
  const filtered = {
    ...store,
    activities,
    events: store.events.filter((e) => activities.some((a) => a.id === e.activityId)),
  };
  const summary = summarize(filtered);
  return (
    <div className="stack dashboard">
      <PageHeader
        eyebrow="YOUR DIRECTOR WORKSPACE"
        title={budgets ? 'Every budget. One clear picture.' : 'A little clarity. A bigger impact.'}
        description={
          budgets
            ? 'Follow allocations, commitments, and recorded spending across your club.'
            : 'Your club’s activities and finances, thoughtfully brought together.'
        }
      >
        <Link className="btn primary" to="/director/activities/new">
          <Plus size={16} />
          Create activity
        </Link>
      </PageHeader>
      <div className="overview-toolbar">
        <div className="row">
          <span className="section-label">
            {budgets ? 'Budget overview' : 'Financial overview'}
          </span>
          <span className="period-tag">
            <CalendarDays size={12} />
            All activity dates
          </span>
        </div>
        <div className="row">
          <label className="sr-only" htmlFor="overview-activity">
            Filter by activity
          </label>
          <select
            id="overview-activity"
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
          >
            <option value="">All activities</option>
            {store.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="overview-status">
            Filter by status
          </label>
          <select id="overview-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {activityStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <Metrics summary={summary} count={activities.length} />
      <BudgetInsights store={store} activityIds={activities.map((a) => a.id)} />
      <Overspending store={filtered} />
      {budgets && <BudgetLifecycle summary={summary} />}
      <div className="chart-grid">
        <BudgetComparison activities={activities} store={store} />
        <Distribution activities={activities} />
      </div>
      {!budgets && <BudgetLifecycle summary={summary} />}
      <Panel
        title="Activities overview"
        subtitle="From first idea to final expense"
        action={<TextLink to="/director/activities">All activities</TextLink>}
      >
        <ActivityTable activities={activities} store={store} limit={5} />
        <div className="table-footer">
          <span>
            Showing {Math.min(activities.length, 5)} of {activities.length} activities
          </span>
          <Link className="text-link" to="/director/activities">
            Manage activities <ArrowUpRight size={13} />
          </Link>
        </div>
      </Panel>
      <RecentActivity store={filtered} />
    </div>
  );
}
