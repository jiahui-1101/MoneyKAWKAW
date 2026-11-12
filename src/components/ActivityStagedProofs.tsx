import { useEffect, useState } from 'react';
import { activityClosing } from '../services/supabase/activity-closing';
import type { ClosingActionRunner } from './ActivityClosingActions';
import { Field } from './Field';
import { Modal, Panel, useFormat } from './ui';

type Staging = Awaited<ReturnType<typeof activityClosing.stagedProofs>>[number];

export function ActivityStagedProofs({ activity, revision, busy, run }: {
  activity: string; revision: number; busy: boolean; run: ClosingActionRunner;
}) {
  const [records, setRecords] = useState<Staging[]>();
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Staging>();
  const [reason, setReason] = useState('');
  const { time } = useFormat();
  useEffect(() => {
    const control = new AbortController();
    activityClosing.stagedProofs(activity, control.signal).then((list) => {
      if (!control.signal.aborted) setRecords(list);
    }).catch(() => {
      if (!control.signal.aborted) setError('Incomplete proof records could not be loaded.');
    });
    return () => control.abort();
  }, [activity, revision]);
  return (
    <Panel title="Incomplete proof staging" subtitle="Review unused uploads before Treasurer sign-off">
      <div className="panel-body stack">
        {error && <p className="form-error" role="alert">{error}</p>}
        {!records && !error && <p role="status">Loading incomplete proof uploads…</p>}
        {records?.length === 0 && <p>No uploads are available for your independent Treasurer review.</p>}
        {records?.map((record) => <div className="row wrap" key={record.id}>
          <span>{record.filename} · {record.size_bytes.toLocaleString()} bytes · {time(record.created_at)}</span>
          <button type="button" className="btn" disabled={busy} onClick={() => { setReason(''); setSelected(record); }}>
            Abandon incomplete upload
          </button>
        </div>)}
      </div>
      {selected && <Modal title="Abandon incomplete proof upload" onClose={() => setSelected(undefined)}>
        <div className="stack">
          <p>This records the disposition of {selected.filename}. Any staged bytes stay available for the cleanup preview.</p>
          <Field label="Reason" id="staged-proof-reason" required>
            <textarea id="staged-proof-reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <button type="button" className="btn primary" disabled={busy || reason.trim().length < 3}
            onClick={() => {
              setSelected(undefined);
              void run('Abandon proof staging', () => activityClosing.abandonProof(activity, selected.id, reason));
            }}>Confirm abandonment</button>
        </div>
      </Modal>}
    </Panel>
  );
}
