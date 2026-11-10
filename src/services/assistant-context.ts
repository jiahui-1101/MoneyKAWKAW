import { supabaseClient, demoMode } from './supabase/client';
import { checked } from './supabase/finance';
import { validateAssistantContext, type AssistantContext, type AssistantIntent } from '../domain/assistant';
import type { DemoActor } from '../domain/session';
export interface AssistantChoice { id: string; label: string; type: 'ACTIVITY' | 'DEPARTMENT' | 'CLAIM' }
export async function assistantContext(actor: DemoActor, kind: AssistantIntent, id: string | null, signal: AbortSignal) {
  if (demoMode) throw new Error('Use an authenticated local or Supabase workspace for financial context.');
  const client = supabaseClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || auth.user?.id !== actor.userId) throw new Error('Session changed. Reopen the assistant.');
  const data = checked(await client.rpc('assistant_context', { p_role: actor.role, p_kind: kind,
    p_record: id as unknown as string }).abortSignal(signal));
  return validateAssistantContext(data as unknown as AssistantContext, actor.role, kind, id);
}
export async function assistantChoices(actor: DemoActor, signal: AbortSignal): Promise<AssistantChoice[]> {
  if (demoMode) return [];
  const client = supabaseClient();
  if (actor.role === 'Director' || actor.role === 'Treasurer') {
    const activities = checked(await client.from('activities').select('id,name').order('name').limit(30).abortSignal(signal));
    const result: AssistantChoice[] = activities.map((a) => ({ id: a.id, label: a.name, type: 'ACTIVITY' }));
    if (actor.role === 'Treasurer') {
      const claims = checked(await client.from('claims').select('id,status,claimed_amount_sen')
        .neq('claimant_user_id', actor.userId).neq('status','Draft').order('submitted_at',{ascending:false}).limit(30).abortSignal(signal));
      result.push(...claims.map((c) => ({ id: c.id, label: `${c.status} · RM ${((c.claimed_amount_sen ?? 0) / 100).toFixed(2)} · ${c.id.slice(0,8)}`, type: 'CLAIM' as const })));
    }
    return result;
  }
  const profile = checked(await client.rpc('current_club_session').abortSignal(signal)) as unknown as {
    departmentScopes: { departmentId: string; role: string }[] };
  const ids = profile.departmentScopes.filter((s) => s.role === actor.role).map((s) => s.departmentId);
  if (!ids.length) throw new Error('Your department assignment changed.');
  const departments = checked(await client.from('departments').select('id,name').in('id',ids).limit(30).abortSignal(signal));
  const result: AssistantChoice[] = departments.map((d) => ({ id: d.id, label: d.name, type: 'DEPARTMENT' }));
  if (actor.role === 'Member') {
    const claims = checked(await client.from('claims').select('id,status,claimed_amount_sen')
      .eq('claimant_user_id',actor.userId).in('department_id',ids).order('created_at',{ascending:false}).limit(30).abortSignal(signal));
    result.push(...claims.map((c) => ({ id:c.id, label:`${c.status} · RM ${((c.claimed_amount_sen ?? 0) / 100).toFixed(2)} · ${c.id.slice(0,8)}`, type:'CLAIM' as const })));
  }
  return result;
}
