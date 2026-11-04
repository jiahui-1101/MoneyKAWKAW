import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Assignment } from '../../domain/models';
import type { ClaimDraft } from '../../domain/member';
import { useMember } from '../../context/member-context';
import { draftService } from '../../services/member-drafts';
import { memberClaimService } from '../../services/member-claims';
import { Field } from '../Field';
import { Badge, Empty, Modal, Panel, useFormat } from '../ui';
import type { DraftChange } from './useMemberDraft';
type Summary=Awaited<ReturnType<typeof memberClaimService.context>>;
export function ClaimSubmitForm({draft,task,saving,change}:{draft:ClaimDraft;task:Assignment;saving:boolean;change:DraftChange}) {
  const {data,run,busy}=useMember(),{money}=useFormat(),navigate=useNavigate();const [account,setAccount]=useState(draft.accountId),[reason,setReason]=useState(draft.justification),[summary,setSummary]=useState<Summary|null>(null),[confirm,setConfirm]=useState<Summary|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;setLoading(true);memberClaimService.context(draft.id).then(s=>{if(active){setSummary(s);setError('');}}).catch(e=>{if(active){setSummary(null);setError(e instanceof Error?e.message:'Unable to reconcile this draft.');}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[draft.id,draft.updatedAt]);
  if(!data)return null;
  const review=async(e:FormEvent)=>{
    e.preventDefault();setError('');try{
      await change(()=>draftService.preferences(draft.id,draft.updatedAt,account,reason),'Draft payment selection and explanation saved.');
      const current=await memberClaimService.context(draft.id);
      if(current.needsJustification&&reason.trim().length<3)throw new Error('Explain this over-budget request before reviewing submission.');
      setConfirm(current);
    }catch(e){setError(e instanceof Error?e.message:'Unable to prepare submission.');}
  };
  const submit=async()=>{
    if(!confirm)return;setError('');try{const claimId=await run(()=>memberClaimService.submit(draft.id,confirm.draftUpdatedAt,confirm.taskUpdatedAt,confirm.accountUpdatedAt),'Claim submitted for Treasurer review. No approval or payment has occurred.');navigate(`/member/claims/${claimId}`);}catch(e){setError(e instanceof Error?e.message:'Unable to submit claim.');setConfirm(null);}
  };
  return <Panel title="A clear request, ready for review" subtitle="The claim amount is derived from your retained receipt items, never entered separately">
    <form className="member-content stack" onSubmit={review} noValidate>
      {loading?<p role="status">Reconciling receipt and checking current budget context…</p>:summary&&<><dl className="member-submit-facts"><div><dt>Allocated item budget</dt><dd>{money(task.budget)}</dd></div><div><dt>Claimable amount</dt><dd>{money(summary.amount)}</dd></div><div><dt>Item variance</dt><dd className={summary.variance>0?'danger-text':''}>{money(summary.variance)} · {summary.variancePercent.toFixed(2)}%</dd></div></dl>{summary.needsJustification&&<div className="member-scope-banner"><Badge tone="gold">Over-budget explanation required</Badge><p>{summary.variance>0?'The claim exceeds its allocated item budget. ':''}{summary.departmentExceeded?'Department funds would be exceeded. ':''}{summary.activityExceeded?'Activity funds would be exceeded. ':''}You may submit with a reason; the Treasurer makes the decision.</p></div>}</>}
      <Field id="claim-justification" label={summary?.needsJustification?'Over-budget justification':'Purchase context / justification'} required={summary?.needsJustification}><textarea id="claim-justification" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain any higher cost and its purpose for the activity."/></Field>
      {data.accounts.length?<Field id="claim-account" label="Selected payment account" required><select id="claim-account" value={account} onChange={e=>setAccount(e.target.value)}><option value="">Choose one of my saved accounts</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.label} · {a.masked}{a.isDefault?' · default':''}</option>)}</select></Field>:<Empty title="Add a payment destination first" action={<Link className="btn primary" to="/member/accounts">Manage my accounts</Link>}>Your receipt draft is saved. Return after adding fictional payment instructions for this local demo.</Empty>}
      <p className="field-hint">Submission saves a destination snapshot. Later default/account edits do not redirect the claim. An unpaid destination change requires a separate reason and audit record.</p>
      {error&&<p className="form-error" role="alert">{error}</p>}<button className="btn primary" disabled={saving||busy||loading||!summary||!data.accounts.length}>Review submission</button>
    </form>
    {confirm&&<Modal title="Submit this claim for review?" onClose={()=>{if(!busy)setConfirm(null);}}><div className="stack"><h3>{task.purchasing!.name}</h3><p>Item budget: {money(task.budget)} · Requested: <strong>{money(confirm.amount)}</strong></p><p className="settings-copy">Destination: {confirm.destination?.label} · {confirm.destination?.masked}<br/>{confirm.destination?.holder} · {confirm.destination?.institution}</p><p className="settings-copy">The original receipt, extraction, annotated line changes, explanation, and chosen destination snapshot will be retained. Submitted amounts and source evidence cannot be silently edited. The Treasurer will review; approval and payment are separate.</p>{reason&&<p className="member-quote">{reason}</p>}<div className="form-actions"><button className="btn" disabled={busy} onClick={()=>setConfirm(null)}>Keep reviewing</button><button className="btn primary" disabled={busy} onClick={()=>void submit()}>{busy?'Submitting…':'Confirm claim submission'}</button></div></div></Modal>}
  </Panel>;
}
