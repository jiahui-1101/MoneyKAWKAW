import { useState } from 'react';
import type { ClosingReport } from '../domain/activity-closing';
import { activityClosing, type ClosingRole } from '../services/supabase/activity-closing';
import { Field } from './Field';
import { Modal, useFormat } from './ui';

type Confirmation = 'close' | 'reopen' | 'sign' | 'approve' | 'return';
const titles: Record<Confirmation, string> = {
  close: 'Request activity closing',
  reopen: 'Reopen for corrections',
  sign: 'Sign reconciliation',
  approve: 'Approve reconciliation',
  return: 'Return for correction',
};
const confirmationText: Record<Confirmation, string> = {
  close: 'Closing blocks new purchases, claims and setup changes. Existing financial obligations can still be resolved.',
  reopen: 'Ordinary setup and purchasing operations resume. The closing and decision history stays available.',
  sign: 'Signing freezes the financial records and submits this version to an independent Director.',
  approve: 'Confirm the Treasurer’s final financial report before authorizing archive creation.',
  return: 'The Treasurer can review a new version. This signed version and your reason remain in history.',
};

export type ClosingActionRunner = (label: string, operation: () => Promise<void>) => Promise<void>;

export function ActivityClosingActions({ activity, role, planning, report, busy, run }: {
  activity: string; role: ClosingRole; planning: boolean; report: ClosingReport;
  busy: boolean; run: ClosingActionRunner;
}) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [reason, setReason] = useState('');
  const { money } = useFormat();
  const clear = Object.values(report.facts.blockers).every((count) => count === 0);
  const director = role === 'Director';
  const openConfirmation = (action: Confirmation) => {
    setReason('');
    setConfirmation(action);
  };
  const confirm = () => {
    if (!confirmation) return;
    const action = confirmation;
    setConfirmation(null);
    const operations: Record<Confirmation, () => Promise<void>> = {
      close: () => activityClosing.close(activity),
      reopen: () => activityClosing.reopen(activity, report.revision, reason),
      sign: () => activityClosing.sign(activity, report.revision),
      approve: () => activityClosing.decide(activity, report, true, ''),
      return: () => activityClosing.decide(activity, report, false, reason),
    };
    void run(titles[action], operations[action]);
  };
  const button = (action: Confirmation, primary = false, disabled = false) =>
    <button type="button" className={primary ? 'btn primary' : 'btn'} disabled={busy || disabled}
      onClick={() => openConfirmation(action)}>{titles[action]}</button>;
  return (
    <>
      <div className="row wrap">
        {director && report.state === 'Open' && !planning && button('close', true)}
        {['Open', 'Closing'].includes(report.state) &&
          <button type="button" className="btn" disabled={busy}
            onClick={() => void run('Check closing readiness', () => activityClosing.check(activity, role))}>Run readiness check</button>}
        {director && report.state === 'Closing' && button('reopen')}
        {!director && report.state === 'Closing' && button('sign', true, !clear)}
        {director && report.state === 'Treasurer Reconciled' && report.canDecide &&
          <>{button('approve', true)}{button('return')}</>}
        {director && ['Director Approved', 'Archiving'].includes(report.state) &&
          <button type="button" className="btn primary" disabled={busy}
            onClick={() => void run('Generate and verify archive', () => activityClosing.archive(activity, role, 'generate'))}>
            {report.state === 'Archiving' ? 'Retry archive' : 'Generate and verify archive'}
          </button>}
      </div>
      {director && report.state === 'Treasurer Reconciled' && !report.canDecide &&
        <p className="data-note">A Director other than the Treasurer who signed must record the decision.</p>}
      {confirmation && <Modal title={titles[confirmation]} onClose={() => setConfirmation(null)}>
        <div className="stack">
          <p>{confirmationText[confirmation]}</p>
          {['sign', 'approve', 'return'].includes(confirmation) &&
            <p>Actual paid {money(report.facts.paid, true)} · {report.facts.payments} recorded payments
              {report.reconciliation && <> · Signed by {report.reconciliation.signed_name}</>}</p>}
          {['return', 'reopen'].includes(confirmation) && <Field id="closing-reason" label="Reason" required>
            <textarea id="closing-reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
          </Field>}
          <div className="row wrap">
            <button type="button" className="btn" onClick={() => setConfirmation(null)}>Cancel</button>
            <button type="button" className="btn primary" onClick={confirm}
              disabled={['return', 'reopen'].includes(confirmation) && reason.trim().length < 3}>
              Confirm {confirmation === 'sign' ? 'Treasurer sign-off' : confirmation === 'approve' ? 'Director approval' : titles[confirmation].toLowerCase()}
            </button>
          </div>
        </div>
      </Modal>}
    </>
  );
}
