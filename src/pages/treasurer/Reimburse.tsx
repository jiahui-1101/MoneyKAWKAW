import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import type { PayoutSnapshot, ProofFile } from '../../domain/treasury';
import { departmentToday } from '../../domain/hod';
import { reimbursementService } from '../../services/reimbursements';
import { readProof } from '../../services/payment-proof';
import { Field } from '../../components/Field';
import { DateField } from '../../components/DateField';
import { Badge, Empty, Modal, PageHeader, Panel, useFormat } from '../../components/ui';
import { ProofPreview } from '../../components/treasurer/ProofPreview';

export function TreasuryReimburse() {
  const {id}=useParams();const {data,busy,run}=useTreasury();const {money,currency}=useFormat();const navigate=useNavigate();
  const claim=data?.expenses.find(e=>e.id===id);const paid=data?.payments.some(p=>p.expenseId===id);
  const [payout,setPayout]=useState<PayoutSnapshot|null>(null),[payoutError,setPayoutError]=useState(''),[attempt,setAttempt]=useState(0);
  const [reveal,setReveal]=useState(false),[date,setDate]=useState(()=>departmentToday(data!.settings.timezone)),[reference,setReference]=useState('');
  const [proof,setProof]=useState<ProofFile|null>(null),[reading,setReading]=useState(false),[confirmed,setConfirmed]=useState(false),[confirm,setConfirm]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;setPayout(null);setPayoutError('');
    if(id&&claim?.state==='Approved'&&!paid)reimbursementService.destination(id).then(p=>{if(active)setPayout(p);}).catch(e=>{if(active)setPayoutError(e instanceof Error?e.message:'Unable to load selected destination.');});
    return()=>{active=false;};
  },[id,claim?.state,paid,attempt]);
  if(!data||!claim)return <Empty title="Claim access restricted">This claim is unavailable within your authorized activities.</Empty>;
  if(claim.state!=='Approved'||paid)return <Empty title={paid?'A payment is already recorded':'Approval is required first'} action={<Link className="btn primary" to={paid?`/treasurer/history?claim=${id}`:`/treasurer/claims/${id}`}>{paid?'View immutable payment record':'Return to review'}</Link>}>Only an approved, unpaid claim can enter this step. Duplicate reimbursements are blocked.</Empty>;
  const submit=(e:FormEvent)=>{
    e.preventDefault();setError('');
    if(!date||!reference.trim()||!proof||!confirmed||!payout){setError('Add a valid date, reference, payment proof, and external-transfer confirmation.');return;}
    setConfirm(true);
  };
  const save=async()=>{
    setError('');try{await run(()=>reimbursementService.record(claim.id,{amount:claim.amount,date,reference,proof:proof!,confirmed}),'Manual payment record saved. External transfer remains unverified.');setConfirm(false);navigate(`/treasurer/history?claim=${id}`);}
    catch(e){setError(e instanceof Error?e.message:'Unable to record reimbursement.');setConfirm(false);}
  };
  return <div className="stack"><Link className="back-link" to={`/treasurer/claims/${id}`}>← Claim detail / Reimbursement</Link>
    <PageHeader eyebrow="MANUAL REIMBURSEMENT" title="Record the transfer, keep the evidence." description={`${claim.description} · ${money(claim.amount)} approved`}/>
    <div className="treasury-justification"><Badge tone="gold">External transfer · locally recorded</Badge><p>This application does not transfer money or verify bank transactions. All current payout snapshots are explicitly fictional and not payable. Use sample proof to demonstrate recording.</p></div>
    <div className="form-layout"><form className="panel activity-form" onSubmit={submit} noValidate>
      <div className="form-section"><h2>Selected payout snapshot</h2><p className="field-hint">Read-only instructions selected for this claim. Saved member accounts cannot be changed here.</p>
        {payoutError?<Empty title="Destination unavailable" action={<button type="button" className="btn" onClick={()=>setAttempt(n=>n+1)}>Retry destination</button>}>{payoutError}</Empty>:!payout?<p role="status">Loading approved payout instructions…</p>:<>
          <dl className="treasury-payout">{[['Claimant',payout.holder],['Selected method',payout.kind==='Bank'?'Bank account':'TNG eWallet'],['Destination label',payout.label],['Institution',payout.institution],['Identifier',reveal?payout.identifier:payout.masked]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <button className="btn" type="button" aria-pressed={reveal} onClick={()=>setReveal(v=>!v)}>{reveal?'Mask destination identifier':'Show selected identifier'}</button>
        </>}
      </div>
      <div className="form-section"><h2>External transfer record</h2>
        <Field id="paid-amount" label={`Amount paid (${currency})`}><input id="paid-amount" readOnly value={(claim.amount/100).toFixed(2)}/></Field>
        <Field id="payment-date" label="Payment date" required><DateField id="payment-date" calendarLabel="Choose payment date" min={claim.date} max={departmentToday(data.settings.timezone)} value={date} onChange={setDate}/></Field>
        <Field id="payment-reference" label="Transaction reference" required><input id="payment-reference" maxLength={120} value={reference} onChange={e=>setReference(e.target.value)} placeholder="External transfer reference or DEMO-…"/></Field>
        <Field id="payment-proof" label="Payment proof" required><input id="payment-proof" type="file" accept="image/png,image/jpeg,application/pdf" disabled={reading||busy} onChange={async e=>{setProof(null);setError('');const file=e.target.files?.[0];if(!file)return;setReading(true);try{setProof(await readProof(file));}catch(e){setError(e instanceof Error?e.message:'Unable to read proof.');}finally{setReading(false);}}}/></Field>
        <p className="field-hint">PNG, JPEG, or PDF · up to 1 MB · the uploaded file is preserved.</p>
        {reading&&<p role="status">Reading and validating proof…</p>}{proof&&<ProofPreview proof={proof}/>}
        <label className="treasury-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I confirm the transfer was made externally, or I am recording a fictional transfer for this local demo.</span></label>
        {error&&<p className="form-error" role="alert">{error}</p>}
      </div><div className="form-actions"><Link className="btn" to={`/treasurer/claims/${id}`}>Back to claim</Link><button className="btn primary" disabled={busy||reading||!payout}>{busy?'Recording…':'Record manual reimbursement'}</button></div>
    </form><aside className="form-aside"><h2>A record with a clear trail.</h2><p>Approval and payment are separate events. This demo records one full reimbursement per claim.</p><p>Payment proof, date, amount, reference, and responsible Treasurer are retained. The member’s receipt confirmation remains pending.</p></aside></div>
    {confirm&&<Modal title="Record this manual reimbursement?" onClose={()=>{if(!busy)setConfirm(false);}}><div className="stack"><p>{money(claim.amount)} · {reference} · {date}</p><p className="settings-copy">This creates an immutable local payment record and preserves the uploaded proof. External transfer verification and member receipt confirmation remain pending.</p><div className="form-actions"><button className="btn" disabled={busy} onClick={()=>setConfirm(false)}>Keep editing</button><button className="btn primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Confirm payment record'}</button></div></div></Modal>}
  </div>;
}
