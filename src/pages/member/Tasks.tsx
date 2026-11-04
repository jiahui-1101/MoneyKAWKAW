import { Search } from 'lucide-react';
import { useState } from 'react';
import { useMember } from '../../context/member-context';
import { purchasingStatuses } from '../../domain/models';
import { departmentToday, isOverdue } from '../../domain/hod';
import { MemberTaskTable } from '../../components/member/MemberTables';
import { PageHeader, Panel } from '../../components/ui';
export function MemberTasks() {
  const {data}=useMember();const [query,setQuery]=useState(''),[scope,setScope]=useState(''),[status,setStatus]=useState(''),[team,setTeam]=useState(false),[overdue,setOverdue]=useState(false);
  if(!data)return null;const today=departmentToday(data.settings.timezone);
  const tasks=data.assignments.filter(t=>(team||t.purchasing?.assigneeId===data.userId)&&(!scope||`${t.activityId}:${t.departmentId}`===scope)&&(!status||t.purchasing?.status===status)&&(!overdue||isOverdue(t,today))&&[t.purchasing?.name,t.purchasing?.description,data.directory.users.find(u=>u.id===t.purchasing?.assigneeId)?.name].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.purchasing!.dueDate.localeCompare(b.purchasing!.dueDate));
  return <div className="stack"><PageHeader eyebrow="PURCHASING RESPONSIBILITIES" title="Your next purchase, clearly planned." description="Follow your own assignments and coordinate with your department. Your HOD manages the purchasing plan."/>
    <Panel title={team?'Department coordination':'My purchasing tasks'} subtitle={team?'View colleagues’ purchase plans; private reimbursement details stay with their owner.':'The same budgets, assignees, and deadlines set by your HOD.'}>
      <div className="member-tabs"><button aria-pressed={!team} className={!team?'selected':''} onClick={()=>setTeam(false)}>My purchases</button><button aria-pressed={team} className={team?'selected':''} onClick={()=>setTeam(true)}>Department coordination</button></div>
      <div className="filters"><div className="search-field"><Search size={16}/><input aria-label="Search purchasing tasks" placeholder="Purchase, description, member…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="filter-selects"><select aria-label="Activity and department" value={scope} onChange={e=>setScope(e.target.value)}><option value="">All my departments</option>{data.scopes.map(s=><option key={`${s.activity.id}:${s.department.id}`} value={`${s.activity.id}:${s.department.id}`}>{s.activity.name} · {s.department.name}</option>)}</select><select aria-label="Purchasing status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All stages</option>{purchasingStatuses.map(s=><option key={s}>{s}</option>)}</select><button className={`btn ${overdue?'selected':''}`} aria-pressed={overdue} onClick={()=>setOverdue(v=>!v)}>Overdue only</button><button className="btn" onClick={()=>{setQuery('');setScope('');setStatus('');setOverdue(false);}}>Clear filters</button></div></div>
      <p className="member-result" role="status">{tasks.length} matching purchases</p><MemberTaskTable tasks={tasks} data={data}/>
    </Panel>
  </div>;
}
