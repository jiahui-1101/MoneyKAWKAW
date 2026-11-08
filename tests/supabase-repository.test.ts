import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ client: null as unknown, actor: { userId: 'member-a', name: 'A Member', role: 'Member' } }));
vi.mock('../src/services/supabase/client', () => ({ supabaseClient: () => mocks.client }));
vi.mock('../src/domain/session', () => ({ getDemoActor: () => mocks.actor }));
import { supabaseRepository } from '../src/services/supabase/repository';

const profile = { uid: 'member-a', name: 'A Member', active: true, roles: ['Member'], revision: 0,
  clubName: 'Synthetic Club', departmentScopes: [], activityIds: ['activity-a'] };
const activity = { id: 'activity-a', club_id: 'club-a', name: 'Showcase', description: 'Sample',
  type: 'Workshop', status: 'Active', start_date: '2026-01-01', end_date: '2026-12-31', budget_sen: 100000 };
const department = { id: 'department-a', club_id: 'club-a', activity_id: 'activity-a', name: 'Multimedia',
  description: '', head_label: 'Noor HOD', allocation_sen: 70000 };
let errors: string[];
beforeEach(() => {
  errors = [];
  const data: Record<string, unknown> = {
    clubs: { id: 'club-a', name: 'Synthetic Club', currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', warning_percent: 80 },
    activities: [activity], departments: [department],
    department_memberships: [{ user_id: 'member-a', activity_id: 'activity-a', department_id: 'department-a', role: 'Member', status: 'active' }],
    profiles: [{ user_id: 'member-a', display_name: 'A Member' }],
    purchase_tasks: [], audit_events: [],
  };
  mocks.client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'member-a' } }, error: null }) },
    rpc: vi.fn((name: string) => Promise.resolve({ data: name === 'current_club_session' ? profile : true, error: null })),
    from: vi.fn((table: string) => {
      const query = {
        select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
        maybeSingle: async () => ({ data: data[table], error: null }),
        update() { return this; },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve({ data: errors.includes(table) ? null : data[table], error: errors.includes(table) ? new Error('denied') : null }).then(resolve, reject),
      };
      return query;
    }),
  };
});

it('projects scoped Supabase rows into the unchanged shared Store contract', async () => {
  const store = await supabaseRepository.load();
  expect(store.activities[0]).toMatchObject({ id: 'activity-a', budget: 100000 });
  expect(store.activities[0].departments[0]).toMatchObject({ id: 'department-a', allocation: 70000 });
  expect(store.directory?.memberships[0]).toMatchObject({ userId: 'member-a', role: 'Member', active: true });
  expect(store.expenses).toEqual([]);
  expect(store.payments).toEqual([]);
});

it('never falls back to browser data on a Supabase request error', async () => {
  errors = ['activities'];
  await expect(supabaseRepository.load()).rejects.toThrow('could not be loaded');
  await expect(supabaseRepository.save({} as never)).rejects.toThrow('No changes were saved');
});
