import { useState, type FormEvent } from 'react';
import type { ClaimDraft } from '../../domain/member';
import type { ReceiptLine } from '../../domain/treasury';
import { parseMoney } from '../../domain/budget';
import type { OcrSuggestion } from '../../services/receipt-ocr';
import { draftService } from '../../services/member-drafts';
import { useMember } from '../../context/member-context';
import { departmentToday } from '../../domain/hod';
import { DateField } from '../DateField';
import { Field } from '../Field';
import { Panel, useFormat } from '../ui';
import type { DraftChange } from './useMemberDraft';
export function ReceiptBaselineForm({
  draft,
  suggestion,
  method,
  saving,
  change,
  onSaved,
}: {
  draft: ClaimDraft;
  suggestion: OcrSuggestion;
  method: 'tesseract' | 'manual';
  saving: boolean;
  change: DraftChange;
  onSaved: () => void;
}) {
  const { money, currency } = useFormat(),
    { data } = useMember();
  const [merchant, setMerchant] = useState(suggestion.merchant),
    [date, setDate] = useState(suggestion.purchaseDate),
    [total, setTotal] = useState(
      suggestion.total === undefined ? '' : (suggestion.total / 100).toFixed(2),
    ),
    [error, setError] = useState('');
  const [rows, setRows] = useState(() =>
    suggestion.lines.length
      ? suggestion.lines.map((l) => ({ ...l, amountText: (l.amount / 100).toFixed(2) }))
      : [
          {
            id: crypto.randomUUID(),
            description: '',
            amount: 0,
            kind: 'item' as const,
            amountText: '',
          },
        ],
  );
  const update = (id: string, key: 'description' | 'amountText' | 'kind', value: string) =>
    setRows((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const lines: ReceiptLine[] = rows.map((r) => ({
        id: r.id,
        description: r.description,
        amount: parseMoney(r.amountText),
        kind: r.kind,
        quantityMilli: r.quantityMilli,
        unitPrice: r.unitPrice,
      }));
      await change(
        () =>
          draftService.baseline(draft.id, draft.updatedAt, {
            merchant,
            purchaseDate: date,
            originalTotal: parseMoney(total),
            lines,
            method,
            rawText: suggestion.rawText,
          }),
        method === 'tesseract'
          ? 'Original OCR suggestions captured. Make corrections in the item editor.'
          : 'Manual source values captured. No OCR accuracy is claimed.',
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to capture receipt source values.');
    }
  };
  return (
    <Panel
      title={
        method === 'tesseract'
          ? 'Review the original OCR suggestions'
          : 'Enter the receipt’s source values'
      }
      subtitle={
        method === 'tesseract'
          ? 'Check the image. Source item values are captured unchanged; corrections follow in the next step.'
          : 'Transcribe the actual uploaded receipt. Manual values are explicitly labeled, not presented as OCR.'
      }
    >
      <form className="member-content stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field id="receipt-merchant" label="Merchant" required>
            <input
              id="receipt-merchant"
              maxLength={150}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
          </Field>
          <Field id="receipt-purchase-date" label="Purchase date" required>
            <DateField
              id="receipt-purchase-date"
              calendarLabel="Choose receipt purchase date"
              max={departmentToday(data!.settings.timezone)}
              value={date}
              onChange={setDate}
            />
          </Field>
          <Field id="receipt-original-total" label={`Printed receipt total (${currency})`} required>
            <input
              id="receipt-original-total"
              inputMode="decimal"
              readOnly={method === 'tesseract' && suggestion.total !== undefined}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </Field>
        </div>
        {method === 'tesseract' ? (
          <>
            <p className="field-hint">
              {suggestion.lines.length} candidate amount lines. Unrecognized items can be added with
              reasons after capture. Correct a misread total in the next step; the original OCR
              total remains in history.
            </p>
            <div className="member-source-rows">
              {rows.map((r) => (
                <div className="row between" key={r.id}>
                  <span>{r.description}</span>
                  <strong className="money">
                    {money(r.kind === 'discount' ? -r.amount : r.amount)}
                  </strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="field-hint">
              Enter item, tax, and discount amounts as positive magnitudes. Discount lines subtract
              from totals. Allocate shared charges explicitly during review.
            </p>
            {rows.map((r, i) => (
              <div className="member-baseline-row" key={r.id}>
                <Field
                  id={`source-description-${r.id}`}
                  label={`Item ${i + 1} description`}
                  required
                >
                  <input
                    id={`source-description-${r.id}`}
                    maxLength={180}
                    value={r.description}
                    onChange={(e) => update(r.id, 'description', e.target.value)}
                  />
                </Field>
                <Field id={`source-kind-${r.id}`} label="Line type">
                  <select
                    id={`source-kind-${r.id}`}
                    value={r.kind}
                    onChange={(e) => update(r.id, 'kind', e.target.value)}
                  >
                    <option value="item">Item</option>
                    <option value="tax">Tax / charge</option>
                    <option value="discount">Discount</option>
                  </select>
                </Field>
                <Field id={`source-amount-${r.id}`} label={`Amount (${currency})`} required>
                  <input
                    id={`source-amount-${r.id}`}
                    inputMode="decimal"
                    value={r.amountText}
                    onChange={(e) => update(r.id, 'amountText', e.target.value)}
                  />
                </Field>
                <button
                  className="btn"
                  type="button"
                  disabled={rows.length === 1}
                  onClick={() => setRows((rows) => rows.filter((row) => row.id !== r.id))}
                >
                  Remove source row
                </button>
              </div>
            ))}
            <button
              className="btn"
              type="button"
              disabled={rows.length >= 100}
              onClick={() =>
                setRows((rows) => [
                  ...rows,
                  {
                    id: crypto.randomUUID(),
                    description: '',
                    amount: 0,
                    kind: 'item',
                    amountText: '',
                  },
                ])
              }
            >
              Add source item
            </button>
          </>
        )}
        {suggestion.rawText && (
          <details>
            <summary>View actual recognized text</summary>
            <pre className="receipt-raw">{suggestion.rawText}</pre>
          </details>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" disabled={saving || !rows.length}>
          {saving ? 'Capturing…' : 'Capture source & edit claimable items'}
        </button>
      </form>
    </Panel>
  );
}
