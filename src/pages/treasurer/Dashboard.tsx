import { ArrowUpRight, Banknote, CircleDollarSign, Clock3, FileStack, LayoutDashboard, PieChart, Send, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { summarize } from '../../domain/budget';
import { ChartCard } from '../../components/charts/Charts';
import { tones } from '../../components/charts/Insights';
import { DashTabs, KpiTiles, TabPanel } from '../../components/charts/Interactive';
import { Pipeline } from '../../components/charts/Trends';
import { ActivityBars, BudgetDonut, BudgetFlow, ClaimCards, DepartmentBars, SpendTrend, UtilisationHeat } from '../../components/charts/Views';
import { PageHeader, Panel, TextLink, useFormat } from '../../components/ui';
import { FinancialAlerts } from '../../components/treasurer/FinancialCharts';

type View = 'overview' | 'budget' | 'claims' | 'payments';

export function TreasuryDashboard() {
  const { data } = useTreasury();
  const { money, time } = useFormat();
  const [view, setView] = useState<View>('overview');
  const [picked, setPicked] = useState<string | null>(null);
  if (!data) return null;
  const s = summarize(data);
  const unpaid = data.expenses.filter((e) => e.state === 'Approved' && !data.payments.some((p) => p.expenseId === e.id));
  const awaiting = data.payments.filter((p) => !p.manual?.receivedConfirmedAt).length;
  const toReview = data.expenses.filter((e) => ['Pending review', 'In review'].includes(e.state) || ['Pending', 'Under Review'].includes(e.lifecycle ?? '')).length;
  return (
    <div className="stack dashboard">
      <PageHeader eyebrow="TREASURER" title="Overview">
        <Link className="btn primary" to="/treasurer/claims">Review claims <ArrowUpRight size={15} /></Link>
      </PageHeader>
      <KpiTiles items={[
        { label: 'Budget', value: money(s.budget, true), icon: Wallet, tone: 'var(--ai-purple)', meter: s.utilization },
        { label: 'Recorded', value: money(s.recorded, true), icon: CircleDollarSign, tone: 'var(--ai-blue)' },
        { label: 'To review', value: String(toReview), icon: Clock3, tone: 'var(--ai-orange)', onClick: () => setView('claims') },
        { label: 'To pay', value: String(unpaid.length), icon: Banknote, tone: 'var(--ai-magenta)', onClick: () => setView('payments') },
        { label: 'Paid', value: money(s.paid, true), icon: Send, tone: 'var(--ai-green)' },
      ]} />
      <DashTabs label="Dashboard sections" value={view} onChange={setView} tabs={[
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'budget', label: 'Budget', icon: PieChart },
        { id: 'claims', label: 'Claims', icon: FileStack, count: toReview },
        { id: 'payments', label: 'Payments', icon: Banknote, count: unpaid.length },
      ]} />
      <TabPanel id={view}>
        {view === 'overview' && <>
          <div className="dash-grid-2">
            <ChartCard title="Where the money is"><BudgetDonut store={data} /></ChartCard>
            <ChartCard title="Spend over time"><SpendTrend store={data} /></ChartCard>
          </div>
          <ChartCard title="Budget flow" hint="Click a block to trace it"><BudgetFlow store={data} /></ChartCard>
          <FinancialAlerts data={data} />
        </>}
        {view === 'budget' && <>
          <ChartCard title="Department utilisation" hint="Click a cell to drill in"><UtilisationHeat store={data} onPick={setPicked} /></ChartCard>
          <div className="dash-grid-2">
            <ChartCard title="By activity" hint="Click to filter departments"><ActivityBars store={data} selected={picked} onSelect={setPicked} /></ChartCard>
            <ChartCard title={picked ? `Departments · ${data.activities.find((a) => a.id === picked)?.name}` : 'By department'}><DepartmentBars store={data} activityId={picked} /></ChartCard>
          </div>
        </>}
        {view === 'claims' && <ClaimCards store={data} />}
        {view === 'payments' && <>
          <ChartCard title="Reimbursement flow">
            <Pipeline stages={[
              { label: 'Approved · unpaid', count: unpaid.length, tone: tones.pending },
              { label: 'Paid · awaiting member', count: awaiting, tone: tones.committed },
              { label: 'Member confirmed', count: data.payments.length - awaiting, tone: tones.paid },
            ]} />
          </ChartCard>
          <Panel title="Recent activity" action={<TextLink to="/treasurer/history">Payment history</TextLink>}>
            <div className="timeline">
              {data.events.slice(0, 6).map((e) => (
                <div className="timeline-item" key={e.id}>
                  <span className="timeline-icon"><Wallet size={15} /></span>
                  <div>
                    <Link to={`/treasurer/activities/${e.activityId}`}>{e.action}</Link>
                    <p>{e.actor} · {data.activities.find((a) => a.id === e.activityId)?.name}</p>
                  </div>
                  <time dateTime={e.at}>{time(e.at)}</time>
                </div>
              ))}
            </div>
          </Panel>
        </>}
      </TabPanel>
    </div>
  );
}
