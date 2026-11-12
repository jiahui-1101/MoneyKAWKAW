import { useEffect, useState } from 'react';
import { financialStateLabel, type ClosingReport } from '../domain/activity-closing';
import type { Activity } from '../domain/models';
import { activityClosing, type ClosingRole } from '../services/supabase/activity-closing';
import { ActivityClosingActions, type ClosingActionRunner } from './ActivityClosingActions';
import { ActivityReconciliation } from './ActivityReconciliation';
import { ActivityArchiveDetails } from './ActivityArchiveDetails';
import { ActivityArchiveRetention } from './ActivityArchiveRetention';
import { Panel, Status } from './ui';

export function ActivityClosingPanel({ activity, workspaceRole: role, reload }: {
  activity: Activity; workspaceRole: ClosingRole; reload: () => Promise<void>;
}) {
  const [report, setReport] = useState<ClosingReport>();
  const [error, setError] = useState('');
  const [working, setWorking] = useState('');
  const [feedback, setFeedback] = useState('');
  const id = activity.id;
  useEffect(() => {
    const control = new AbortController();
    activityClosing.report(id, role, control.signal).then((value) => {
      if (!control.signal.aborted) setReport(value);
    }).catch((cause: unknown) => {
      if (!control.signal.aborted) setError(cause instanceof Error ? cause.message : 'Closing report unavailable.');
    });
    return () => control.abort();
  }, [id, role]);
  const run: ClosingActionRunner = async (label, operation) => {
    setWorking(label);
    setError('');
    setFeedback('');
    try {
      await operation();
      setFeedback(label + ' completed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The closing operation could not finish.');
    }
    try {
      setReport(await activityClosing.report(id, role));
      await reload();
    } catch {
      setFeedback('');
      setError((previous) => previous || 'The current report is unavailable. Refresh to verify the latest state.');
    } finally {
      setWorking('');
    }
  };
  const busy = working !== '';
  return (
    <div className="stack">
      <Panel title="Activity closing" subtitle="Reconciliation, independent approval and verified archive">
        <div className="panel-body stack">
          {error && <p className="form-error" role="alert">{error}</p>}
          {working && <p role="status">{working} in progress…</p>}
          {!working && feedback && <p role="status">{feedback}</p>}
          {!report && !error && <p role="status">Loading the authorized closing report…</p>}
          {!report && error && <button type="button" className="btn" disabled={busy}
            onClick={() => void run('Refresh report', async () => {})}>Refresh report</button>}
          {report && <>
            <div className="row wrap"><Status value={financialStateLabel(report.state, activity.status)} />
              <span className="data-note">Financial revision {report.revision}</span></div>
            <ActivityClosingActions activity={id} role={role} report={report}
              planning={activity.status === 'Planning'} busy={busy} run={run} />
          </>}
        </div>
      </Panel>
      {report && <>
        <ActivityReconciliation report={report} />
        <ActivityArchiveDetails activity={id} report={report} role={role} busy={busy} run={run} />
        {role === 'Director' && report.state === 'Archived' && report.archive &&
          <ActivityArchiveRetention activity={id} archive={report.archive} busy={busy} run={run} />}
      </>}
    </div>
  );
}
