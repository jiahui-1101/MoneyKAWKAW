import type { Activity, Assignment, AuditEvent, Department, Membership, Store } from '../../domain/models';
import type { Role, SessionProfile } from '../../domain/access';
import { getDemoActor } from '../../domain/session';
import { supabaseClient } from './client';
import { listAccounts } from './member-accounts';

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
      client.from('purchase_tasks').select('id,club_id,activity_id,department_id,item_name,description,assigned_member_id,created_by_hod,estimated_budget_sen,due_date,priority,status,updated_at'),
      client.from('claims').select('*').order('updated_at', { ascending: false }),
      client.from('audit_events').select('id,actor_uid,action,record_type,record_id,activity_id,department_id,changes,created_at').order('created_at', { ascending: false }).limit(250),
    ]);
    if (results.some(({ error }) => error)) fail();
    const [clubResult, activityResult, departmentResult, membershipResult, profileResult, taskResult, claimResult, eventResult] = results;
    if (!clubResult.data || !activityResult.data || !departmentResult.data || !membershipResult.data || !profileResult.data || !taskResult.data || !claimResult.data || !eventResult.data) fail();
    const claims = claimResult.data;
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
    const assignments: Assignment[] = taskResult.data.map((row) => {
      const claim = claims.find((entry) => entry.purchase_task_id === row.id && entry.status === 'Pending');
      return {
      id: row.id,
      activityId: row.activity_id,
      departmentId: row.department_id,
      expenseId: claim?.id,
      budget: Number(row.estimated_budget_sen),
      purchasing: {
        name: row.item_name,
        description: row.description,
        assigneeId: row.assigned_member_id,
        dueDate: row.due_date,
        priority: row.priority,
        status: claim ? 'Claim Submitted' : row.status,
        createdBy: row.created_by_hod,
        updatedAt: row.updated_at,
      },
      };
    });
    const profileNames = new Map(profileResult.data.map((profile) => [profile.user_id, profile.display_name]));
    const events: AuditEvent[] = eventResult.data.flatMap((row) => {
      if (!row.activity_id) return [];
      return [{
        id: row.id,
        activityId: row.activity_id,
        departmentId: row.department_id ?? undefined,
        assignmentId: row.record_type === 'purchasing_task' ? row.record_id :
          row.record_type === 'claim' ? claims.find((claim) => claim.id === row.record_id)?.purchase_task_id : undefined,
        action: row.action,
        detail: JSON.stringify(row.changes),
        actor: profileNames.get(row.actor_uid) ?? `Club member · ${row.actor_uid}`,
        at: row.created_at,
      }];
    });
    if (activities.some((activity) => !Number.isSafeInteger(activity.budget) || activity.budget < 0) ||
        departments.some((department) => !Number.isSafeInteger(department.allocation) || department.allocation < 0) ||
        assignments.some((task) => !Number.isSafeInteger(task.budget) || task.budget < 0)) fail();
    if (session.uid !== getDemoActor().userId || !session.roles.includes(getDemoActor().role as Role))
      throw new Error('Your club role or membership changed. Refresh to continue.');
    const expenses = claims.filter((claim) => claim.status === 'Pending').map((claim) => ({
      id: claim.id, activityId: claim.activity_id, departmentId: claim.department_id,
      description: taskResult.data.find((task) => task.id === claim.purchase_task_id)?.item_name ?? 'Purchase claim',
      amount: Number(claim.claimed_amount_sen ?? 0), date: (claim.submitted_at ?? claim.created_at).slice(0,10),
      state: 'Pending review' as const,
      review: { claimantId: claim.claimant_user_id, submittedAt: claim.submitted_at ?? claim.created_at,
        updatedAt: claim.updated_at, justification: claim.over_budget_justification },
    }));
    const accountRows = getDemoActor().role === 'Member' ? await listAccounts() : [];
    const accountData = accountRows.map((account) => ({ ...account, identifier: '' }));
    return {
      version: 1, claimAccounting: 'task-reservation', activities, expenses, payments: [], assignments, events,
      settings: { currency: clubResult.data.currency, timezone: clubResult.data.timezone, warningPercent: clubResult.data.warning_percent },
      directory: { users: profileResult.data.map((profile) => ({ id: profile.user_id, name: profile.display_name })), memberships },
      treasury: {
        grants: activities.map((activity) => ({ userId: session.uid, activityId: activity.id })),
        receipts: [], payouts: [], rules: { mediumVariance: 10, highVariance: 25, lowHeadroomPercent: 20 },
      },
      member: getDemoActor().role === 'Member' ? {
        accounts: accountData,
        drafts: claims.filter((claim) => claim.status === 'Draft').map((claim) => ({
          id: claim.id, ownerId: claim.claimant_user_id, taskId: claim.purchase_task_id,
          accountId: claim.draft_payment_account_id ?? '', justification: claim.over_budget_justification,
          updatedAt: claim.updated_at,
        })),
        readNotifications: [],
      } : undefined,
    };
  },
  save: disabled,
  reset: disabled,
};
