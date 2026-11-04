import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMember } from '../../context/member-context';
import { reviewStates } from '../../domain/treasury';
import { MemberClaimTable } from '../../components/member/MemberTables';
import { Badge, PageHeader, Panel } from '../../components/ui';
export function MemberClaims() {
  const {data}=useMember();const [query,setQuery]=useState(''),[status,setStatus]=useState(''),[activity,setActivity]=useState('');if(!data)return null;
  const claims=data.expenses.filter(e=>(!status||e.state===status)&&(!activity||e.activityId===activity)&&`${e.id} ${e.description}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date));
  return <div className="stack"><PageHeader eyebrow="MY REIMBURSEMENT RECORDS" title="From submitted to received, in one place." description="Track your own evidence, Treasurer decisions, recorded payments, and receipt confirmation."/>
    {!!data.drafts.length&&<Panel title="My saved claim drafts" subtitle="Preparation only · draft amounts do not affect financial totals"><div className="member-content stack">{data.drafts.map(d=><div className="row between wrap" key={d.id}><div><strong>{data.assignments.find(t=>t.id===d.taskId)?.purchasing?.name}</strong><small className="cell-sub">Saved preparation · original receipt remains private</small></div><Link className="btn" to={`/member/drafts/${d.id}`}>Continue draft</Link></div>)}</div></Panel>}
    <Panel title="My submitted claims" subtitle="Review and payment statuses come from the shared Treasurer records"><div className="member-tabs">{['',...reviewStates].map(s=><button key={s} aria-pressed={status===s} className={status===s?'selected':''} onClick={()=>setStatus(s)}>{s||'All my claims'}</button>)}</div><div className="filters"><div className="search-field"><Search size={16}/><input aria-label="Search my claims" placeholder="Claim ID or purpose…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="filter-selects"><select aria-label="Claim activity" value={activity} onChange={e=>setActivity(e.target.value)}><option value="">All my activities</option>{[...new Map(data.scopes.map(s=>[s.activity.id,s.activity])).values()].map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="btn" onClick={()=>{setQuery('');setStatus('');setActivity('');}}>Clear filters</button></div></div><p className="member-result" role="status"><Badge tone="neutral">{claims.length} matching claims</Badge></p><MemberClaimTable claims={claims} data={data}/></Panel>
  </div>;
}
