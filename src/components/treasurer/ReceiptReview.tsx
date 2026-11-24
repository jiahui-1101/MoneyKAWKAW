import { useEffect, useState } from 'react';
import type { ReceiptEvidence } from '../../domain/treasury';
import { lineValue, receiptLines, receiptTotal, reviewedTotal } from '../../domain/receipt';
import { treasuryService } from '../../services/treasury';
import { Badge, Empty, Panel, useFormat } from '../ui';
export function ReceiptReview({
  claimId,
  amount,
  load = treasuryService.receipt,
}: {
  claimId: string;
  amount: number;
  load?: (id: string) => Promise<ReceiptEvidence>;
}) {
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
        if (active) setError(e instanceof Error ? e.message : 'Couldn’t load the receipt.');
      });
    return () => {
      active = false;
    };
  }, [claimId, attempt, load]);
  if (error)
    return (
      <Panel title="Receipt evidence">
        <Empty
          title="Receipt didn’t load"
          action={
            <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
              Try again
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
        aria-label="Loading receipt"
      />
    );
  return <ReceiptEvidenceView receipt={receipt} amount={amount} />;
}
export function ReceiptEvidenceView({
  receipt,
  amount,
}: {
  receipt: ReceiptEvidence;
  amount: number;
}) {
  const { money, time } = useFormat();
  const lines = receiptLines(receipt),
    total = receiptTotal(receipt);
  return (
    <>
      <div className="treasury-two-col">
        <Panel
          title="Original receipt"
          subtitle={
            receipt.extraction
              ? 'Exactly as the member uploaded it'
              : 'Sample receipt for testing · not scanned'
          }
          action={
            <a
              className="text-link"
              href={receipt.originalUrl}
              download={receipt.file?.name ?? `${receipt.id}.svg`}
            >
              Download original
            </a>
          }
        >
          <div className="treasury-receipt">
            <img
              src={receipt.originalUrl}
              alt={`Unmodified receipt for ${receipt.expenseId || receipt.id}`}
            />
            <p>
              {receipt.merchant} · {receipt.expenseId ? 'submitted' : 'uploaded'}{' '}
              {time(receipt.submittedAt)}
            </p>
          </div>
        </Panel>
        <Panel
          title="Items in this claim"
          subtitle="Shows which items the member edited or removed"
        >
          <div className="treasury-annotation">
            <span className="eyebrow">
              {receipt.expenseId ? 'FINAL CLAIM' : 'DRAFT REVIEW'} ·{' '}
              {receipt.expenseId || receipt.id}
            </span>
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
                        ? 'Edited by member'
                        : 'Unchanged'}
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
              <span>Amount claimed</span>
              <strong>{money(total)}</strong>
            </div>
            <Badge tone={total === amount ? 'green' : 'danger'}>
              {total === amount
                ? receipt.expenseId
                  ? 'Matches claim amount'
                  : 'Matches draft amount'
                : 'Doesn’t match claim amount · can’t approve yet'}
            </Badge>
            <p className="field-hint">
              Built from the member’s item list. Items are not marked on the photo.
            </p>
          </div>
        </Panel>
      </div>
      <Panel
        title="Original vs. final items"
        subtitle={
          receipt.extraction?.method === 'manual'
            ? 'Typed in by the member, with their edits'
            : 'What the scan read vs. what the member changed'
        }
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
                <th>READ FROM RECEIPT</th>
                <th>ORIGINAL AMOUNT</th>
                <th>FINAL DESCRIPTION</th>
                <th>FINAL AMOUNT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.original.id}>
                  <td>{l.original.description}</td>
                  <td className="money">{money(lineValue(l.original))}</td>
                  <td>
                    {l.final.description}
                    {l.final.quantityMilli !== undefined && (
                      <small className="cell-sub">
                        Qty {l.final.quantityMilli / 1000} × {money(l.final.unitPrice!)}
                      </small>
                    )}
                  </td>
                  <td className="money">{money(lineValue(l.final))}</td>
                  <td>
                    <Badge tone={l.excluded ? 'danger' : l.edited ? 'gold' : 'green'}>
                      {l.excluded ? 'Not claimed' : l.edited ? 'Edited' : 'Claimed'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Receipt edit history"
        subtitle="Who changed what, when and why"
      >
        <div className="treasury-evidence-history">
          {receipt.edits.map((edit, i) => (
            <article key={`${edit.lineId}-${i}`}>
              <div className="row between wrap">
                <h3>
                  {edit.type ?? (edit.excluded
                    ? 'Item excluded'
                    : edit.beforeExcluded
                      ? 'Item included again'
                      : 'Edited')}
                </h3>
                <small>
                  {time(edit.at)} · {edit.actor}
                </small>
              </div>
              <p>
                Before: {edit.before.description} · {money(lineValue(edit.before))}
                {edit.before.quantityMilli !== undefined
                  ? ` · Qty ${edit.before.quantityMilli / 1000} × ${money(edit.before.unitPrice!)}`
                  : ''}
              </p>
              <p>
                After: {edit.after.description} · {money(lineValue(edit.after))}
                {edit.after.quantityMilli !== undefined
                  ? ` · Qty ${edit.after.quantityMilli / 1000} × ${money(edit.after.unitPrice!)}`
                  : ''}
                {edit.excluded ? ' · excluded from total' : ''}
              </p>
              <p className="muted">{edit.reason}</p>
            </article>
          ))}
          {!receipt.edits.length && (
            <p className="muted">The member made no changes to the receipt.</p>
          )}
          {receipt.totalEdits?.map((e, i) => (
            <article key={`total-${i}`}>
              <h3>Receipt total corrected</h3>
              <p>
                {money(e.before)} → {money(e.after)} · {e.reason}
              </p>
              <small>
                {e.actor} · {time(e.at)}
              </small>
            </article>
          ))}
        </div>
      </Panel>
      {receipt.extraction && (
        <Panel
          title="Scanned text & totals"
          subtitle={
            receipt.extraction.method === 'tesseract'
              ? 'Read automatically from the photo · the member checked it'
              : 'Typed in by the member'
          }
        >
          <div className="treasury-evidence-history">
            <div className="row between wrap">
              <span>Total read from receipt: {money(receipt.originalTotal!)}</span>
              <span>Total after edits: {money(reviewedTotal(receipt))}</span>
              <strong>Amount claimed: {money(total)}</strong>
            </div>
            <p className="field-hint">
              Purchase date: {receipt.purchaseDate}. Tax and discounts appear as their own lines.
              Nothing is split behind the scenes.
            </p>
            <details>
              <summary>Show scanned text</summary>
              <pre className="receipt-raw" tabIndex={0} aria-label="Scanned receipt text">
                {receipt.extraction.rawText ||
                  'Typed in by the member. Not scanned.'}
              </pre>
            </details>
          </div>
        </Panel>
      )}
    </>
  );
}
