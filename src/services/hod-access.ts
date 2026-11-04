import type { Store } from '../domain/models';
import type { HodSnapshot } from '../domain/hod';
import { requireRole } from '../domain/session';

export function assertHodScope(store: Store, activityId: string, departmentId: string) {
  const actor = requireRole('HOD');
  const allowed = store.directory?.memberships.some(m => m.active && m.role === 'HOD' && m.userId === actor.userId && m.activityId === activityId && m.departmentId === departmentId);
  const department = store.activities.find(a => a.id === activityId)?.departments.find(d => d.id === departmentId && d.hodUserId === actor.userId);
  if (!allowed || !department) throw new Error('You do not have access to this department.');
  return actor;
}
export function projectHod(store: Store): HodSnapshot {
  const actor = requireRole('HOD');
  const grants = store.directory?.memberships.filter(m => m.active && m.role === 'HOD' && m.userId === actor.userId) ?? [];
  const allowed = (activityId: string, departmentId: string) => grants.some(m => m.activityId === activityId && m.departmentId === departmentId);
  const scopes = store.activities.flatMap(a => a.departments.filter(d => allowed(a.id, d.id) && d.hodUserId === actor.userId).map(d => ({
    activity: { id: a.id, name: a.name, startDate: a.startDate, endDate: a.endDate, status: a.status }, department: structuredClone(d),
  })));
  const inScope = (activityId: string, departmentId: string) => scopes.some(s => s.activity.id === activityId && s.department.id === departmentId);
  const expenses = store.expenses.filter(e => inScope(e.activityId, e.departmentId)).map(e => ({ id: e.id, activityId: e.activityId, departmentId: e.departmentId, description: e.description, amount: e.amount, date: e.date, state: e.state }));
  const memberships = store.directory?.memberships.filter(m => inScope(m.activityId, m.departmentId)) ?? [];
  return structuredClone({ actor, scopes, assignments: store.assignments.filter(t => inScope(t.activityId, t.departmentId)), expenses,
    payments: store.payments.filter(p => expenses.some(e => e.id === p.expenseId)).map(p => ({ id: p.id, expenseId: p.expenseId, amount: p.amount, date: p.date })),
    directory: { users: store.directory?.users.filter(u => memberships.some(m => m.userId === u.id)) ?? [], memberships },
    events: store.events.filter(e => e.departmentId && inScope(e.activityId, e.departmentId)), settings: store.settings });
}
