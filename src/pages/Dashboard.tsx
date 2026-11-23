import { CircleDollarSign, Clock3, FileStack, FolderKanban, LayoutDashboard, PieChart, Plus, Wallet, Gauge as GaugeIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { activityStatuses } from '../domain/models';
import { summarize } from '../domain/budget';
import { ActivityTable, Overspending, RecentActivity } from '../components/Finance';
import { PageHeader, useFormat } from '../components/ui';
import { ChartCard } from '../components/charts/Charts';
import { DashTabs, KpiTiles, TabPanel } from '../components/charts/Interactive';
import { ActivityBars, BudgetDonut, BudgetFlow, ClaimCards, DepartmentBars, SpendTrend, UtilisationHeat } from '../components/charts/Views';

type View = 'overview' | 'budget' | 'claims' | 'activities';

export function Dashboard({ budgets = false }: { budgets?: boolean }) {
  const { store } = useWorkspace();
  const { money } = useFormat();
  const [status, setStatus] = useState('');
  const [view, setView] = useState<View>(budgets ? 'budget' : 'overview');
  const [picked, setPicked] = useState<string | null>(null);
  if (!store) return null;
  const activities = store.activities.filter((a) => !status || a.status === status);
  const ids = new Set(activities.map((a) => a.id));
  const scoped = {
    ...store,
    activities,
    expenses: store.expenses.filter((e) => ids.has(e.activityId)),
    events: store.events.filter((e) => ids.has(e.activityId)),
  };
  const s = summarize(scoped);
  const used = s.paid + s.pending + s.committed;
  return (
    <div className="stack dashboard">
      <PageHeader eyebrow="DIRECTOR" title={budgets ? 'Budgets' : 'Overview'}>
        <label className="sr-only" htmlFor="overview-status">Filter by status</label>
        <select id="overview-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {activityStatuses.map((x) => <option key={x}>{x}</option>)}
        </select>
        <Link className="btn primary" to="/director/activities/new"><Plus size={16} />Activity</Link>
      </PageHeader>
      <KpiTiles items={[
        { label: 'Budget', value: money(s.budget, true), icon: Wallet, tone: 'var(--ai-purple)' },
        { label: 'Used', value: `${s.budget ? ((used / s.budget) * 100).toFixed(0) : 0}%`, icon: GaugeIcon, tone: used > s.budget ? 'var(--ai-magenta)' : 'var(--ai-blue)', meter: s.budget ? (used / s.budget) * 100 : 0 },
        { label: 'Paid', value: money(s.paid, true), icon: CircleDollarSign, tone: 'var(--ai-green)' },
        { label: 'Pending', value: money(s.pending, true), icon: Clock3, tone: 'var(--ai-orange)', onClick: () => setView('claims') },
        { label: 'Activities', value: String(activities.length), icon: FolderKanban, tone: 'var(--ai-magenta)', onClick: () => setView('activities') },
      ]} />
      <DashTabs label="Dashboard sections" value={view} onChange={setView} tabs={[
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'budget', label: 'Budget', icon: PieChart },
        { id: 'claims', label: 'Claims', icon: FileStack, count: scoped.expenses.length },
        { id: 'activities', label: 'Activities', icon: FolderKanban, count: activities.length },
      ]} />
      <TabPanel id={view}>
        {view === 'overview' && <>
          <div className="dash-grid-2">
            <ChartCard title="Where the money is"><BudgetDonut store={scoped} /></ChartCard>
            <ChartCard title="Spend over time"><SpendTrend store={scoped} /></ChartCard>
          </div>
          <ChartCard title="Budget flow" hint="Click a block to trace it"><BudgetFlow store={scoped} /></ChartCard>
          <Overspending store={scoped} />
        </>}
        {view === 'budget' && <>
          <ChartCard title="Department utilisation" hint="Click a cell to drill in"><UtilisationHeat store={scoped} onPick={setPicked} /></ChartCard>
          <div className="dash-grid-2">
            <ChartCard title="By activity" hint="Click to filter departments"><ActivityBars store={scoped} selected={picked} onSelect={setPicked} /></ChartCard>
            <ChartCard title={picked ? `Departments · ${store.activities.find((a) => a.id === picked)?.name}` : 'By department'}><DepartmentBars store={scoped} activityId={picked} /></ChartCard>
          </div>
        </>}
        {view === 'claims' && <>
          <ClaimCards store={scoped} />
          <ChartCard title="Spend over time"><SpendTrend store={scoped} /></ChartCard>
        </>}
        {view === 'activities' && <>
          <ActivityTable activities={activities} store={store} />
          <RecentActivity store={scoped} />
        </>}
      </TabPanel>
    </div>
  );
}
