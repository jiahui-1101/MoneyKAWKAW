import type { ManualPayment } from '../domain/treasury';
import { demoProfiles } from '../domain/session';
import { useFormat } from './ui';
export function PaymentIssueResolutions({
  issue,
}: {
  issue: NonNullable<ManualPayment['discrepancy']>;
}) {
  const { time } = useFormat();
  return (
    <>
      {issue.resolutions?.map((r, i) => (
        <article key={`${r.at}-${i}`}>
          <h3>Treasurer’s reply</h3>
          <p>{r.note}</p>
          <small>
            {demoProfiles.find((p) => p.userId === r.by)?.name ?? r.by} · {time(r.at)}
          </small>
          <p className="field-hint">
            This reply doesn’t mean the money arrived. Only the member can confirm that.
          </p>
        </article>
      ))}
    </>
  );
}
