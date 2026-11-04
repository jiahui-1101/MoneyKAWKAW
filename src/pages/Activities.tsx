import { ArrowUpRight, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../context/Workspace';
import { activityStatuses, activityTypes } from '../domain/models';
import { ActivityTable } from '../components/Finance';
import { Empty, PageHeader, Panel } from '../components/ui';

export function Activities() {
  const { store } = useWorkspace();
  const [params, setParams] = useSearchParams();
  if (!store) return null;
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const type = params.get('type') ?? '';
  const sort = params.get('sort') ?? 'start';
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const activities = store.activities.filter(a => `${a.name} ${a.description}`.toLowerCase().includes(q.toLowerCase()) && (!status || a.status === status) && (!type || a.type === type)).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'budget' ? b.budget - a.budget : a.startDate.localeCompare(b.startDate));
  return <div className="stack">
    <PageHeader eyebrow="PLAN WITH PURPOSE" title="Good ideas start here." description="Create, organize, and keep every club activity on track."><Link className="btn primary" to="/director/activities/new"><Plus size={16} />Create activity</Link></PageHeader>
    <div className="activity-intro"><div><span className="eyebrow">YOUR ACTIVITY PORTFOLIO</span><h2>{store.activities.length} activities. Plenty of possibility.</h2><p>Give each one a clear budget and the right team to bring it to life.</p></div><span className="intro-mark"><ArrowUpRight size={37} /></span></div>
    <Panel title="All activities" subtitle="Your club’s plans, in one place" action={<span className="count-label">{activities.length} results</span>}>
      <div className="filters"><div className="search-field"><Search size={16} /><input aria-label="Search activities" placeholder="Search by activity name or description…" value={q} onChange={e => update('q', e.target.value)} /></div><div className="filter-selects"><SlidersHorizontal size={15} className="muted" /><select aria-label="Activity status" value={status} onChange={e => update('status', e.target.value)}><option value="">All statuses</option>{activityStatuses.map(s => <option key={s}>{s}</option>)}</select><select aria-label="Activity type" value={type} onChange={e => update('type', e.target.value)}><option value="">All types</option>{activityTypes.map(t => <option key={t}>{t}</option>)}</select><select aria-label="Sort activities" value={sort} onChange={e => update('sort', e.target.value)}><option value="start">By start date</option><option value="name">By name</option><option value="budget">Highest budget</option></select></div></div>
      {activities.length ? <ActivityTable activities={activities} store={store} /> : <Empty title={store.activities.length ? 'No matching activities' : 'Make room for your next big idea'} action={store.activities.length ? <button className="btn" onClick={() => setParams({})}>Clear filters</button> : <Link className="btn primary" to="/director/activities/new"><Plus size={15} />Create activity</Link>}>{store.activities.length ? 'Try another keyword or clear the filters to see all activities.' : 'Create an activity, set a budget, and bring your team together.'}</Empty>}
      <div className="table-footer"><span>{activities.length} of {store.activities.length} activities</span><span>Amounts in {store.settings.currency}</span></div>
    </Panel>
  </div>;
}
