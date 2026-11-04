import { ArrowUpRight, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDepartmentScope, TaskTable } from '../../components/hod/HodWidgets';
import { Empty, PageHeader, Panel, Status, useFormat } from '../../components/ui';
import { MetricCards } from '../../components/MetricCards';
import { CircleDollarSign, Clock, Wallet, CheckCircle2 } from 'lucide-react';

export function HodExpenses() {
  const { data, scope, tasks, base, summary } = useDepartmentScope();
  const { money, date } = useFormat();
  const [query, setQuery] = useState(''),
    [review, setReview] = useState(''),
    [payment, setPayment] = useState('');
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
        eyebrow={`${scope.department.name.toUpperCase()} · FINANCIAL VISIBILITY`}
        title="Purchases tell one part of the story."
        description="Monitor claim review, item variances, and reimbursement without changing financial decisions."
      />
      <MetricCards
        items={[
          {
            label: 'Submitted claim amounts',
            value: money(summary.recorded, true),
            icon: CircleDollarSign,
            note: 'Actual recorded claims',
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
            label: 'Unreimbursed claim amount',
            value: money(summary.recorded - summary.paid, true),
            icon: Wallet,
            note: 'Includes claims awaiting review',
            tone: 'violet',
          },
          {
            label: 'Paid reimbursements',
            value: money(summary.paid, true),
            icon: CheckCircle2,
            note: 'Fictional shared payment records',
            tone: 'green',
          },
        ]}
      />
      <Panel
        title="Department expense & claim records"
        subtitle="Fictional, read-only records linked to shared purchasing tasks"
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
              aria-label="Claim review state"
              value={review}
              onChange={(e) => setReview(e.target.value)}
            >
              <option value="">All review states</option>
              <option>Pending review</option>
              <option>Approved</option>
            </select>
            <select
              aria-label="Reimbursement state"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            >
              <option value="">All reimbursements</option>
              <option value="paid">Fully recorded</option>
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
                  <th>REVIEW</th>
                  <th>ITEM ESTIMATE</th>
                  <th>CLAIM AMOUNT</th>
                  <th>VARIANCE</th>
                  <th>PAYMENT RECORDED</th>
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
                          ?.name ?? 'No assignment'}
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
            Claims appear here when they are recorded by the future member workflow. HOD purchasing
            actions do not create claims.
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
