import type { ClosingReport } from '../domain/activity-closing';
import { activityClosing, archiveFailureMessage, type ClosingRole } from '../services/supabase/activity-closing';
import type { ClosingActionRunner } from './ActivityClosingActions';
import { Badge, Panel, useFormat } from './ui';

export function ActivityArchiveDetails({ activity, report, role, busy, run }: {
  activity: string; report: ClosingReport; role: ClosingRole; busy: boolean; run: ClosingActionRunner;
}) {
  const { archive, state } = report;
  const { time } = useFormat();
  if (!archive) return null;
  async function download() {
    const blob = await activityClosing.download(activity);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'activity-' + activity + '.json.gz';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Panel title="Archive integrity" subtitle="Version 1 · canonical JSON compressed with gzip">
      <div className="panel-body stack">
        <div className="row wrap">
          <Badge tone={archive.verification_state === 'Verified' ? 'green'
            : archive.verification_state === 'Failed' ? 'danger' : 'gold'}>{archive.verification_state}</Badge>
          {archive.checked_at && <span>Checked {time(archive.checked_at)}</span>}
        </div>
        {archive.failure_code && <p className="form-error" role="alert">{archiveFailureMessage(archive.failure_code)}</p>}
        <div className="row wrap">
          <span>{archive.logical_bytes.toLocaleString()} logical bytes</span>
          {archive.compressed_bytes !== null && <span>{archive.compressed_bytes.toLocaleString()} compressed bytes</span>}
          {archive.verified_evidence_count !== null && <span>{archive.verified_evidence_count} original files checked</span>}
        </div>
        <details>
          <summary>SHA-256 checksums</summary>
          <p style={{ overflowWrap: 'anywhere' }}>Logical SHA-256 <code>{archive.logical_sha256}</code></p>
          {archive.compressed_sha256 && <p style={{ overflowWrap: 'anywhere' }}>
            Compressed SHA-256 <code>{archive.compressed_sha256}</code>
          </p>}
        </details>
        <p className="data-note">The package references private original receipts and payment proofs. Recovery requires those retained files.</p>
        {state === 'Archived' && <div className="row wrap">
          <button className="btn" type="button" disabled={busy}
            onClick={() => void run('Reverify archive and evidence', () => activityClosing.archive(activity, role, 'verify'))}>
            Reverify archive and evidence
          </button>
          {role === 'Treasurer' && <button className="btn" type="button" disabled={busy}
            onClick={() => void run('Retrieve verified archive', download)}>Download verified package</button>}
        </div>}
      </div>
    </Panel>
  );
}
