import { useState } from 'react';
import type { ClaimDraft } from '../../domain/member';
import { lineValue, receiptLines, receiptTotal, reviewedTotal } from '../../domain/receipt';
import { Badge, Panel, useFormat } from '../ui';
import { ReceiptLineForm, ReceiptTotalForm } from './ReceiptLineForm';
import type { DraftChange } from './useMemberDraft';
export function ReceiptItemEditor({draft,saving,change,onReview}:{draft:ClaimDraft;saving:boolean;change:DraftChange;onReview:()=>void}) {
  const {money}=useFormat();const [editing,setEditing]=useState<string|null|undefined>(),[totalOpen,setTotalOpen]=useState(false);
  const receipt=draft.receipt!,lines=receiptLines(receipt),total=receiptTotal(receipt),gross=receiptTotal(receipt,false),printed=reviewedTotal(receipt),current=lines.find(l=>l.original.id===editing);
  return <div className="stack"><div className="member-receipt-totals"><div><small>Original receipt total</small><strong>{money(receipt.originalTotal!)}</strong></div><div><small>Reviewed receipt total</small><strong>{money(printed)}</strong></div><div><small>Final claimable amount</small><strong className={total<=0?'danger-text':'good-text'}>{money(total)}</strong></div><div><small>Excluded lines</small><strong>{lines.filter(l=>l.excluded).length}</strong></div></div>
    {gross!==printed&&<p className="form-error" role="alert">All final receipt lines total {money(gross)}; the reviewed receipt total is {money(printed)}. Correct missing lines, values, or the reviewed total before submitting.</p>}
    <Panel title="Choose what belongs to the club" subtitle="Original values remain unchanged. Corrections, quantities, and exclusions are recorded with reasons." action={<button className="btn" disabled={saving||lines.length>=100} onClick={()=>setEditing(null)}>Add missing item</button>}>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Editable claimable receipt items"><table><thead><tr>{['ITEM','SOURCE VALUE','FINAL VALUE','TREATMENT','ACTION'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{lines.map((l,i)=><tr key={l.original.id}><td><strong>{l.final.description}</strong><small className="cell-sub">{l.final.kind??'item'}{l.final.quantityMilli!==undefined?` · Qty ${l.final.quantityMilli/1000} × ${money(l.final.unitPrice!)}`:''}</small></td><td className="money">{money(lineValue(l.original))}</td><td className="money">{money(lineValue(l.final))}</td><td><Badge tone={l.excluded?'danger':l.edited?'gold':'green'}>{l.excluded?'Excluded':l.edited?'Corrected · included':'Included'}</Badge></td><td><button className="btn" aria-label={`Edit receipt line ${i+1}`} disabled={saving} onClick={()=>setEditing(l.original.id)}>Edit / include / exclude</button></td></tr>)}</tbody></table></div>
      <div className="member-content stack"><p className="field-hint">Tax and other charges add to the total; discounts subtract. Split shared charges into explicit included/excluded lines with reasons. Every final line, including exclusions, must reconcile to the reviewed receipt total.</p><div className="row wrap"><button className="btn" disabled={saving} onClick={()=>setTotalOpen(true)}>Correct reviewed receipt total</button><button className="btn primary" onClick={onReview}>Compare original & annotated claim</button></div></div>
    </Panel>
    {editing!==undefined&&<ReceiptLineForm key={editing??'new'} draft={draft} current={current?{line:current.final,excluded:current.excluded}:undefined} saving={saving} change={change} onClose={()=>setEditing(undefined)}/>}
    {totalOpen&&<ReceiptTotalForm draft={draft} current={printed} saving={saving} change={change} onClose={()=>setTotalOpen(false)}/>}
  </div>;
}
