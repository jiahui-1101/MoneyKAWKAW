import { useEffect, useState } from 'react';
import type { ReceiptEvidence } from '../../domain/treasury';
import { lineValue, receiptLines, receiptTotal, reviewedTotal } from '../../domain/receipt';
import { treasuryService } from '../../services/treasury';
import { Badge, Empty, Panel, useFormat } from '../ui';
export function ReceiptReview({ claimId, amount, load=treasuryService.receipt }: { claimId: string; amount: number; load?:(id:string)=>Promise<ReceiptEvidence> }) {
  const [receipt, setReceipt] = useState<ReceiptEvidence | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setReceipt(null);
    setError('');
    load(claimId)
      .then((r) => {
        if (active) setReceipt(r);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load evidence.');
      });
    return () => {
      active = false;
    };
  }, [claimId, attempt, load]);
  if (error)
    return (
      <Panel title="Receipt evidence">
        <Empty
          title="Evidence unavailable"
          action={
            <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
              Retry evidence
            </button>
          }
        >
          {error}
        </Empty>
      </Panel>
    );
  if (!receipt)
    return (
      <div
        className="skeleton"
        style={{ height: 300 }}
        role="status"
        aria-label="Loading claim evidence"
      />
    );
  return <ReceiptEvidenceView receipt={receipt} amount={amount}/>;
}
export function ReceiptEvidenceView({receipt,amount}:{receipt:ReceiptEvidence;amount:number}) {
  const {money,time}=useFormat();
  const lines = receiptLines(receipt),total=receiptTotal(receipt);
  return (
    <>
      <div className="treasury-two-col">
        <Panel
          title="Original receipt"
          subtitle={receipt.extraction?'Exact uploaded image · original source is preserved':'Immutable fictional sample · no live OCR was run on this legacy fixture'}
          action={
            <a className="text-link" href={receipt.originalUrl} download={receipt.file?.name??`${receipt.id}.svg`}>
              Download original
            </a>
          }
        >
          <div className="treasury-receipt">
            <img src={receipt.originalUrl} alt={`Unmodified receipt for ${receipt.expenseId||receipt.id}`} />
            <p>
              {receipt.merchant} · {receipt.expenseId?'submitted':'uploaded'} {time(receipt.submittedAt)}
            </p>
          </div>
        </Panel>
        <Panel
          title="Annotated claim view"
          subtitle="Line annotations show corrections and exclusions; the source image is preserved"
        >
          <div className="treasury-annotation">
            <span className="eyebrow">FINAL CLAIM · {receipt.id}</span>
            <h3>{receipt.merchant}</h3>
            {lines.map((l) => (
              <div
                key={l.original.id}
                className={`receipt-line ${l.excluded ? 'excluded' : l.edited ? 'corrected' : ''}`}
              >
                <div>
                  <strong>{l.final.description}</strong>
                  <small>
                    {l.excluded
                      ? 'Excluded from claim'
                      : l.edited
                        ? 'Corrected source value'
                        : 'Included unchanged'}
                  </small>
                </div>
                <div className="receipt-values">
                  {l.edited && l.original.amount !== l.final.amount && (
                    <del>{money(lineValue(l.original))}</del>
                  )}
                  <strong>{money(lineValue(l.final))}</strong>
                </div>
              </div>
            ))}
            <div className="receipt-total">
              <span>Final claimed amount</span>
              <strong>{money(total)}</strong>
            </div>
            <Badge tone={total === amount ? 'green' : 'danger'}>
              {total === amount
                ? 'Reconciles to submitted amount'
                : 'Amount mismatch · approval blocked'}
            </Badge>
            <p className="field-hint">
              This view reconstructs the retained line history. No pixel locations or OCR confidence
              values are invented.
            </p>
          </div>
        </Panel>
      </div>
      <Panel
        title="Source items & final values"
        subtitle={receipt.extraction?.method==='manual'?'Manually entered source values, retained alongside corrections':'Original OCR suggestions are retained alongside the claimant’s changes'}
      >
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Receipt original and final line values"
        >
          <table>
            <thead>
              <tr>
                <th>ORIGINAL EXTRACTION</th>
                <th>ORIGINAL AMOUNT</th>
                <th>FINAL DESCRIPTION</th>
                <th>FINAL AMOUNT</th>
                <th>TREATMENT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.original.id}>
                  <td>{l.original.description}</td>
                  <td className="money">{money(lineValue(l.original))}</td>
                  <td>{l.final.description}{l.final.quantityMilli!==undefined&&<small className="cell-sub">Qty {l.final.quantityMilli/1000} × {money(l.final.unitPrice!)}</small>}</td>
                  <td className="money">{money(lineValue(l.final))}</td>
                  <td>
                    <Badge tone={l.excluded ? 'danger' : l.edited ? 'gold' : 'green'}>
                      {l.excluded ? 'Excluded' : l.edited ? 'Corrected' : 'Included'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Receipt modification report"
        subtitle="Append-only evidence history · who changed what, when, and why"
      >
        <div className="treasury-evidence-history">
          {receipt.edits.map((edit, i) => (
            <article key={`${edit.lineId}-${i}`}>
              <div className="row between wrap">
                  <h3>{edit.excluded ? 'Item excluded' : edit.beforeExcluded?'Item included again':'Source value corrected'}</h3>
                <small>
                  {time(edit.at)} · {edit.actor}
                </small>
              </div>
              <p>
                Before: {edit.before.description} · {money(lineValue(edit.before))}{edit.before.quantityMilli!==undefined?` · Qty ${edit.before.quantityMilli/1000} × ${money(edit.before.unitPrice!)}`:''}
              </p>
              <p>
                After: {edit.after.description} · {money(lineValue(edit.after))}{edit.after.quantityMilli!==undefined?` · Qty ${edit.after.quantityMilli/1000} × ${money(edit.after.unitPrice!)}`:''}
                {edit.excluded ? ' · excluded from total' : ''}
              </p>
              <p className="muted">{edit.reason}</p>
            </article>
          ))}
          {!receipt.edits.length && (
            <p className="muted">No corrections or exclusions were submitted.</p>
          )}
          {receipt.totalEdits?.map((e,i)=><article key={`total-${i}`}><h3>Receipt total corrected</h3><p>{money(e.before)} → {money(e.after)} · {e.reason}</p><small>{e.actor} · {time(e.at)}</small></article>)}
        </div>
      </Panel>
      {receipt.extraction&&<Panel title="Retained extraction & receipt totals" subtitle={receipt.extraction.method==='tesseract'?'Tesseract on-device OCR · suggestions require human review':'Manual entry · no OCR accuracy is claimed'}><div className="treasury-evidence-history"><div className="row between wrap"><span>Original total: {money(receipt.originalTotal!)}</span><span>Reviewed total: {money(reviewedTotal(receipt))}</span><strong>Claimable: {money(total)}</strong></div><p className="field-hint">Purchase date: {receipt.purchaseDate}. Shared tax and discount allocations are explicit line corrections; no hidden proration is applied.</p><details><summary>View retained source text</summary><pre className="receipt-raw">{receipt.extraction.rawText||'Manually transcribed from the uploaded image; no machine extraction was performed.'}</pre></details></div></Panel>}
    </>
  );
}
