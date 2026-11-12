import { useState } from 'react';
import type { CleanupPreview, ClosingReport } from '../domain/activity-closing';
import { activityClosing } from '../services/supabase/activity-closing';
import type { ClosingActionRunner } from './ActivityClosingActions';
import { Field } from './Field';
import { Panel, useFormat } from './ui';

export function ActivityArchiveRetention({ activity, archive, busy, run }: {
  activity: string; archive: NonNullable<ClosingReport['archive']>; busy: boolean; run: ClosingActionRunner;
}) {
  const [policy, setPolicy] = useState(archive.retention_policy?.id ?? '');
  const [days, setDays] = useState(archive.retention_policy?.days.toString() ?? '');
  const [hold, setHold] = useState(archive.legal_hold);
  const [preview, setPreview] = useState<CleanupPreview>();
  const { time } = useFormat();
  return (
    <Panel title="Retention and cleanup preview" subtitle="Preserve original evidence and financial history">
      <div className="panel-body stack">
        <p className="data-note">{archive.retention_policy
          ? 'Adopted policy ' + archive.retention_policy.id + (archive.legal_hold ? ' · Hold active' : '')
          : 'No retention policy has been adopted for this archive. Keep retained evidence.'}</p>
        {archive.retain_until && <p>Expected retention through {time(archive.retain_until)}.</p>}
        <details>
          <summary>Record an adopted retention policy</summary>
          <form className="stack" onSubmit={(event) => {
            event.preventDefault();
            void run('Save adopted retention policy', () => activityClosing.retention(activity, policy, Number(days), hold));
          }}>
            <Field label="Policy identifier" id="archive-policy" required>
              <input id="archive-policy" required minLength={3} maxLength={80} value={policy} onChange={(event) => setPolicy(event.target.value)} />
            </Field>
            <Field label="Retention days" id="archive-retention-days" required>
              <input id="archive-retention-days" type="number" required min={1} max={36500} value={days} onChange={(event) => setDays(event.target.value)} />
            </Field>
            <label className="member-check-field"><input type="checkbox" checked={hold}
              onChange={(event) => setHold(event.target.checked)} /> Organizational or legal hold</label>
            <button className="btn" disabled={busy}>Save adopted policy</button>
          </form>
        </details>
        <button className="btn" type="button" disabled={busy}
          onClick={() => void run('Preview staging cleanup', async () => { setPreview(await activityClosing.cleanup(activity)); })}>
          Preview staging cleanup
        </button>
        {preview && <div role="status">
          <p>{preview.candidateCount} abandoned staging objects · {preview.potentialBytes.toLocaleString()} potential bytes.</p>
          <p>{preview.eligibleForReview ? 'Eligible for a separate authorized review.' : 'Review requires an adopted policy, verified archive and no hold.'}</p>
          {preview.candidates.length > 0 && <ul>{preview.candidates.map((item) =>
            <li key={item.id}>{item.kind} · {item.bytes.toLocaleString()} bytes</li>)}</ul>}
        </div>}
        <p className="data-note">This preview only lists abandoned, unfinalized staging. It does not delete files.</p>
      </div>
    </Panel>
  );
}
