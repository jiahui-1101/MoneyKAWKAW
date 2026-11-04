import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTreasury } from '../../context/treasury-context';
import type { ProofFile } from '../../domain/treasury';
import { claimContext, paymentState } from '../../domain/risk';
import { demoProfiles } from '../../domain/session';
import { reimbursementService } from '../../services/reimbursements';
import { Field } from '../../components/Field';
import { DateField } from '../../components/DateField';
import { ProofPreview } from '../../components/treasurer/ProofPreview';
import { Badge, Empty, Modal, PageHeader, Panel, useFormat } from '../../components/ui';
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
        title="Every reimbursement leaves a record."
        description="Immutable payment amounts, references, proof, and the member’s separate receipt status."
      />
      <Panel
        title="Recorded reimbursements"
        subtitle="A local record is not independent verification of an external transfer"
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
          <Field id="history-status" label="Receipt status">
            <select id="history-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All receipt statuses</option>
              <option value="awaiting">Awaiting member confirmation</option>
              <option value="received">Received confirmed</option>
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
                    'RECEIPT STATUS',
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
                            'Legacy claimant unavailable'}
                        </small>
                      </td>
                      <td className="money">
                        {money(e.amount)}
                        <small className="cell-sub">Paid {money(p.amount)}</small>
                      </td>
                      <td>
                        {p.manual?.payout.kind ?? 'Legacy · not retained'}
                        <small className="cell-sub">{p.manual?.payout.masked}</small>
                      </td>
                      <td>{date(p.date)}</td>
                      <td>
                        <Badge tone={p.manual?.receivedConfirmedAt ? 'green' : 'gold'}>
                          {paymentState(data, e)}
                        </Badge>
                      </td>
                      <td>{p.manual?.reference ?? 'Legacy · not retained'}</td>
                      <td>
                        <button className="btn" onClick={() => setSelected(p.id)}>
                          {p.manual ? 'View proof & details' : 'View legacy record'}
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
            Approved claims remain in the reimbursement queue until a manual payment record is
            saved.
          </Empty>
        )}
      </Panel>
      {payment && (
        <Modal title="Immutable payment record" onClose={() => setSelected('')}>
          <div className="stack">
            <p>
              <strong>{money(payment.amount)}</strong> · {date(payment.date)}
            </p>
            <Badge tone="gold">External transfer unverified</Badge>
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
                      Retry proof
                    </button>
                  </p>
                ) : proof ? (
                  <ProofPreview proof={proof} />
                ) : (
                  <p role="status">Loading preserved proof…</p>
                )}
              </>
            ) : (
              <p className="settings-copy">
                This historical fictional sample predates manual proof capture. Its payment
                reference, destination, proof, and member receipt confirmation were not retained.
              </p>
            )}
            <p className="settings-copy">
              {payment.manual?.receivedConfirmedAt
                ? `Member confirmed receipt ${time(payment.manual.receivedConfirmedAt)}.`
                : 'Awaiting member receipt confirmation. Treasurer cannot confirm on the member’s behalf.'}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
