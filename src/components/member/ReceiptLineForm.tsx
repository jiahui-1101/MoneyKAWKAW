import { useState, type FormEvent } from 'react';
import type { ClaimDraft } from '../../domain/member';
import type { ReceiptLine } from '../../domain/treasury';
import { parseMoney } from '../../domain/budget';
import { parseQuantity, quantityAmount } from '../../domain/receipt';
import { receiptEditService } from '../../services/member-receipt-edits';
import { Field } from '../Field';
import { Modal, useFormat } from '../ui';
import type { DraftChange } from './useMemberDraft';
export function ReceiptLineForm({draft,current,saving,change,onClose}:{draft:ClaimDraft;current?:{line:ReceiptLine;excluded:boolean};saving:boolean;change:DraftChange;onClose:()=>void}) {
  const {money,currency}=useFormat(),line=current?.line;
  const [description,setDescription]=useState(line?.description??''),[kind,setKind]=useState<NonNullable<ReceiptLine['kind']>>(line?.kind??'item'),[amount,setAmount]=useState(line?(line.amount/100).toFixed(2):'');
  const [quantityMode,setQuantityMode]=useState(line?.quantityMilli!==undefined),[quantity,setQuantity]=useState(String((line?.quantityMilli??1000)/1000)),[unit,setUnit]=useState(line?((line.unitPrice??line.amount)/100).toFixed(2):'');
  const [excluded,setExcluded]=useState(current?.excluded??false),[reason,setReason]=useState(''),[error,setError]=useState('');
  const calculated=()=>{try{return quantityAmount(parseMoney(unit),parseQuantity(quantity));}catch{return null;}};
  const total=quantityMode?calculated():null;
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setError('');try{
      const q=quantityMode?parseQuantity(quantity):undefined,price=quantityMode?parseMoney(unit):undefined;
      const after:ReceiptLine={id:line?.id??'',description,kind,amount:quantityMode?quantityAmount(price!,q!):parseMoney(amount),quantityMilli:q,unitPrice:price};
      await change(()=>line?receiptEditService.line(draft.id,draft.updatedAt,line.id,after,excluded,reason):receiptEditService.add(draft.id,draft.updatedAt,after,reason),'Receipt modification saved with before/after history.');onClose();
    }catch(e){setError(e instanceof Error?e.message:'Unable to save this receipt modification.');}
  };
  return <Modal title={line?'Correct or exclude this item':'Add a missing receipt line'} onClose={()=>{if(!saving)onClose();}}><form className="stack" onSubmit={submit} noValidate>
    <p className="settings-copy">The original image and extraction remain unchanged. Every saved correction or exclusion retains its prior value, reason, actor, and time.</p>
    <Field id="edit-line-description" label="Item description" required><input id="edit-line-description" maxLength={180} value={description} onChange={e=>setDescription(e.target.value)}/></Field>
    <Field id="edit-line-kind" label="Line type"><select id="edit-line-kind" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="item">Purchase item</option><option value="tax">Tax / other charge</option><option value="discount">Discount (subtracts)</option></select></Field>
    <label className="member-check"><input type="checkbox" checked={quantityMode} onChange={e=>setQuantityMode(e.target.checked)}/><span>Calculate from quantity × unit price</span></label>
    {quantityMode?<><div className="form-grid"><Field id="edit-line-quantity" label="Quantity" required><input id="edit-line-quantity" inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field><Field id="edit-line-unit" label={`Unit price (${currency})`} required><input id="edit-line-unit" inputMode="decimal" value={unit} onChange={e=>setUnit(e.target.value)}/></Field></div><p className="field-hint">Calculated amount: {total===null?'Complete valid quantity and unit price':money(total)} · rounded to nearest minor unit.</p></>:<Field id="edit-line-amount" label={`Line amount (${currency})`} required><input id="edit-line-amount" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></Field>}
    {line&&<label className="member-check"><input type="checkbox" checked={excluded} onChange={e=>setExcluded(e.target.checked)}/><span>Exclude this line from reimbursement</span></label>}
    <Field id="edit-line-reason" label="Reason for this modification" required><textarea id="edit-line-reason" maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Personal item, corrected quantity, or tax allocated to club items."/></Field>
    {error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="btn" type="button" disabled={saving} onClick={onClose}>Cancel</button><button className="btn primary" disabled={saving}>{saving?'Saving…':'Save modification'}</button></div>
  </form></Modal>;
}
export function ReceiptTotalForm({draft,current,saving,change,onClose}:{draft:ClaimDraft;current:number;saving:boolean;change:DraftChange;onClose:()=>void}) {
  const [amount,setAmount]=useState((current/100).toFixed(2)),[reason,setReason]=useState(''),[error,setError]=useState('');
  const submit=async(e:FormEvent)=>{e.preventDefault();setError('');try{await change(()=>receiptEditService.total(draft.id,draft.updatedAt,parseMoney(amount),reason),'Receipt total correction retained with history.');onClose();}catch(e){setError(e instanceof Error?e.message:'Unable to correct receipt total.');}};
  return <Modal title="Correct the reviewed receipt total" onClose={()=>{if(!saving)onClose();}}><form className="stack" onSubmit={submit} noValidate><p className="settings-copy">Use the actual printed total. The original captured total remains unchanged in the report.</p><Field id="reviewed-total" label="Reviewed receipt total" required><input id="reviewed-total" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></Field><Field id="total-reason" label="Reason for total correction" required><textarea id="total-reason" maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></Field>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button><button className="btn primary" disabled={saving}>Save total correction</button></div></form></Modal>;
}
