import { summarize } from './budget';
import { isPending } from './claim-balances';
import type { Expense, Store } from './models';
import type { RiskResult, RiskRules } from './treasury';
export { receiptLines } from './receipt';

export function validateRiskRules(r: RiskRules) {
  if (
    ![r.mediumVariance, r.highVariance, r.lowHeadroomPercent].every(Number.isFinite) ||
    r.mediumVariance < 1 ||
    r.highVariance <= r.mediumVariance ||
    r.highVariance > 1000 ||
    r.lowHeadroomPercent < 1 ||
    r.lowHeadroomPercent > 100
  )
    throw new Error('Use increasing variance thresholds (1–1,000%) and headroom between 1–100%.');
}
export function claimContext(store: Store, claim: Expense) {
  const task = store.assignments.find((t) => t.expenseId === claim.id);
  const activity = store.activities.find((a) => a.id === claim.activityId)!;
  const department = activity.departments.find((d) => d.id === claim.departmentId)!;
  const variance = claim.amount - (task?.budget ?? claim.amount);
  return {
    task,
    activity,
    department,
    variance,
    variancePercent: task?.budget ? (variance / task.budget) * 100 : variance > 0 ? 100 : 0,
  };
}
export function analyzeClaim(store: Store, claim: Expense, actor: string): RiskResult {
  const rules = store.treasury!.rules;
  validateRiskRules(rules);
  const { department, variance, variancePercent } = claimContext(store, claim);
  const dep = summarize(store, claim.activityId, claim.departmentId);
  const activity = summarize(store, claim.activityId);
  const other = store.expenses
    .filter((e) => e.id !== claim.id && e.activityId === claim.activityId && isPending(e))
    .reduce((s, e) => s + e.amount, 0);
  const amount = (n: number) => `${store.settings.currency} ${(n / 100).toFixed(2)}`;
  const factors: RiskResult['factors'] = [
    {
      label: 'Item budget variance',
      detail: `${variancePercent.toFixed(2)}% variance. Medium ≥ ${rules.mediumVariance}%; high ≥ ${rules.highVariance}%.`,
      level:
        variancePercent >= rules.highVariance
          ? 'High'
          : variancePercent >= rules.mediumVariance
            ? 'Medium'
            : 'Low',
    },
    {
      label: 'Department headroom',
      detail: `${amount(dep.available)} after recorded claims and open task reservations.`,
      level:
        dep.available < 0
          ? 'High'
          : dep.available <= (department.allocation * rules.lowHeadroomPercent) / 100
            ? 'Medium'
            : 'Low',
    },
    {
      label: 'Activity headroom',
      detail: `${amount(activity.available)} after all recorded claims and open reservations.`,
      level:
        activity.available < 0
          ? 'High'
          : activity.available <= (activity.budget * rules.lowHeadroomPercent) / 100
            ? 'Medium'
            : 'Low',
    },
    {
      label: 'Existing commitments',
      detail: `Other pending claims: ${amount(other)}; approved unpaid and open tasks: ${amount(activity.committed)}. Included once in balances.`,
      level: activity.available < 0 ? 'High' : 'Low',
    },
  ];
  const band = factors.some((f) => f.level === 'High')
    ? 'High'
    : factors.some((f) => f.level === 'Medium')
      ? 'Medium'
      : 'Low';
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor,
    band,
    factors,
    rules: structuredClone(rules),
    variance,
    variancePercent,
    departmentAvailable: dep.available,
    activityAvailable: activity.available,
    pendingOther: other,
  };
}
export function paymentState(store: Store, claim: Expense) {
  if (claim.state !== 'Approved') return 'Not payable';
  const payments = store.payments.filter((p) => p.expenseId === claim.id);
  if (!payments.length) return 'Payment pending';
  if (payments.some((p) => p.manual?.receivedConfirmedAt)) return 'Received confirmed';
  return 'Recorded · awaiting member';
}
