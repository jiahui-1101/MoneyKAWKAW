import { useEffect, useState } from 'react';
import type { ReceiptEvidence } from '../../domain/treasury';
import { receiptLines } from '../../domain/risk';
import { treasuryService } from '../../services/treasury';
import { Badge, Empty, Panel, useFormat } from '../ui';
export function ReceiptReview({claimId,amount}:{claimId:string;amount:number}) {
  const {money,time}=useFormat();
  const [receipt,setReceipt]=useState<ReceiptEvidence|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;setReceipt(null);setError('');
    treasuryService.receipt(claimId).then(r=>{if(active)setReceipt(r);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load evidence.');});
    return()=>{active=false;};
  },[claimId,attempt]);
  if(error)return <Panel title="Receipt evidence"><Empty title="Evidence unavailable" action={<button className="btn" onClick={()=>setAttempt(n=>n+1)}>Retry evidence</button>}>{error}</Empty></Panel>;
  if(!receipt)return <div className="skeleton" style={{height:300}} role="status" aria-label="Loading claim evidence"/>;
  const lines=receiptLines(receipt);const total=lines.filter(l=>!l.excluded).reduce((s,l)=>s+l.final.amount,0);
  return <>
    <div className="treasury-two-col">
      <Panel title="Original receipt" subtitle="Immutable source · sample evidence, not a live OCR result" action={<a className="text-link" href={receipt.originalUrl} download={`${receipt.id}.svg`}>Download original</a>}>
        <div className="treasury-receipt"><img src={receipt.originalUrl} alt={`Unmodified fictional receipt for ${claimId}`}/><p>{receipt.merchant} · submitted {time(receipt.submittedAt)}</p></div>
      </Panel>
      <Panel title="Annotated claim view" subtitle="Line annotations show corrections and exclusions; the source image is preserved">
        <div className="treasury-annotation"><span className="eyebrow">FINAL CLAIM · {receipt.id}</span><h3>{receipt.merchant}</h3>
          {lines.map(l=><div key={l.original.id} className={`receipt-line ${l.excluded?'excluded':l.edited?'corrected':''}`}>
            <div><strong>{l.final.description}</strong><small>{l.excluded?'Excluded from claim':l.edited?'Corrected OCR value':'Included unchanged'}</small></div>
            <div className="receipt-values">{l.edited&&l.original.amount!==l.final.amount&&<del>{money(l.original.amount)}</del>}<strong>{money(l.final.amount)}</strong></div>
          </div>)}
          <div className="receipt-total"><span>Final claimed amount</span><strong>{money(total)}</strong></div>
          <Badge tone={total===amount?'green':'danger'}>{total===amount?'Reconciles to submitted amount':'Amount mismatch · approval blocked'}</Badge>
          <p className="field-hint">This view reconstructs the retained line history. No pixel locations or OCR confidence values are invented.</p>
        </div>
      </Panel>
    </div>
    <Panel title="Extracted items & final values" subtitle="Original OCR suggestions are retained alongside the claimant’s changes">
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Receipt original and final line values"><table><thead><tr><th>ORIGINAL EXTRACTION</th><th>ORIGINAL AMOUNT</th><th>FINAL DESCRIPTION</th><th>FINAL AMOUNT</th><th>TREATMENT</th></tr></thead><tbody>{lines.map(l=><tr key={l.original.id}><td>{l.original.description}</td><td className="money">{money(l.original.amount)}</td><td>{l.final.description}</td><td className="money">{money(l.final.amount)}</td><td><Badge tone={l.excluded?'danger':l.edited?'gold':'green'}>{l.excluded?'Excluded':l.edited?'Corrected':'Included'}</Badge></td></tr>)}</tbody></table></div>
    </Panel>
    <Panel title="Receipt modification report" subtitle="Append-only evidence history · who changed what, when, and why">
      <div className="treasury-evidence-history">{receipt.edits.map((edit,i)=><article key={`${edit.lineId}-${i}`}><div className="row between wrap"><h3>{edit.excluded?'Item excluded':'OCR value corrected'}</h3><small>{time(edit.at)} · {edit.actor}</small></div><p>Before: {edit.before.description} · {money(edit.before.amount)}</p><p>After: {edit.after.description} · {money(edit.after.amount)}{edit.excluded?' · excluded from total':''}</p><p className="muted">{edit.reason}</p></article>)}{!receipt.edits.length&&<p className="muted">No corrections or exclusions were submitted.</p>}</div>
    </Panel>
  </>;
}
