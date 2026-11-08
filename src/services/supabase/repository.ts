import type { Activity, Department, Membership, Store } from '../../domain/models';
import type { Role, SessionProfile } from '../../domain/access';
import { getDemoActor } from '../../domain/session';
import { supabaseClient } from './client';

export interface WorkspaceRepository {
  load(): Promise<Store>;
  save(store: Store): Promise<Store>;
  reset(): Promise<Store>;
}
const disabled = async (): Promise<Store> => {
  throw new Error('Financial changes are not enabled in Supabase yet. No changes were saved.');
};
function fail(): never { throw new Error('Club workspace data could not be loaded. Check your connection and retry.'); }

export const supabaseRepository: WorkspaceRepository = {
  async load() {
    const actor = getDemoActor(), client = supabaseClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user || user.id !== actor.userId) throw new Error('Sign in again to refresh club access.');
    const { data: sessionData, error: sessionError } = await client.rpc('current_club_session');
    if (sessionError || !sessionData || typeof sessionData !== 'object') fail();
    const session = sessionData as unknown as SessionProfile;
    if (session.uid !== actor.userId || !session.roles.includes(actor.role as Role))
      throw new Error('Your club role or membership changed. Refresh to continue.');

    const results = await Promise.all([
      client.from('clubs').select('id,name,currency,timezone,warning_percent').eq('slug', 'main').maybeSingle(),
      client.from('activities').select('id,club_id,name,description,type,status,start_date,end_date,budget_sen,currency').order('start_date'),
      client.from('departments').select('id,club_id,activity_id,name,description,head_label,allocation_sen').order('name'),
      client.from('department_memberships').select('user_id,activity_id,department_id,role,status'),
      client.from('profiles').select('user_id,display_name'),
    ]);
    if (results.some(({ error }) => error)) fail();
    const [clubResult, activityResult, departmentResult, membershipResult, profileResult] = results;
    if (!clubResult.data || !activityResult.data || !departmentResult.data || !membershipResult.data || !profileResult.data) fail();
    const memberships = membershipResult.data.map((row): Membership => ({
      userId: row.user_id, activityId: row.activity_id, departmentId: row.department_id,
      role: row.role, active: row.status === 'active',
    }));
    const departments: Department[] = departmentResult.data.map((row) => ({
      id: row.id, name: row.name, description: row.description, head: row.head_label,
      allocation: Number(row.allocation_sen),
      hodUserId: memberships.find((m) => m.departmentId === row.id && m.role === 'HOD' && m.active)?.userId,
    }));
    const departmentActivities = new Map<string, Department[]>();
    for (const row of departmentResult.data) {
      const group = departmentActivities.get(row.activity_id) ?? [];
      const department = departments.find((value) => value.id === row.id);
      if (department) group.push(department);
      departmentActivities.set(row.activity_id, group);
    }
    const activities: Activity[] = activityResult.data.map((row) => ({
      id: row.id, name: row.name, description: row.description, type: row.type, status: row.status,
      startDate: row.start_date, endDate: row.end_date, budget: Number(row.budget_sen),
      departments: departmentActivities.get(row.id) ?? [],
    }));
    if (activities.some((activity) => !Number.isSafeInteger(activity.budget) || activity.budget < 0) ||
        departments.some((department) => !Number.isSafeInteger(department.allocation) || department.allocation < 0)) fail();
    if (session.uid !== getDemoActor().userId || !session.roles.includes(getDemoActor().role as Role))
      throw new Error('Your club role or membership changed. Refresh to continue.');
    return {
      version: 1, activities, expenses: [], payments: [], assignments: [], events: [],
      settings: { currency: clubResult.data.currency, timezone: clubResult.data.timezone, warningPercent: clubResult.data.warning_percent },
      directory: { users: profileResult.data.map((profile) => ({ id: profile.user_id, name: profile.display_name })), memberships },
    };
  },
  save: disabled,
  reset: disabled,
};
