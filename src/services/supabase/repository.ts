import type { Activity, Assignment, AuditEvent, Department, Membership, Store } from '../../domain/models';
import type { Expense, Payment, FinancialSummary } from '../../domain/models';
import type { RiskResult } from '../../domain/treasury';
import type { Database } from './database.types';
import { safeProofMetadata } from './payment-proof';
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
      client.rpc('financial_summaries'),
      client.from('reimbursement_payments').select('*'),
      client.from('payment_proofs').select('*').eq('upload_status', 'retained'),
      client.from('financial_notifications').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    if (results.some(({ error }) => error)) fail();
    const [clubResult, activityResult, departmentResult, membershipResult, profileResult, taskResult, claimResult, eventResult] = results;
    if (!clubResult.data || !activityResult.data || !departmentResult.data || !membershipResult.data || !profileResult.data || !taskResult.data || !claimResult.data || !eventResult.data) fail();
    const claims = claimResult.data;
    const [summaryResult, paymentResult, proofResult, notificationResult] = results.slice(8);
    const notificationRows = notificationResult.data as unknown as Database['public']['Tables']['financial_notifications']['Row'][];
    const financialSummaries = summaryResult.data as unknown as FinancialSummary[];
    const paymentRows = paymentResult.data as unknown as Database['public']['Tables']['reimbursement_payments']['Row'][];
    const proofRows = proofResult.data as unknown as Database['public']['Tables']['payment_proofs']['Row'][];
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
      const claim = claims.find((entry) => entry.purchase_task_id === row.id && entry.status !== 'Draft');
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
    const expenses: Expense[] = claims.filter((claim) => claim.status !== 'Draft').map((claim) => ({
      id: claim.id, activityId: claim.activity_id, departmentId: claim.department_id,
      description: taskResult.data.find((task) => task.id === claim.purchase_task_id)?.item_name ?? 'Purchase claim',
      amount: Number(claim.claimed_amount_sen ?? 0), date: (claim.submitted_at ?? claim.created_at).slice(0,10),
      lifecycle: claim.status as Expense['lifecycle'],
      state: claim.status === 'Pending' ? 'Pending review' : claim.status === 'Under Review' ? 'In review' : claim.status === 'Rejected' ? 'Declined' : 'Approved',
      review: { claimantId: claim.claimant_user_id, submittedAt: claim.submitted_at ?? claim.created_at,
        updatedAt: claim.updated_at, justification: claim.over_budget_justification,
        reviewer: claim.reviewer_uid ?? undefined, reviewedAt: claim.decided_at ?? undefined,
        reason: claim.decision_reason, analysis: claim.risk_assessment as unknown as RiskResult | undefined,
        decisionAnalysis: claim.decision_risk as unknown as RiskResult | undefined },
    }));
    const payments: Payment[] = await Promise.all((paymentRows ?? []).map(async (p) => {
      const destination = await client.rpc('my_claim_destination', { p_claim_id: p.claim_id });
      if (destination.error || !destination.data?.[0]) fail();
      const d = destination.data[0], proof = proofRows.find((r) => r.id === p.proof_id);
      if (!proof) fail();
      return { id: p.id, expenseId: p.claim_id, amount: Number(p.amount_sen), date: p.payment_date,
        manual: { reference: p.reference, recordedAt: p.recorded_at, recordedBy: p.recorded_by,
          payout: { label: d.label, kind: d.kind as 'Bank' | 'TNG', holder: d.holder, institution: d.institution, masked: d.masked },
          proof: safeProofMetadata(proof.filename, proof.mime_type, proof.size_bytes), externalVerified: false,
          receivedConfirmedAt: p.received_at ?? undefined, receivedConfirmedBy: p.received_by ?? undefined,
          discrepancy: p.discrepancy_at ? { reason: p.discrepancy_reason ?? '', reportedAt: p.discrepancy_at,
            reportedBy: claims.find((c) => c.id === p.claim_id)?.claimant_user_id ?? '',
            receivedAmount: p.discrepancy_amount_sen ?? undefined, resolvedAt: p.resolved_at ?? undefined,
            resolutions: p.resolution_note ? [{ note: p.resolution_note, at: p.resolved_at ?? p.recorded_at, by: p.recorded_by }] : [] } : undefined } };
    }));
    const accountRows = getDemoActor().role === 'Member' ? await listAccounts() : [];
    const accountData = accountRows.map((account) => ({ ...account, identifier: '' }));
    return {
      version: 1, claimAccounting: 'task-reservation', financialSummaries, activities, expenses, payments, assignments, events,
      notifications: (notificationRows ?? []).map((n) => ({ id: n.id, title: n.title, detail: n.detail,
        at: n.created_at, to: `/member/claims/${n.claim_id}`, tone: 'brand', read: !!n.read_at })),
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
