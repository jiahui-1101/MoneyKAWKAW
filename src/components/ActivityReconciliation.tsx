import { closingChecklist, type ClosingReport } from '../domain/activity-closing';
import { Badge, Panel, useFormat } from './ui';

export function ActivityReconciliation({ report }: { report: ClosingReport }) {
  const { facts, reconciliation, decision, history } = report;
  const { money, time } = useFormat();
  const checks = Object.keys(closingChecklist) as (keyof typeof closingChecklist)[];
  const blockers = checks.filter((key) => facts.blockers[key] > 0);
  const figures = [
    ['Activity budget', facts.budget], ['Department allocations', facts.allocated],
    ['Actual paid', facts.paid], ['Unspent allocated budget', facts.unspentAllocated],
    ['Unallocated budget', facts.unallocated], ['Available to plan', facts.available],
    ['Original purchase estimates', facts.estimated], ['Planned commitments', facts.planned],
    ['Open reservations', facts.reserved], ['Pending claim exposure', facts.pending],
    ['Approved unpaid liabilities', facts.liability],
  ] as const;
  return (
    <div className="stack">
      <Panel title="Closing checklist" subtitle="Current obligations and evidence checks">
        <div className="panel-body stack">
          {blockers.length ? (
            <ul>
              {blockers.map((key) => <li key={key}>
                <strong>{closingChecklist[key][0]} ({facts.blockers[key]})</strong>
                <div>{closingChecklist[key][1]}</div>
              </li>)}
            </ul>
          ) : <p><Badge tone="green">No unresolved obligations</Badge></p>}
          {!report.independentDirectorExists && report.state === 'Treasurer Reconciled' &&
            <p className="form-error">A different authorized Director is required to decide this reconciliation.</p>}
          <p className="data-note">
            {facts.taskCount} purchasing tasks · {facts.payments} payments · {facts.confirmed} receipt confirmations · {facts.evidenceCount} retained originals
          </p>
          <p className="data-note">
            {Object.entries(facts.claimStates).map(([state, count]) => state + ' ' + count).join(' · ') || 'No claims'}
          </p>
        </div>
      </Panel>
      <Panel title={reconciliation && report.state !== 'Closing' && report.state !== 'Open'
        ? 'Signed financial report' : 'Financial reconciliation'} subtitle="Authoritative amounts from the activity ledger">
        <div className="panel-body stack">
          <div className="row wrap">
            {figures.map(([label, amount]) => <span key={label} className="data-note">
              {label} <strong>{money(amount, true)}</strong>
            </span>)}
          </div>
          <div className="table-scroll" role="region" tabIndex={0} aria-label="Closing department balances">
            <table>
              <thead><tr><th>Department</th><th>Allocated</th><th>Paid</th><th>{report.state === 'Closing' || report.state === 'Open'
                ? 'Remaining after recorded costs' : 'Unspent allocation'}</th></tr></thead>
              <tbody>{facts.departments.map((department) => <tr key={department.departmentId}>
                <td>{department.name}</td><td>{money(department.budget, true)}</td>
                <td>{money(department.paid, true)}</td><td>{money(department.remaining, true)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="data-note">{facts.audit.count} activity audit events in this report.</p>
          {facts.audit.last && <details>
            <summary>Audit boundaries</summary>
            <p className="data-note">First event {facts.audit.first} · Last event {facts.audit.last}</p>
          </details>}
          {reconciliation && <p>Version {reconciliation.version} signed by {reconciliation.signed_name} on {time(reconciliation.signed_at)}.</p>}
          {decision && <p>{decision.approved ? 'Approved' : 'Returned'} by {decision.decided_name} on {time(decision.decided_at)}. {decision.reason}</p>}
          {history.length > 0 && <details>
            <summary>Reconciliation and approval history</summary>
            <ul>{history.map((entry) => <li key={entry.id}>
              Version {entry.version} · {entry.signedName} · {time(entry.signedAt)}
              {entry.decision && <> · {entry.decision.approved ? 'Approved' : 'Returned'} by {entry.decision.decided_name}. {entry.decision.reason}</>}
            </li>)}</ul>
          </details>}
        </div>
      </Panel>
    </div>
  );
}
