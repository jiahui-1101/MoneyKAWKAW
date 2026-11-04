import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { claimContext, paymentState } from '../../domain/risk';
import { reviewStates } from '../../domain/treasury';
import { treasuryService } from '../../services/treasury';
import { DateField } from '../DateField';
import { Field } from '../Field';
import { Empty, Status, useFormat } from '../ui';

export function ClaimList({activityId,reimbursements=false}:{activityId?:string;reimbursements?:boolean}) {
  const {data,busy,run}=useTreasury();const {money,date}=useFormat();
  const [params,setParams]=useSearchParams();const navigate=useNavigate();
  const [query,setQuery]=useState(''),[activity,setActivity]=useState(''),[department,setDepartment]=useState('');
  const [member,setMember]=useState(''),[from,setFrom]=useState(''),[until,setUntil]=useState(''),[sort,setSort]=useState('newest'),[error,setError]=useState('');
  if(!data)return null;
  const status=params.get('status')??'';
  const activities=data.activities.filter(a=>!activityId||a.id===activityId);
  const departments=activities.filter(a=>!activity||a.id===activity).flatMap(a=>a.departments.map(d=>({...d,activityName:a.name})));
  const records=data.expenses.filter(e=>(!activityId||e.activityId===activityId)&&(!reimbursements||(e.state==='Approved'&&!data.payments.some(p=>p.expenseId===e.id))))
    .filter(e=>(!status||e.state===status)&&(!activity||e.activityId===activity)&&(!department||e.departmentId===department)&&(!member||e.review?.claimantId===member)&&(!from||e.date>=from)&&(!until||e.date<=until))
    .filter(e=>{
      const c=claimContext(data,e);const name=data.directory?.users.find(u=>u.id===e.review?.claimantId)?.name??'';
      return [e.id,e.description,c.activity.name,c.department.name,c.task?.purchasing?.name,name].join(' ').toLowerCase().includes(query.toLowerCase());
    }).sort((a,b)=>sort==='amount-high'?b.amount-a.amount:sort==='amount-low'?a.amount-b.amount:sort==='oldest'?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
  const clear=()=>{setQuery('');setActivity('');setDepartment('');setMember('');setFrom('');setUntil('');setParams({});};
  const review=async(id:string,expected:string)=>{
    setError('');try{await run(()=>treasuryService.review(id,expected),'Claim is now in review.');navigate(`/treasurer/claims/${id}`);}
    catch(e){setError(e instanceof Error?e.message:'Unable to start review.');}
  };
  return <>
    {!reimbursements&&<div className="treasury-tabs" aria-label="Claim status filters">{['',...reviewStates].map(s=><button key={s} className={s===status?'selected':''} aria-pressed={s===status} onClick={()=>setParams(s?{status:s}:{})}>{s||'All claims'}</button>)}</div>}
    <div className="filters"><div className="search-field"><Search size={16}/><input aria-label="Search claims" placeholder="Claim, member, purchase…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <select className="compact-select" aria-label="Sort claims" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount-high">Amount: high to low</option><option value="amount-low">Amount: low to high</option></select>
    </div>
    <div className="treasury-filters">
      {!activityId&&<Field id="claim-activity" label="Activity"><select id="claim-activity" value={activity} onChange={e=>{setActivity(e.target.value);setDepartment('');}}><option value="">All activities</option>{activities.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
      <Field id="claim-department" label="Department"><select id="claim-department" value={department} onChange={e=>setDepartment(e.target.value)}><option value="">All departments</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name} · {d.activityName}</option>)}</select></Field>
      <Field id="claim-member" label="Member"><select id="claim-member" value={member} onChange={e=>setMember(e.target.value)}><option value="">All members</option>{data.directory?.users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
      <Field id="claim-from" label="Submitted from"><DateField id="claim-from" value={from} onChange={setFrom}/></Field>
      <Field id="claim-until" label="Submitted until"><DateField id="claim-until" min={from} value={until} onChange={setUntil}/></Field>
      <button className="btn" onClick={clear}>Clear filters</button>
    </div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <p className="treasury-result" role="status">{records.length} matching {reimbursements?'unpaid approved claims':'claims'}{from&&until&&from>until?' · Choose an end date after the start date.':''}</p>
    {records.length?<div className="table-scroll" tabIndex={0} role="region" aria-label="Claim records"><table><thead><tr>{['CLAIM / PURCHASE','ACTIVITY / DEPARTMENT','MEMBER','SUBMITTED','ITEM BUDGET','CLAIM AMOUNT','VARIANCE','REVIEW','PAYMENT','ACTION'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
      {records.map(e=>{const c=claimContext(data,e);return <tr key={e.id}>
        <td><Link className="activity-name" to={`/treasurer/claims/${e.id}`}>{e.description}</Link><small className="cell-sub treasury-id">{e.id}</small><small className="cell-sub">{c.task?.purchasing?.name??'Legacy purchase'}</small></td>
        <td><Link to={`/treasurer/activities/${e.activityId}`}>{c.activity.name}</Link><small className="cell-sub">{c.department.name}</small></td>
        <td>{data.directory?.users.find(u=>u.id===e.review?.claimantId)?.name??'Legacy claimant unavailable'}</td><td>{date(e.date)}</td>
        <td className="money">{c.task?money(c.task.budget):'Unlinked'}</td><td className="money">{money(e.amount)}</td><td className={`money ${c.variance>0?'danger-text':'good-text'}`}>{money(c.variance)}<small className="cell-sub">{c.variancePercent.toFixed(2)}%</small></td>
        <td><Status value={e.state}/></td><td>{paymentState(data,e)}</td><td>{reimbursements?<Link className="btn primary" to={`/treasurer/claims/${e.id}/reimburse`}>Process reimbursement</Link>:e.state==='Pending review'?<button className="btn" disabled={busy} onClick={()=>void review(e.id,e.review!.updatedAt)}>Review {e.id}</button>:<Link className="text-link" to={`/treasurer/claims/${e.id}`}>View record</Link>}</td>
      </tr>;})}
    </tbody></table></div>:<Empty title="No matching claims" action={<button className="btn" onClick={clear}>Clear filters</button>}>Try another filter. Submitted claims appear here within your authorized activities.</Empty>}
  </>;
}
