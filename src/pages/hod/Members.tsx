import { ArrowUpRight, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { eligibleMembers } from '../../domain/hod';
import { useDepartmentScope } from '../../components/hod/HodWidgets';
import { Badge, Empty, PageHeader, Panel, Progress, useFormat } from '../../components/ui';

export function HodMembers() {
  const { data, scope, tasks, base } = useDepartmentScope();
  const { money } = useFormat();
  const [query, setQuery] = useState('');
  const members = eligibleMembers(data, scope.activity.id, scope.department.id).filter((u) =>
    u.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="stack">
      <PageHeader
        eyebrow={`${scope.department.name.toUpperCase()} · PEOPLE & RESPONSIBILITIES`}
        title="A shared purpose. Clear ownership."
        description="See your department’s eligible members, responsibilities, and purchasing workload."
      />
      <Panel
        title="Your department members"
        subtitle="Membership is assigned by the Director. HODs assign purchasing work within this roster."
        action={<span className="count-label">{members.length} eligible people</span>}
      >
        <div className="filters">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search department members"
              placeholder="Search your department’s members…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="hod-member-grid">
          {members.map((member) => {
            const assigned = tasks.filter(
              (t) => t.purchasing!.assigneeId === member.id && t.purchasing!.status !== 'Cancelled',
            );
            const open = assigned.filter((t) =>
              ['Not Started', 'In Progress', 'Purchased'].includes(t.purchasing!.status),
            ).length;
            const completed = assigned.filter((t) => t.purchasing!.status === 'Completed').length;
            const hod = data.directory.memberships.some(
              (m) =>
                m.active &&
                m.userId === member.id &&
                m.activityId === scope.activity.id &&
                m.departmentId === scope.department.id &&
                m.role === 'HOD',
            );
            return (
              <article className="hod-member-card" key={member.id}>
                <div className="row between">
                  <span className="member-avatar">
                    {member.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  <Badge tone={hod ? 'brand' : 'neutral'}>{hod ? 'HOD' : 'Committee member'}</Badge>
                </div>
                <h2>{member.name}</h2>
                <p>
                  {scope.department.name} · {scope.activity.name}
                </p>
                <div className="member-workload">
                  <div>
                    <strong>{assigned.length}</strong>
                    <small>Total tasks</small>
                  </div>
                  <div>
                    <strong>{open}</strong>
                    <small>Open purchases</small>
                  </div>
                  <div>
                    <strong>{completed}</strong>
                    <small>Completed</small>
                  </div>
                </div>
                <Progress
                  value={assigned.length ? (completed / assigned.length) * 100 : 0}
                  label={`${member.name} purchase completion`}
                  tone="green"
                />
                <div className="row between member-plan-total">
                  <span>Assigned item budgets</span>
                  <strong className="money">
                    {money(assigned.reduce((sum, t) => sum + t.budget, 0))}
                  </strong>
                </div>
                <Link className="btn" to={`${base}/tasks?member=${member.id}`}>
                  View purchasing responsibilities <ArrowUpRight size={14} />
                </Link>
              </article>
            );
          })}
        </div>
        {!members.length && (
          <Empty
            title={query ? 'No matching members' : 'No eligible members yet'}
            action={
              query ? (
                <button className="btn" onClick={() => setQuery('')}>
                  Clear search
                </button>
              ) : undefined
            }
          >
            {query
              ? 'Try another name.'
              : 'Ask the Director to assign committee members to this department.'}
          </Empty>
        )}
      </Panel>
      <div className="budget-pulse">
        <div className="row">
          <span className="pulse-icon">
            <Users size={21} />
          </span>
          <div>
            <h2>One department. A fair share of the work.</h2>
            <p>
              {
                tasks.filter(
                  (t) => !t.purchasing!.assigneeId && t.purchasing!.status !== 'Cancelled',
                ).length
              }{' '}
              purchasing tasks are currently unassigned.
            </p>
          </div>
        </div>
        <Link className="btn" to={`${base}/tasks?attention=unassigned`}>
          Review unassigned tasks
        </Link>
      </div>
    </div>
  );
}
