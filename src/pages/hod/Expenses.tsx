import { ArrowUpRight, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DepartmentBalances, DepartmentMetrics, useDepartmentScope, TaskTable } from '../../components/hod/HodWidgets';
import { Empty, PageHeader, Panel, Status, useFormat } from '../../components/ui';
import { MetricCards } from '../../components/MetricCards';
import { CircleDollarSign, Clock, Wallet, CheckCircle2 } from 'lucide-react';
import { demoMode } from '../../services/supabase/client';

export function HodExpenses() {
  const { data, scope, tasks, base, summary } = useDepartmentScope();
  const { money, date } = useFormat();
  const [query, setQuery] = useState(''),
    [review, setReview] = useState(''),
    [payment, setPayment] = useState('');
  if (!demoMode) return <div className="stack">
    <PageHeader eyebrow={`${scope.department.name.toUpperCase()} · CLAIMS & PAYMENTS`}
      title="Department finances"
      description="Authorized department totals separate purchasing plans, pending claims, approved obligations, and recorded payments." />
    <DepartmentMetrics data={data} scope={scope} />
    <DepartmentBalances data={data} scope={scope} />
    <Panel title="Private claim evidence stays protected" subtitle="Department aggregates only">
      <p className="settings-copy">Claim decisions belong to the Treasurer. Individual receipts, payout details, and payment proof remain restricted to the claimant and authorized Treasurer.</p>
    </Panel>
  </div>;
  const expenses = data.expenses
    .filter((e) => e.activityId === scope.activity.id && e.departmentId === scope.department.id)
    .filter((e) => {
      const paid = data.payments
        .filter((p) => p.expenseId === e.id)
        .reduce((sum, p) => sum + p.amount, 0);
      return (
        e.description.toLowerCase().includes(query.toLowerCase()) &&
        (!review || e.state === review) &&
        (!payment ||
          (payment === 'paid' && paid >= e.amount) ||
          (payment === 'unpaid' && paid < e.amount))
      );
    });
  return (
    <div className="stack">
      <PageHeader
        eyebrow={`${scope.department.name.toUpperCase()} · CLAIMS & PAYMENTS`}
        title="Expenses & claims"
        description="See claim status and payments. Only the Treasurer can approve or pay."
      />
      <MetricCards
        items={[
          {
            label: 'Submitted claim amounts',
            value: money(summary.recorded, true),
            icon: CircleDollarSign,
            note: 'All claims submitted',
            tone: 'brand',
          },
          {
            label: 'Awaiting review',
            value: money(summary.pending, true),
            icon: Clock,
            note: 'Treasurer decision pending',
            tone: 'gold',
          },
          {
            label: 'Not yet paid back',
            value: money(summary.recorded - summary.paid, true),
            icon: Wallet,
            note: 'Includes claims awaiting review',
            tone: 'violet',
          },
          {
            label: 'Paid reimbursements',
            value: money(summary.paid, true),
            icon: CheckCircle2,
            note: 'Sample data',
            tone: 'green',
          },
        ]}
      />
      <Panel
        title="Department expense & claim records"
        subtitle="Sample claims (view only)"
      >
        <div className="filters">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search department expenses"
              placeholder="Search expense descriptions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="filter-selects">
            <select
              aria-label="Claim status"
              value={review}
              onChange={(e) => setReview(e.target.value)}
            >
              <option value="">All claim statuses</option>
              <option>Pending review</option>
              <option>In review</option>
              <option>Approved</option>
              <option>Declined</option>
            </select>
            <select
              aria-label="Payment status"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            >
              <option value="">All payment statuses</option>
              <option value="paid">Paid in full</option>
              <option value="unpaid">Not fully paid</option>
            </select>
          </div>
        </div>
        {expenses.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Department expense and claim records"
          >
            <table>
              <thead>
                <tr>
                  <th>PURCHASE / CLAIM</th>
                  <th>MEMBER</th>
                  <th>CLAIM STATUS</th>
                  <th>ITEM ESTIMATE</th>
                  <th>CLAIM AMOUNT</th>
                  <th>DIFFERENCE</th>
                  <th>PAID</th>
                  <th>
                    <span className="sr-only">Task details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => {
                  const task = tasks.find((t) => t.expenseId === e.id);
                  const paid = data.payments
                    .filter((p) => p.expenseId === e.id)
                    .reduce((sum, p) => sum + p.amount, 0);
                  const variance = task ? e.amount - task.budget : 0;
                  return (
                    <tr key={e.id}>
                      <td>
                        <strong className="expense-title">{e.description}</strong>
                        <small className="cell-sub">
                          {e.id} · {date(e.date)}
                        </small>
                      </td>
                      <td>
                        {data.directory.users.find((u) => u.id === task?.purchasing?.assigneeId)
                          ?.name ?? 'No linked task'}
                      </td>
                      <td>
                        <Status value={e.state} />
                      </td>
                      <td className="money">{task ? money(task.budget) : '—'}</td>
                      <td className="money">{money(e.amount)}</td>
                      <td className={`money ${variance > 0 ? 'danger-text' : 'good-text'}`}>
                        {task ? `${variance > 0 ? '+' : ''}${money(variance)}` : '—'}
                      </td>
                      <td>
                        <span className={paid ? 'good-text' : 'muted'}>
                          {paid ? money(paid) : 'Not paid'}
                        </span>
                      </td>
                      <td>
                        {task && (
                          <Link
                            className="table-arrow"
                            to={`${base}/tasks/${task.id}`}
                            aria-label={`View purchase for ${e.description}`}
                          >
                            <ArrowUpRight size={15} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching claim records"
            action={
              query || review || payment ? (
                <button
                  className="btn"
                  onClick={() => {
                    setQuery('');
                    setReview('');
                    setPayment('');
                  }}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          >
            Claims appear here when department members submit them. HOD purchasing actions do not
            create claims.
          </Empty>
        )}
      </Panel>
      <Panel title="Purchased items awaiting a claim" subtitle="Purchased does not mean reimbursed">
        <TaskTable
          tasks={tasks.filter((t) => t.purchasing!.status === 'Purchased' && !t.expenseId)}
          data={data}
        />
      </Panel>
      <p className="data-note">
        Approval, over-budget risk review, and payment recording belong to the Treasurer. No bank
        account, eWallet identifier, receipt file, or payout instructions are exposed here.
      </p>
    </div>
  );
}
