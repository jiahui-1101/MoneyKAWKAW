import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import type { ProofFile } from '../../domain/treasury';
import { claimContext, paymentState } from '../../domain/risk';
import { demoProfiles } from '../../domain/session';
import { reimbursementService } from '../../services/reimbursements';
import { Field } from '../../components/Field';
import { PaymentIssueResolutions } from '../../components/PaymentIssueResolutions';
import { DiscrepancyResolution } from '../../components/treasurer/DiscrepancyResolution';
import { DateField } from '../../components/DateField';
import { ProofPreview } from '../../components/treasurer/ProofPreview';
import { Badge, Empty, Modal, PageHeader, Panel, paymentLabel, useFormat } from '../../components/ui';
export function TreasuryHistory() {
  const { data } = useTreasury();
  const { money, date, time } = useFormat();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(''),
    [activity, setActivity] = useState(params.get('activity') ?? ''),
    [department, setDepartment] = useState(''),
    [member, setMember] = useState('');
  const [from, setFrom] = useState(''),
    [until, setUntil] = useState(''),
    [status, setStatus] = useState(''),
    [selected, setSelected] = useState('');
  const [proof, setProof] = useState<ProofFile | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const payment = data?.payments.find((p) => p.id === selected);
  useEffect(() => {
    let active = true;
    setProof(null);
    setError('');
    if (payment?.manual)
      reimbursementService
        .proof(payment.id)
        .then((p) => {
          if (active) setProof(p);
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Unable to load proof.');
        });
    return () => {
      active = false;
    };
  }, [payment?.id, payment?.manual, attempt]);
  if (!data) return null;
  const records = data.payments
    .filter((p) => {
      const e = data.expenses.find((e) => e.id === p.expenseId)!;
      const c = claimContext(data, e);
      return (
        (!params.get('claim') || e.id === params.get('claim')) &&
        (!activity || e.activityId === activity) &&
        (!department || e.departmentId === department) &&
        (!member || e.review?.claimantId === member) &&
        (!from || p.date >= from) &&
        (!until || p.date <= until) &&
        (!status ||
          (status === 'received'
            ? !!p.manual?.receivedConfirmedAt
            : !p.manual?.receivedConfirmedAt)) &&
        [
          e.id,
          e.description,
          c.activity.name,
          c.department.name,
          p.manual?.reference,
          data.directory?.users.find((u) => u.id === e.review?.claimantId)?.name,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const clear = () => {
    setQuery('');
    setActivity('');
    setDepartment('');
    setMember('');
    setFrom('');
    setUntil('');
    setStatus('');
    setParams({});
  };
  return (
    <div className="stack">
      <PageHeader
        eyebrow="PAYMENT HISTORY"
        title="Payment history"
        description="All recorded payments, with proof and whether the member confirmed."
      />
      <Panel
        title="Recorded payments"
        subtitle="Recorded by the Treasurer. Only the member’s confirmation shows the money arrived."
      >
        <div className="treasury-filters">
          <Field id="history-query" label="Search records">
            <input
              id="history-query"
              placeholder="Claim, member, reference…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field id="history-activity" label="Activity">
            <select
              id="history-activity"
              value={activity}
              onChange={(e) => {
                setActivity(e.target.value);
                setDepartment('');
              }}
            >
              <option value="">All activities</option>
              {data.activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="history-department" label="Department">
            <select
              id="history-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All departments</option>
              {data.activities
                .filter((a) => !activity || a.id === activity)
                .flatMap((a) =>
                  a.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {a.name} · {d.name}
                    </option>
                  )),
                )}
            </select>
          </Field>
          <Field id="history-member" label="Member">
            <select id="history-member" value={member} onChange={(e) => setMember(e.target.value)}>
              <option value="">All members</option>
              {data.directory?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="history-status" label="Member confirmation">
            <select id="history-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="awaiting">Not confirmed yet</option>
              <option value="received">Member confirmed</option>
            </select>
          </Field>
          <Field id="history-from" label="Paid from">
            <DateField
              id="history-from"
              calendarLabel="Choose payment start date"
              value={from}
              onChange={setFrom}
            />
          </Field>
          <Field id="history-until" label="Paid until">
            <DateField
              id="history-until"
              calendarLabel="Choose payment end date"
              min={from}
              value={until}
              onChange={setUntil}
            />
          </Field>
          <button className="btn" onClick={clear}>
            Clear filters
          </button>
        </div>
        <p className="treasury-result" role="status">
          {records.length} payment records · {money(records.reduce((s, p) => s + p.amount, 0))}{' '}
          recorded{params.get('claim') ? ` · Claim ${params.get('claim')}` : ''}
        </p>
        {records.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Payment transaction history"
          >
            <table>
              <thead>
                <tr>
                  {[
                    'CLAIM / ACTIVITY',
                    'DEPARTMENT / MEMBER',
                    'APPROVED / PAID',
                    'METHOD',
                    'PAYMENT DATE',
                    'MEMBER CONFIRMED?',
                    'REFERENCE',
                    'PROOF / DETAILS',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((p) => {
                  const e = data.expenses.find((e) => e.id === p.expenseId)!;
                  const c = claimContext(data, e);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link className="activity-name" to={`/treasurer/claims/${e.id}`}>
                          {e.description}
                        </Link>
                        <small className="cell-sub treasury-id">{e.id}</small>
                        <small className="cell-sub">{c.activity.name}</small>
                      </td>
                      <td>
                        {c.department.name}
                        <small className="cell-sub">
                          {data.directory?.users.find((u) => u.id === e.review?.claimantId)?.name ??
                            'Member unknown'}
                        </small>
                      </td>
                      <td className="money">
                        {money(e.amount)}
                        <small className="cell-sub">Paid {money(p.amount)}</small>
                      </td>
                      <td>
                        {p.manual?.payout.kind ?? 'Not recorded'}
                        <small className="cell-sub">{p.manual?.payout.masked}</small>
                      </td>
                      <td>{date(p.date)}</td>
                      <td>
                        <Badge tone={p.manual?.receivedConfirmedAt ? 'green' : 'gold'}>
                          {paymentLabel(paymentState(data, e))}
                        </Badge>
                      </td>
                      <td>{p.manual?.reference ?? 'Not recorded'}</td>
                      <td>
                        <button className="btn" onClick={() => setSelected(p.id)}>
                          View details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching payment records"
            action={
              <button className="btn" onClick={clear}>
                Clear filters
              </button>
            }
          >
            No payments match. Approved claims appear here after you record their payment.
          </Empty>
        )}
      </Panel>
      {payment && (
        <Modal title="Payment record" onClose={() => setSelected('')}>
          <div className="stack">
            <p>
              <strong>{money(payment.amount)}</strong> · {date(payment.date)}
            </p>
            <Badge tone="gold">Paid outside app · not checked with bank</Badge>
            {payment.manual ? (
              <>
                <p className="settings-copy">
                  Reference: {payment.manual.reference}
                  <br />
                  Recorded by{' '}
                  {demoProfiles.find((p) => p.userId === payment.manual!.recordedBy)?.name ??
                    payment.manual.recordedBy}{' '}
                  · {time(payment.manual.recordedAt)}
                  <br />
                  {payment.manual.payout.holder} · {payment.manual.payout.institution} ·{' '}
                  {payment.manual.payout.masked}
                </p>
                {error ? (
                  <p className="form-error" role="alert">
                    {error}
                    <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
                      Try again
                    </button>
                  </p>
                ) : proof ? (
                  <ProofPreview proof={proof} />
                ) : (
                  <p role="status">Loading proof…</p>
                )}
              </>
            ) : (
              <p className="settings-copy">
                Old sample record. No reference, payment details, proof or member confirmation were
                saved.
              </p>
            )}
            <p className="settings-copy">
              {payment.manual?.receivedConfirmedAt
                ? `Member confirmed receipt ${time(payment.manual.receivedConfirmedAt)}.`
                : 'Waiting for the member to confirm they got the money. Only the member can do this.'}
            </p>
            {payment.manual?.receivedConfirmedBy && (
              <p className="settings-copy">
                Confirmed by{' '}
                {data.directory?.users.find((u) => u.id === payment.manual?.receivedConfirmedBy)
                  ?.name ?? payment.manual.receivedConfirmedBy}
                .
              </p>
            )}
            {payment.manual?.discrepancy && (
              <div className="member-payment-issue">
                <Badge tone={payment.manual.discrepancy.resolvedAt ? 'green' : 'danger'}>
                  {payment.manual.discrepancy.resolvedAt
                    ? 'Problem resolved · member confirmed'
                    : 'Member reported a payment problem'}
                </Badge>
                <p>{payment.manual.discrepancy.reason}</p>
                {payment.manual.discrepancy.receivedAmount !== undefined && (
                  <p>
                    Member reported receiving {money(payment.manual.discrepancy.receivedAmount)}.
                  </p>
                )}
                <small>
                  Reported {time(payment.manual.discrepancy.reportedAt)}
                  {payment.manual.discrepancy.resolvedAt
                    ? ` · resolved ${time(payment.manual.discrepancy.resolvedAt)}`
                    : ''}
                </small>
                <PaymentIssueResolutions issue={payment.manual.discrepancy} />
                <DiscrepancyResolution payment={payment} />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
