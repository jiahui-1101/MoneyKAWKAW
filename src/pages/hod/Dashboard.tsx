import { ArrowUpRight, CalendarDays, Plus, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { departmentToday, isOverdue, scopePath } from '../../domain/hod';
import { Badge, PageHeader, Panel, Progress, TextLink, useFormat } from '../../components/ui';
import {
  DepartmentActivity,
  DepartmentBalances,
  DepartmentMetrics,
  ProcurementFlow,
  TaskTable,
  UpcomingPurchases,
  useDepartmentScope,
} from '../../components/hod/HodWidgets';

export function HodDashboard({ department = false }: { department?: boolean }) {
  const { data, scope, tasks, base, summary } = useDepartmentScope();
  const { money, date } = useFormat();
  const today = departmentToday(data.settings.timezone);
  const counts = [
    ['Total purchasing tasks', tasks.length, ''],
    [
      'Pending tasks',
      tasks.filter((t) => ['Not Started', 'In Progress'].includes(t.purchasing!.status)).length,
      'attention=pending',
    ],
    [
      'Completed purchases',
      tasks.filter((t) => t.purchasing!.status === 'Completed').length,
      'status=Completed',
    ],
    ['Overdue purchases', tasks.filter((t) => isOverdue(t, today)).length, 'attention=overdue'],
    [
      'Unassigned tasks',
      tasks.filter((t) => !t.purchasing!.assigneeId && t.purchasing!.status !== 'Cancelled').length,
      'attention=unassigned',
    ],
    [
      'Purchased · no claim',
      tasks.filter((t) => t.purchasing!.status === 'Purchased' && !t.expenseId).length,
      'attention=awaiting-claim',
    ],
  ] as const;
  return (
    <div className="stack hod-dashboard">
      <PageHeader
        eyebrow={`${scope.department.name.toUpperCase()} · HOD WORKSPACE`}
        title={department ? scope.department.name : 'A clear plan. A confident team.'}
        description={
          department
            ? `${scope.activity.name} · Department overview`
            : 'Keep your team’s responsibilities, purchases, and budget moving together.'
        }
      >
        <Link className="btn primary" to={`${base}/tasks/new`}>
          <Plus size={16} />
          Create purchasing task
        </Link>
      </PageHeader>
      {!department && (
        <div className="assigned-activities">
          <div className="assigned-count">
            <small>ASSIGNED ACTIVITIES</small>
            <strong>
              {new Set(data.scopes.map((s) => s.activity.id)).size.toString().padStart(2, '0')}
            </strong>
            <span>Explicit department memberships</span>
          </div>
          {data.scopes.map((s) => (
            <Link
              className={`scope-tile ${s.department.id === scope.department.id ? 'current' : ''}`}
              key={`${s.activity.id}-${s.department.id}`}
              to={scopePath(s.activity.id, s.department.id)}
            >
              <span className="eyebrow">{s.department.name}</span>
              <strong>{s.activity.name}</strong>
              <small>
                <CalendarDays size={12} />
                {date(s.activity.startDate)}
              </small>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      )}
      {department && (
        <Panel
          title="Your department, in context"
          action={<TextLink to={`${base}/members`}>Meet the team</TextLink>}
        >
          <div className="panel-body">
            <p className="activity-description">
              {scope.department.description ||
                'This department is ready for a clear purchasing plan.'}
            </p>
            <div className="activity-setup-note">
              <span>HOD: {data.actor.name} · Allocation set by the Director</span>
              <span>
                {date(scope.activity.startDate)} — {date(scope.activity.endDate)}
              </span>
            </div>
          </div>
        </Panel>
      )}
      <DepartmentMetrics data={data} scope={scope} />
      <div className="budget-pulse">
        <div className="row">
          <span className="pulse-icon">
            <ShieldCheck size={21} />
          </span>
          <div>
            <h2>
              {scope.activity.name} · {scope.department.name}
            </h2>
            <p>
              {money(summary.remaining)} remaining after recorded expenses · {money(summary.open)}{' '}
              reserved for unclaimed purchases
            </p>
          </div>
        </div>
        <div className="pulse-progress">
          <div className="row between">
            <span>Budget utilization</span>
            <strong>{summary.utilization.toFixed(1)}%</strong>
          </div>
          <Progress
            value={summary.utilization}
            label="Department budget utilization"
            tone={
              summary.recorded > summary.budget
                ? 'danger'
                : summary.utilization >= data.settings.warningPercent
                  ? 'gold'
                  : 'green'
            }
          />
        </div>
      </div>
      {(summary.available < 0 || summary.planned > summary.budget) && (
        <div className="form-error" role="status">
          Department budget attention:{' '}
          {summary.available < 0
            ? `${money(-summary.available)} beyond available allocation after claims and commitments.`
            : `Planned estimates exceed the allocation by ${money(summary.planned - summary.budget)}.`}{' '}
          Review outstanding plans. Claim decisions remain with the Treasurer.
        </div>
      )}
      <div className="task-counts">
        {counts.map(([label, value, query]) => (
          <Link to={`${base}/tasks${query ? `?${query}` : ''}`} key={label}>
            <span>{label}</span>
            <strong>{value.toString().padStart(2, '0')}</strong>
            <ArrowUpRight size={13} />
          </Link>
        ))}
      </div>
      <ProcurementFlow tasks={tasks} base={base} />
      <DepartmentBalances data={data} scope={scope} />
      <div className="hod-two-columns">
        <Panel
          title="Department expense overview"
          subtitle="Actual financial records, separate from purchasing estimates"
          action={<Badge tone="neutral">Sample records</Badge>}
        >
          <div className="expense-overview">
            {[
              ['Pending review', summary.pending, 'gold'],
              ['Approved · not paid', summary.recorded - summary.pending - summary.paid, 'violet'],
              ['Paid reimbursements', summary.paid, 'green'],
              ['Unclaimed purchase plans', summary.open, 'brand'],
            ].map(([label, value, tone]) => (
              <div key={label}>
                <div className="row between">
                  <span>{label}</span>
                  <strong className="money">{money(Number(value))}</strong>
                </div>
                <Progress
                  value={summary.budget ? (Number(value) / summary.budget) * 100 : 0}
                  label={`${label} share of allocation`}
                  tone={String(tone)}
                />
              </div>
            ))}
          </div>
        </Panel>
        <UpcomingPurchases tasks={tasks} data={data} base={base} />
      </div>
      <Panel
        title="Purchasing responsibilities"
        subtitle="A quick view of your department’s latest plans"
        action={<TextLink to={`${base}/tasks`}>All purchasing tasks</TextLink>}
      >
        <TaskTable tasks={tasks.slice(0, 5)} data={data} />
      </Panel>
      <DepartmentActivity data={data} scope={scope} />
    </div>
  );
}
