import { useEffect, useRef, useState } from 'react';
import type { ClaimDraft } from '../../domain/member';
import type { ProofFile } from '../../domain/treasury';
import { draftService } from '../../services/member-drafts';
import { readReceiptImage, recognizeReceipt, type OcrSuggestion } from '../../services/receipt-ocr';
import { Field } from '../Field';
import { Badge, Modal, Panel, Progress } from '../ui';
import { ReceiptBaselineForm } from './ReceiptBaselineForm';
import type { DraftChange } from './useMemberDraft';
export function ReceiptUpload({draft,saving,change,onCaptured}:{draft:ClaimDraft;saving:boolean;change:DraftChange;onCaptured:()=>void}) {
  const [error,setError]=useState(''),[reading,setReading]=useState(false),[progress,setProgress]=useState(0),[stage,setStage]=useState('Preparing on-device reader');
  const [suggestion,setSuggestion]=useState<OcrSuggestion|null>(null),[method,setMethod]=useState<'tesseract'|'manual'>('manual'),[pending,setPending]=useState<ProofFile|null|undefined>();
  const [loadingFile,setLoadingFile]=useState(false);const controller=useRef<AbortController|null>(null);
  useEffect(()=>{controller.current?.abort();setReading(false);setSuggestion(null);return()=>controller.current?.abort();},[draft.receipt?.id]);
  const apply=async(file:ProofFile|null)=>{setError('');try{await change(()=>draftService.receipt(draft.id,draft.updatedAt,file),file?'Original receipt image saved unchanged.':'Unsubmitted receipt removed.');setPending(undefined);setSuggestion(null);}catch(e){setError(e instanceof Error?e.message:'Unable to save receipt.');}};
  const select=async(file?:File)=>{if(!file)return;setError('');setLoadingFile(true);try{const proof=await readReceiptImage(file);if(draft.receipt)setPending(proof);else await apply(proof);}catch(e){setError(e instanceof Error?e.message:'Unable to read this receipt image.');}finally{setLoadingFile(false);}};
  const recognize=async()=>{
    if(!draft.receipt?.file)return;setError('');setReading(true);setProgress(0);const current=new AbortController();controller.current=current;
    try{
      const result=await recognizeReceipt({...draft.receipt.file,dataUrl:draft.receipt.originalUrl},(status,value)=>{if(!current.signal.aborted){setStage(status==='recognizing text'?'Reading receipt text':'Preparing on-device reader');setProgress(value*100);}},current.signal);
      setMethod(result.lines.length?'tesseract':'manual');setSuggestion(result);
      if(!result.lines.length)setError('Text was recognized, but no confident amount lines were found. Enter source items manually and compare them with the image.');
    }catch(e){setError(e instanceof Error?e.message:'OCR was unavailable. Continue with manual entry.');}finally{setReading(false);}
  };
  const manual=()=>{controller.current?.abort();setMethod('manual');setSuggestion({rawText:suggestion?.rawText??'',merchant:'',purchaseDate:'',lines:[]});};
  return <div className="stack"><Panel title="Keep the original. Make the claim clear." subtitle="PNG or JPEG · up to 1 MB / 20 megapixels · no silent image resizing">
    <div className="member-content stack"><div className="form-grid"><Field id="receipt-upload" label="Upload receipt image"><input id="receipt-upload" type="file" accept="image/png,image/jpeg" disabled={saving||reading||loadingFile} onChange={e=>void select(e.target.files?.[0])}/></Field><Field id="receipt-camera" label="Take or choose a camera photo"><input id="receipt-camera" type="file" accept="image/png,image/jpeg" capture="environment" disabled={saving||reading||loadingFile} onChange={e=>void select(e.target.files?.[0])}/></Field></div>
      {loadingFile&&<p role="status">Validating and preserving your image…</p>}
      {draft.receipt?<><div className="member-source-image"><img src={draft.receipt.originalUrl} alt="Original uploaded receipt preview"/><small>{draft.receipt.file?.name} · {((draft.receipt.file?.size??0)/1024).toFixed(1)} KB · original preserved</small></div><div className="row wrap"><Badge tone="green">Original retained unchanged</Badge><button className="btn danger" disabled={saving||reading} onClick={()=>setPending(null)}>Remove unsubmitted receipt</button></div>
        {draft.receipt.extraction?<div className="member-scope-banner"><h2>Source values already captured.</h2><p>The original extraction cannot be overwritten. Continue to item corrections, or explicitly replace this unsubmitted receipt to start from a different source.</p><button className="btn" onClick={onCaptured}>Continue to item editing</button></div>:<>
          <p className="settings-copy">Read English receipt text on this device. The worker and model are served by this application; your image is not sent to an OCR service. OCR can miss or misread values—compare every suggestion against the original.</p>
          <div className="row wrap"><button className="btn primary" disabled={reading||saving} onClick={()=>void recognize()}>Read receipt on device</button><button className="btn" disabled={saving||reading} onClick={manual}>Enter receipt manually</button></div>
          {reading&&<div className="stack" role="status"><span>{stage} · {progress.toFixed(0)}%</span><Progress value={progress} label="Receipt text reading progress"/><button className="btn" onClick={()=>controller.current?.abort()}>Cancel reading</button></div>}
        </>}
      </>:<p className="field-hint">Upload your actual purchase receipt to begin. No example items or totals are injected into uploaded images.</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
    </div>
  </Panel>
    {suggestion&&!reading&&!draft.receipt?.extraction&&<ReceiptBaselineForm key={`${draft.receipt?.id}-${method}`} draft={draft} suggestion={suggestion} method={method} saving={saving} change={change} onSaved={onCaptured}/>}
    {pending!==undefined&&<Modal title={pending?'Replace this unsubmitted receipt?':'Remove this unsubmitted receipt?'} onClose={()=>{if(!saving)setPending(undefined);}}><div className="stack"><p>The current unsubmitted extraction and corrections will be cleared. Submitted claim evidence is never affected by this action.</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="btn" disabled={saving} onClick={()=>setPending(undefined)}>Keep current source</button><button className="btn danger" disabled={saving} onClick={()=>void apply(pending)}>{saving?'Saving…':pending?'Confirm replacement':'Confirm removal'}</button></div></div></Modal>}
  </div>;
}
