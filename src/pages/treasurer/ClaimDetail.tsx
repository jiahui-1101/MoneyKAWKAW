import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import { claimContext, paymentState } from '../../domain/risk';
import { summarize } from '../../domain/budget';
import { demoProfiles } from '../../domain/session';
import { treasuryService } from '../../services/treasury';
import { ReceiptReview } from '../../components/treasurer/ReceiptReview';
import { ClaimDecision } from '../../components/treasurer/ClaimDecision';
import { Badge, Empty, PageHeader, Panel, Status, TextLink, useFormat } from '../../components/ui';
export function TreasuryClaimDetail() {
  const {id}=useParams();const {data,busy,run}=useTreasury();const {money,time}=useFormat();
  const [error,setError]=useState(''),[decision,setDecision]=useState<'Approved'|'Declined'|null>(null);
  const claim=data?.expenses.find(e=>e.id===id);
  if(!data||!claim)return <Empty title="Claim access restricted" action={<Link className="btn" to="/treasurer/claims">Back to claims</Link>}>The claim is unavailable within your authorized activities.</Empty>;
  const c=claimContext(data,claim);const dep=summarize(data,claim.activityId,claim.departmentId);
  const paid=data.payments.some(p=>p.expenseId===claim.id);
  const events=data.events.filter(e=>(c.task&&e.assignmentId===c.task.id)||e.detail.includes(claim.id));
  const review=async()=>{setError('');try{await run(()=>treasuryService.review(claim.id,claim.review!.updatedAt),'Claim is now in review.');}catch(e){setError(e instanceof Error?e.message:'Unable to start review.');}};
  return <div className="stack">
    <Link className="back-link" to="/treasurer/claims">← Claim management / Claim detail</Link>
    <PageHeader eyebrow={`CLAIM RECORD · ${claim.id}`} title={claim.description} description={`${c.activity.name} / ${c.department.name}`}>
      <Link className="btn" to={`/treasurer/claims/${id}/risk`}>Budget & risk analysis</Link>
      {claim.state==='Pending review'&&<button className="btn primary" disabled={busy} onClick={()=>void review()}>Start review</button>}
      {claim.state==='In review'&&<><button className="btn danger" disabled={busy} onClick={()=>setDecision('Declined')}>Decline claim</button><button className="btn primary" disabled={busy} onClick={()=>setDecision('Approved')}>Approve claim</button></>}
      {claim.state==='Approved'&&(paid?<TextLink to={`/treasurer/history?claim=${id}`}>View payment record</TextLink>:<Link className="btn primary" to={`/treasurer/claims/${id}/reimburse`}>Process reimbursement</Link>)}
    </PageHeader>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="treasury-record-bar"><Status value={claim.state}/><Badge tone={paid?'green':'neutral'}>{paymentState(data,claim)}</Badge><span>Submitted {time(claim.review?.submittedAt??claim.date)}</span></div>
    <Panel title="The submitted financial record" subtitle="Claim amounts and task budgets cannot be edited during review">
      <dl className="treasury-facts">
        {[
          ['Submitted by',data.directory?.users.find(u=>u.id===claim.review?.claimantId)?.name??'Legacy claimant unavailable'],
          ['Purchasing task',c.task?.purchasing?.name??'No linked task'],['Item budget',c.task?money(c.task.budget):'Unavailable'],
          ['Final claimed amount',money(claim.amount)],['Item variance',`${money(c.variance)} (${c.variancePercent.toFixed(2)}%)`],['Department available',money(dep.available)],
          ['Reviewer',demoProfiles.find(p=>p.userId===claim.review?.reviewer)?.name??'Not yet assigned'],['Decision time',claim.review?.reviewedAt?time(claim.review.reviewedAt):'Awaiting decision'],
        ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </Panel>
    <div className="treasury-justification"><span className="eyebrow">MEMBER’S SUBMITTED CONTEXT</span><h2>{c.variance>0?'Over-budget justification':'Purchase justification'}</h2><p>{claim.review?.justification||'No justification was retained in this legacy sample.'}</p></div>
    {claim.review?.reason&&<div className={`treasury-decision ${claim.state==='Declined'?'is-declined':''}`}><h2>{claim.state} · decision reason</h2><p>{claim.review.reason}</p></div>}
    <ReceiptReview claimId={claim.id} amount={claim.amount}/>
    <Panel title="Claim history & audit trail" subtitle="Append-only shared events · decision and payment remain distinct">
      <div className="treasury-evidence-history"><article><h3>Claim submitted</h3><p>{time(claim.review?.submittedAt??claim.date)} · {money(claim.amount)} · original receipt and claimant changes retained.</p></article>
        {events.map(e=><article key={e.id}><div className="row between wrap"><h3>{e.action}</h3><small>{e.actor} · {time(e.at)}</small></div><p>{e.detail}</p></article>)}
      </div>
    </Panel>
    {decision&&<ClaimDecision claim={claim} decision={decision} onClose={()=>setDecision(null)}/>}
  </div>;
}
