import type { CleanupPreview, ClosingReport } from '../../domain/activity-closing';
import { supabaseClient } from './client';
import { checked, requestKey } from './finance';

export type ClosingRole = 'Director' | 'Treasurer';
type ArchiveOperation = 'generate' | 'verify' | 'download';

const archiveErrors: Record<string, string> = {
  UPLOAD_FAILED: 'Private Storage did not accept the archive. Retry the same archive.',
  ARCHIVE_MISSING: 'The compressed archive object is missing.',
  ARCHIVE_MISMATCH: 'The compressed archive or its logical contents failed the checksum check.',
  EVIDENCE_MISSING: 'A retained receipt or payment proof could not be retrieved.',
  EVIDENCE_MISMATCH: 'A retained receipt or payment proof did not match its recorded bytes.',
  FINALIZATION_FAILED: 'Archive verification could not be recorded. Refresh and retry.',
};

export const archiveFailureMessage = (code: string | null) =>
  code ? archiveErrors[code] ?? 'Archive verification needs attention.' : '';

async function archiveAction<T>(activity: string, role: ClosingRole, operation: ArchiveOperation): Promise<T> {
  const { data, error } = await supabaseClient().functions.invoke<T>('activity-archive', {
    body: { activity, role, operation },
  });
  if (!error && data !== null) return data;
  let message = 'The archive service could not finish. Refresh and retry.';
  if (error && 'context' in error && error.context instanceof Response) {
    const body = await error.context.json().catch(() => null);
    message = archiveFailureMessage(body?.code ?? null) || body?.message || message;
  }
  throw new Error(message);
}

export const activityClosing = {
  async report(activity: string, role: ClosingRole, signal?: AbortSignal) {
    const query = supabaseClient().rpc('activity_closing_report', { p_activity: activity, p_role: role });
    return checked(await (signal ? query.abortSignal(signal) : query)) as unknown as ClosingReport;
  },
  async check(activity: string, role: ClosingRole) {
    checked(await supabaseClient().rpc('activity_closing_readiness', { p_activity: activity, p_role: role }));
  },
  async close(activity: string) {
    checked(await supabaseClient().rpc('request_activity_close', { p_activity: activity }));
  },
  async reopen(activity: string, revision: number, reason: string) {
    checked(await supabaseClient().rpc('reopen_activity_closing', { p_activity: activity, p_revision: revision, p_reason: reason }));
  },
  async sign(activity: string, revision: number) {
    checked(await supabaseClient().rpc('sign_activity_reconciliation', {
      p_activity: activity, p_revision: revision, p_request_key: requestKey(activity + ':sign:' + revision),
    }));
  },
  async decide(activity: string, report: ClosingReport, approved: boolean, reason: string) {
    if (!report.reconciliation) throw new Error('The current signed reconciliation is required.');
    checked(await supabaseClient().rpc('decide_activity_reconciliation', {
      p_activity: activity, p_reconciliation: report.reconciliation.id, p_revision: report.revision,
      p_request_key: requestKey(activity + ':decision:' + report.revision + ':' + approved + ':' + reason),
      p_approved: approved, p_reason: reason,
    }));
  },
  async resolvePurchase(task: string, reason: string) {
    checked(await supabaseClient().rpc('resolve_closing_purchase', { p_task: task, p_reason: reason }));
  },
  async stagedProofs(activity: string, signal: AbortSignal) {
    return checked(await supabaseClient().rpc('activity_staged_proofs', { p_activity: activity }).abortSignal(signal));
  },
  async abandonProof(activity: string, proof: string, reason: string) {
    checked(await supabaseClient().rpc('abandon_closing_proof', { p_activity: activity, p_proof: proof, p_reason: reason }));
  },
  async archive(activity: string, role: ClosingRole, operation: 'generate' | 'verify') {
    await archiveAction(activity, role, operation);
  },
  async download(activity: string) {
    return archiveAction<Blob>(activity, 'Treasurer', 'download');
  },
  async retention(activity: string, policy: string, days: number, hold: boolean) {
    checked(await supabaseClient().rpc('set_activity_archive_retention', {
      p_activity: activity, p_policy: policy, p_days: days, p_hold: hold,
    }));
  },
  async cleanup(activity: string) {
    return checked(await supabaseClient().rpc('preview_activity_archive_cleanup', { p_activity: activity })) as unknown as CleanupPreview;
  },
};
