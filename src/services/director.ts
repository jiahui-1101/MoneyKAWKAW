import type { ActivityInput, DepartmentInput, Settings, Store } from '../domain/models';
import { validateActivity, validateDepartment } from '../domain/budget';
import { seed } from './seed';
import { upgradeSharedStore, validatePurchasingData } from './shared-migration';
import { requireRole } from '../domain/session';
import { upgradeTreasury } from './treasury-migration';
import { validateTreasury } from './treasury-validation';
import { validateMemberData } from './member-validation';

export const STORAGE_KEY = 'moneykawkaw.director.v1';
const copy = <T>(value: T): T => structuredClone(value);

export function validateStore(value: unknown): asserts value is Store {
  const s = value as Store;
  if (
    !s ||
    s.version !== 1 ||
    !['activities', 'expenses', 'payments', 'assignments', 'events'].every((k) =>
      Array.isArray(s[k as keyof Store]),
    )
  )
    throw new Error('Unrecognized local data format.');
  if (
    !s.settings ||
    !['MYR', 'SGD', 'USD'].includes(s.settings.currency) ||
    !Number.isFinite(s.settings.warningPercent) ||
    s.settings.warningPercent < 1 ||
    s.settings.warningPercent > 100
  )
    throw new Error('Invalid workspace settings.');
  new Intl.DateTimeFormat('en', { timeZone: s.settings.timezone });
  const unique = (items: { id: string }[]) =>
    items.every((x) => typeof x.id === 'string' && x.id.length > 0) &&
    new Set(items.map((x) => x.id)).size === items.length;
  for (const list of [s.activities, s.expenses, s.payments, s.assignments, s.events])
    if (!unique(list)) throw new Error('Duplicate or missing record identifiers.');
  for (const a of s.activities) {
    if (!Array.isArray(a.departments) || !unique(a.departments))
      throw new Error('Invalid department records.');
    validateActivity(
      a,
      a.departments.reduce((sum, d) => sum + d.allocation, 0),
    );
    for (const d of a.departments)
      validateDepartment(
        d,
        a.budget,
        0,
        a.departments.some(
          (other) => other.id !== d.id && other.name.toLowerCase() === d.name.toLowerCase(),
        ),
      );
  }
  const linked = (r: { activityId: string; departmentId: string }) =>
    s.activities.some(
      (a) => a.id === r.activityId && a.departments.some((d) => d.id === r.departmentId),
    );
  const amount = (n: number) => Number.isSafeInteger(n) && n >= 0;
  for (const e of s.expenses)
    if (
      !linked(e) ||
      !amount(e.amount) ||
      !['Pending review', 'In review', 'Approved', 'Declined'].includes(e.state) ||
      typeof e.description !== 'string' ||
      Number.isNaN(Date.parse(e.date))
    )
      throw new Error('Invalid expense record.');
  for (const a of s.assignments)
    if (
      !linked(a) ||
      !amount(a.budget) ||
      (a.expenseId &&
        !s.expenses.some(
          (e) =>
            e.id === a.expenseId &&
            e.activityId === a.activityId &&
            e.departmentId === a.departmentId,
        ))
    )
      throw new Error('Invalid assignment record.');
  for (const p of s.payments)
    if (
      !amount(p.amount) ||
      !s.expenses.some(
        (e) =>
          e.id === p.expenseId &&
          e.state === 'Approved' &&
          s.payments.filter((x) => x.expenseId === e.id).reduce((sum, x) => sum + x.amount, 0) <=
            e.amount,
      )
    )
      throw new Error('Invalid payment record.');
  for (const e of s.events)
    if (
      !s.activities.some((a) => a.id === e.activityId) ||
      ![e.action, e.detail, e.actor].every((x) => typeof x === 'string') ||
      Number.isNaN(Date.parse(e.at))
    )
      throw new Error('Invalid activity history.');
  if (s.directory) validatePurchasingData(s);
  validateTreasury(s);
  validateMemberData(s);
}

// Replace this adapter with authenticated APIs later. No authentication is simulated.
export interface DirectorService {
  load(): Promise<Store>;
  save(store: Store): Promise<Store>;
  reset(): Promise<Store>;
}
// Storage adapter is internal infrastructure. Role-facing services enforce access before using it.
export const sharedRepository: DirectorService = {
  async load() {
    await new Promise((resolve) => setTimeout(resolve, 180));
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return copy(seed);
    try {
      const data: unknown = upgradeTreasury(upgradeSharedStore(JSON.parse(raw)));
      validateStore(data);
      return data;
    } catch {
      throw new Error(
        'Saved demo data could not be read. Retry, or reset the demo to restore sample records.',
      );
    }
  },
  async save(store) {
    const ready = upgradeTreasury(upgradeSharedStore(store));
    validateStore(ready);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ready));
    } catch {
      throw new Error('Changes could not be saved. Browser storage may be full or unavailable.');
    }
    return copy(ready);
  },
  async reset() {
    localStorage.removeItem(STORAGE_KEY);
    return copy(seed);
  },
};
export const directorService: DirectorService = {
  async load() {
    requireRole('Director');
    const store = await sharedRepository.load();
    requireRole('Director');
    return {
      ...store,
      member: undefined,
      events: store.events.map((e) =>
        [
          'Manual reimbursement recorded',
          'Payout destination changed',
          'Payment discrepancy reported',
        ].includes(e.action)
          ? {
              ...e,
              detail:
                'A private payment-detail event was recorded. Financial amounts and status remain visible; payment references, destination instructions, and discrepancy details are restricted to the claimant and authorized Treasurer.',
            }
          : e,
      ),
      payments: store.payments.map(({ manual: _manual, ...p }) => p),
      treasury: store.treasury ? { ...store.treasury, receipts: [], payouts: [] } : undefined,
    };
  },
  async save(store) {
    requireRole('Director');
    const fresh = await sharedRepository.load();
    requireRole('Director');
    const events = [
      ...store.events.filter((e) => !fresh.events.some((f) => f.id === e.id)),
      ...fresh.events,
    ];
    await sharedRepository.save({
      ...store,
      events,
      member: fresh.member,
      expenses: fresh.expenses,
      payments: fresh.payments,
      assignments: fresh.assignments,
      treasury: fresh.treasury
        ? { ...fresh.treasury, grants: store.treasury?.grants ?? fresh.treasury.grants }
        : undefined,
    });
    return directorService.load();
  },
  async reset() {
    requireRole('Director');
    await sharedRepository.reset();
    return directorService.load();
  },
};

function event(store: Store, activityId: string, action: string, detail: string) {
  store.events.unshift({
    id: crypto.randomUUID(),
    activityId,
    action,
    detail,
    actor: 'Director · demo',
    at: new Date().toISOString(),
  });
}
export function upsertActivity(current: Store, input: ActivityInput, id?: string): Store {
  const store = copy(current);
  const existing = store.activities.find((a) => a.id === id);
  if (id && !existing) throw new Error('This activity no longer exists.');
  validateActivity(
    input,
    existing?.departments.reduce((s, d) => s + d.allocation, 0),
  );
  const clean = { ...input, name: input.name.trim(), description: input.description.trim() };
  if (existing) {
    const before = `${existing.name}; budget ${(existing.budget / 100).toFixed(2)}; ${existing.status}; ${existing.startDate} to ${existing.endDate}; ${existing.type}; ${existing.description}`;
    Object.assign(existing, clean);
    event(
      store,
      existing.id,
      'Activity updated',
      `Before: ${before}. After: ${clean.name}; budget ${(clean.budget / 100).toFixed(2)}; ${clean.status}; ${clean.startDate} to ${clean.endDate}; ${clean.type}; ${clean.description}`,
    );
  } else {
    const activity = { ...clean, id: crypto.randomUUID(), departments: [] };
    store.activities.unshift(activity);
    event(
      store,
      activity.id,
      'Activity created',
      `${activity.name} · budget ${(activity.budget / 100).toFixed(2)}`,
    );
  }
  return store;
}
export function upsertDepartment(
  current: Store,
  activityId: string,
  input: DepartmentInput,
  id?: string,
): Store {
  const store = copy(current);
  const activity = store.activities.find((a) => a.id === activityId);
  if (!activity) throw new Error('Activity not found.');
  const existing = activity.departments.find((d) => d.id === id);
  if (id && !existing) throw new Error('Department not found.');
  const others = activity.departments.filter((d) => d.id !== id);
  validateDepartment(
    input,
    activity.budget,
    others.reduce((s, d) => s + d.allocation, 0),
    others.some((d) => d.name.toLowerCase() === input.name.trim().toLowerCase()),
  );
  const clean = {
    ...input,
    name: input.name.trim(),
    description: input.description.trim(),
    head: input.head.trim(),
  };
  const before = existing ? JSON.stringify(existing) : 'None';
  if (existing) Object.assign(existing, clean);
  else activity.departments.push({ ...clean, id: crypto.randomUUID() });
  event(
    store,
    activityId,
    existing ? 'Department updated' : 'Department created',
    `${clean.name} · before: ${before} · after: ${JSON.stringify(clean)}`,
  );
  return store;
}
export function removeDepartment(current: Store, activityId: string, id: string): Store {
  const store = copy(current);
  const a = store.activities.find((a) => a.id === activityId);
  const d = a?.departments.find((d) => d.id === id);
  if (!a || !d) throw new Error('Department not found.');
  if (
    store.expenses.some((e) => e.departmentId === id) ||
    store.assignments.some((e) => e.departmentId === id)
  )
    throw new Error('Departments with expense or assignment records cannot be removed.');
  a.departments = a.departments.filter((d) => d.id !== id);
  if (store.directory)
    store.directory.memberships = store.directory.memberships.filter(
      (m) => m.activityId !== activityId || m.departmentId !== id,
    );
  event(
    store,
    activityId,
    'Department removed',
    `${d.name} · previous allocation ${(d.allocation / 100).toFixed(2)}`,
  );
  return store;
}
export function updateSettings(current: Store, settings: Settings): Store {
  if (
    !Number.isFinite(settings.warningPercent) ||
    settings.warningPercent < 1 ||
    settings.warningPercent > 100
  )
    throw new Error('Choose a utilization attention threshold between 1 and 100.');
  // Do not relabel existing amounts with another currency: currency is configured at workspace creation.
  if (settings.currency !== current.settings.currency)
    throw new Error('Currency conversion requires a future API migration.');
  const store = { ...copy(current), settings };
  validateStore(store);
  return store;
}
