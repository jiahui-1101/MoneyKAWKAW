import { MoneyMap } from '../../components/charts/MoneyMap';
import { Search, Wallet, CircleDollarSign, ArrowDownLeft, Percent } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { summarize } from '../../domain/budget';
import { MetricCards } from '../../components/MetricCards';
import { ClaimList } from '../../components/treasurer/ClaimList';
import { FinancialAlerts, TreasuryLifecycle } from '../../components/treasurer/FinancialCharts';
import { ActivityClosingPanel } from '../../components/ActivityClosingPanel';
import { financialStateLabel } from '../../domain/activity-closing';
import { demoMode } from '../../services/supabase/client';
import {
  Badge,
  Empty,
  PageHeader,
  Panel,
  Progress,
  TextLink,
  useFormat,
} from '../../components/ui';

export function TreasuryActivities() {
  const { data } = useTreasury();
  const { money } = useFormat();
  const [query, setQuery] = useState(''),
    [type, setType] = useState(''),
    [stage, setStage] = useState('');
  if (!data) return null;
  const activities = data.activities.filter(
    (a) => a.name.toLowerCase().includes(query.toLowerCase()) && (!type || a.type === type) &&
      (!stage || (stage === 'Closing' ? !!a.financialState && !['Open', 'Archived'].includes(a.financialState)
        : (a.financialState ?? 'Open') === stage)),
  );
  return (
    <div className="stack">
      <PageHeader
        eyebrow="ACTIVITY FINANCES"
        title="Activity finances"
        description="Budgets for activities you manage. Only the Director can change budgets."
      />
      <Panel
        title="Your activities"
        subtitle={`${data.activities.length} activities · budgets are managed by the Director`}
      >
        <div className="filters">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search activities"
              placeholder="Search activities…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="compact-select"
            aria-label="Activity type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {[...new Set(data.activities.map((a) => a.type))].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {!demoMode && <select className="compact-select" aria-label="Stage" value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="">All stages</option>
            <option>Open</option><option>Closing</option><option>Archived</option>
          </select>}
        </div>
        {activities.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Activity financial overview"
          >
            <table>
              <thead>
                <tr>
                  {[
                    'ACTIVITY',
                    'OVERALL BUDGET',
                    'GIVEN TO DEPTS',
                    'CLAIMED',
                    'FREE TO SPEND',
                    'WAITING REVIEW',
                    'USED %',
                    'BUDGET HEALTH',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => {
                  const s = summarize(data, a.id);
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link className="activity-name" to={`/treasurer/activities/${a.id}`}>
                          {a.name}
                        </Link>
                        <small className="cell-sub">
                          {a.type} · {financialStateLabel(a.financialState, a.status)}
                        </small>
                      </td>
                      <td className="money">{money(s.budget)}</td>
                      <td className="money">{money(s.allocated)}</td>
                      <td className="money">{money(s.recorded)}</td>
                      <td className={`money ${s.available < 0 ? 'danger-text' : ''}`}>
                        {money(s.available)}
                      </td>
                      <td className="money">{money(s.pending)}</td>
                      <td>
                        <div className="utilization-cell">
                          <span>{s.utilization.toFixed(1)}%</span>
                          <Progress value={s.utilization} label={`${a.name} utilization`} />
                        </div>
                      </td>
                      <td>
                        <Badge
                          tone={
                            s.available < 0
                              ? 'danger'
                              : s.utilization >= data.settings.warningPercent
                                ? 'gold'
                                : 'green'
                          }
                        >
                          {s.available < 0
                            ? 'Over budget'
                            : s.utilization >= data.settings.warningPercent
                              ? 'Nearly used up'
                              : 'On track'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching activities"
            action={
              <button
                className="btn"
                onClick={() => {
                  setQuery('');
                  setType('');
                  setStage('');
                }}
              >
                Clear filters
              </button>
            }
          >
            Try another activity name or type.
          </Empty>
        )}
      </Panel>
    </div>
  );
}
export function TreasuryActivityDetail({ closing = false }: { closing?: boolean }) {
  const { id } = useParams();
  const { data, reload } = useTreasury();
  const { money } = useFormat();
  if (!data) return null;
  const activity = data.activities.find((a) => a.id === id);
  if (!activity)
    return (
      <Empty
        title="Activity not found"
        action={
          <Link className="btn" to="/treasurer/activities">
            Back to activities
          </Link>
        }
      >
        This activity doesn’t exist or you don’t manage it.
      </Empty>
    );
  if (closing && !demoMode) return (
    <div className="stack">
      <Link className="back-link" to={`/treasurer/activities/${activity.id}`}>← Back to activity</Link>
      <PageHeader eyebrow="CLOSING THE ACTIVITY" title={activity.name} description={activity.description} />
      <ActivityClosingPanel key={activity.id} activity={activity} workspaceRole="Treasurer" reload={reload} />
    </div>
  );
  const scope = {
    ...data,
    activities: [activity],
    expenses: data.expenses.filter((e) => e.activityId === id),
  };
  const s = summarize(scope);
  return (
    <div className="stack">
      <Link className="back-link" to="/treasurer/activities">
        ← Back to activities
      </Link>
      <PageHeader
        eyebrow={`${activity.type.toUpperCase()} · ${financialStateLabel(activity.financialState, activity.status)}`}
        title={activity.name}
        description={activity.description}
      >
        <TextLink to={`/treasurer/history?activity=${id}`}>Payment history</TextLink>
        {!demoMode && <TextLink to={`/treasurer/activities/${id}/closing`}>Close activity</TextLink>}
      </PageHeader>
      <MetricCards
        items={[
          {
            label: 'Activity budget',
            value: money(s.budget, true),
            icon: Wallet,
            note: 'Set by the Director',
          },
          {
            label: 'Claimed',
            value: money(s.recorded, true),
            icon: CircleDollarSign,
            note: 'Approved + paid claims',
            tone: 'violet',
          },
          {
            label: 'Left after claims',
            value: money(s.remaining, true),
            icon: ArrowDownLeft,
            note: 'Budget minus claimed',
            tone: 'green',
          },
          {
            label: 'Used %',
            value: `${s.utilization.toFixed(1)}%`,
            icon: Percent,
            note: 'Claimed ÷ budget',
            tone: 'gold',
          },
        ]}
      />
      <Panel title="Money map" subtitle="Tap a box to see where its money comes from and goes, or show it as a list">
        <div className="panel-body"><MoneyMap store={data} activity={activity} claimHref={(cid) => `/treasurer/claims/${cid}`} /></div>
      </Panel>
      <TreasuryLifecycle data={scope} />
      <FinancialAlerts data={scope} />
      <Panel
        title="Spending by department"
        subtitle="“Free to spend” also subtracts unfinished purchases"
      >
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Department balances">
          <table>
            <thead>
              <tr>
                {[
                  'DEPARTMENT',
                  'BUDGET',
                  'CLAIMED',
                  'WAITING REVIEW',
                  'SET ASIDE',
                  'PAID',
                  'FREE TO SPEND',
                  'USED %',
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.departments.map((d) => {
                const b = summarize(data, id, d.id);
                return (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.name}</strong>
                      <small className="cell-sub">{d.head || 'No HOD assigned'}</small>
                    </td>
                    {[b.budget, b.recorded, b.pending, b.committed, b.paid, b.available].map(
                      (n, i) => (
                        <td key={i} className={`money ${n < 0 ? 'danger-text' : ''}`}>
                          {money(n)}
                        </td>
                      ),
                    )}
                    <td>{b.utilization.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!activity.departments.length && (
          <Empty title="No departments yet">
            Ask the Director to add departments and budgets.
          </Empty>
        )}
      </Panel>
      <Panel
        title="Claims in this activity"
        subtitle="Filter by department, member, date or status"
      >
        <ClaimList activityId={id} />
      </Panel>
    </div>
  );
}
