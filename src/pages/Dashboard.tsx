import { ArrowUpRight, CalendarDays, Plus, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useWorkspace } from '../context/Workspace';
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
import { PageHeader, Panel, Progress, TextLink, useFormat } from '../components/ui';

export function Dashboard({ budgets = false }: { budgets?: boolean }) {
  const { store } = useWorkspace();
  const { money } = useFormat();
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
  const active = activities.filter((a) => a.status === 'Active').length;
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
      <div className="budget-pulse">
        <div className="row">
          <span className="pulse-icon">
            <ShieldCheck size={21} />
          </span>
          <div>
            <h2>Your budget, at a glance.</h2>
            <p>
              {active} active {active === 1 ? 'activity' : 'activities'} <span>·</span>{' '}
              {money(summary.paid, true)} paid in sample records <span>·</span>{' '}
              {money(summary.pending, true)} pending review
            </p>
          </div>
        </div>
        <div className="pulse-progress">
          <div className="row between">
            <span>Overall utilization</span>
            <strong>{summary.utilization.toFixed(1)}%</strong>
          </div>
          <Progress
            value={summary.utilization}
            label="Overall budget utilization"
            tone={summary.recorded > summary.budget ? 'danger' : 'brand'}
          />
        </div>
      </div>
      <Overspending store={filtered} />
      {budgets && <BudgetLifecycle summary={summary} />}
      <div className="chart-grid">
        <BudgetComparison activities={activities} store={store} />
        <Distribution activities={activities} />
      </div>
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
