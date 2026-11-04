import { CalendarDays, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMember } from '../../context/member-context';
import { MemberTaskTable, memberDepartmentPath } from '../../components/member/MemberTables';
import { Badge, Empty, PageHeader, Panel, useFormat } from '../../components/ui';
export function MemberActivities() {
  const {data}=useMember(),{date}=useFormat();const [query,setQuery]=useState('');if(!data)return null;
  const scopes=data.scopes.filter(s=>`${s.activity.name} ${s.department.name}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="stack"><PageHeader eyebrow="MY ACTIVITIES & DEPARTMENTS" title="A shared purpose. Your own place in it." description="Explore the activities and teams where you hold an explicit Member membership."/>
    <Panel title="My department workspaces" subtitle="Only your active memberships appear here"><div className="filters"><div className="search-field"><Search size={16}/><input aria-label="Search my activities" placeholder="Activity or department…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div className="member-scope-grid">{scopes.map(s=><article className="department-card" key={`${s.activity.id}:${s.department.id}`}><div className="row between"><span className="department-icon"><CalendarDays size={20}/></span><Badge tone="green">Member</Badge></div><h2>{s.activity.name}</h2><p>{s.department.name} · {s.activity.type}</p><small>{date(s.activity.startDate)} — {date(s.activity.endDate)}</small><p className="field-hint">HOD: {s.department.head||'Not assigned'}</p><Link className="btn" to={memberDepartmentPath(s.activity.id,s.department.id)}>Open department</Link></article>)}</div>{!scopes.length&&<Empty title="No matching memberships" action={query?<button className="btn" onClick={()=>setQuery('')}>Clear search</button>:undefined}>Your Director manages department membership. Choose another search or refresh after a membership change.</Empty>}</Panel>
  </div>;
}
export function MemberDepartment() {
  const {activityId,departmentId}=useParams(),{data}=useMember();if(!data)return null;
  const scope=data.scopes.find(s=>s.activity.id===activityId&&s.department.id===departmentId);
  if(!scope)return <Empty title="Department access restricted" action={<Link className="btn" to="/member/activities">My activities</Link>}>This department is outside your active Member membership.</Empty>;
  const tasks=data.assignments.filter(t=>t.activityId===activityId&&t.departmentId===departmentId),members=data.directory.memberships.filter(m=>m.active&&m.activityId===activityId&&m.departmentId===departmentId);
  return <div className="stack"><Link className="back-link" to="/member/activities">← My activities / Department</Link><PageHeader eyebrow={scope.activity.name.toUpperCase()} title={scope.department.name} description={scope.department.description||scope.activity.description}/>
    <div className="member-scope-banner"><div><span className="eyebrow">DEPARTMENT HOD</span><h2>{scope.department.head||'Not assigned'}</h2></div><p>{tasks.length} shared purchasing tasks · {members.length} active team members</p><Badge tone="neutral">Coordination view</Badge></div>
    <Panel title="The people behind the plan" subtitle="Department roster and public purchasing responsibilities"><div className="member-roster">{members.map(m=><article key={`${m.userId}:${m.role}`}><span className="avatar">{data.directory.users.find(u=>u.id===m.userId)?.name.split(' ').map(n=>n[0]).join('')}</span><div><strong>{data.directory.users.find(u=>u.id===m.userId)?.name}</strong><small>{m.role}{m.userId===data.userId?' · you':''} · {tasks.filter(t=>t.purchasing!.assigneeId===m.userId).length} assignments</small></div></article>)}</div></Panel>
    <Panel title="Department purchasing tasks" subtitle="You can view your colleagues’ plans. Only your own tasks have update and claim actions."><MemberTaskTable tasks={tasks} data={data}/></Panel>
  </div>;
}
