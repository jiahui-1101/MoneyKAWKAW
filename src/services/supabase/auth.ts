import { roles as knownRoles, type Role, type SessionProfile } from '../../domain/access';
import { dataMode, supabaseClient } from './client';
import { membershipAccessError, oauthCallbackError } from './membership-error';

export type AuthState = { profile: SessionProfile | null; signedIn: boolean; error: string; loading: boolean };
export const initialAuthState: AuthState = { profile: null, signedIn: false, error: '', loading: true };
const denied = 'This Google account is not an active club member. Ask a club administrator for an invitation.';

function sessionProfile(value: unknown): SessionProfile | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const roles = Array.isArray(candidate.roles)
    ? candidate.roles.filter((role): role is Role => knownRoles.includes(role as Role)) : [];
  if (candidate.active !== true || typeof candidate.uid !== 'string' || typeof candidate.name !== 'string' ||
      typeof candidate.clubName !== 'string' || !Number.isSafeInteger(candidate.revision) || !roles.length) return null;
  const departmentScopes = Array.isArray(candidate.departmentScopes)
    ? candidate.departmentScopes.filter((scope): scope is SessionProfile['departmentScopes'][number] => {
      if (!scope || typeof scope !== 'object') return false;
      const value = scope as Record<string, unknown>;
      return typeof value.activityId === 'string' && typeof value.departmentId === 'string' &&
        (value.role === 'HOD' || value.role === 'Member');
    }) : [];
  const activityIds = Array.isArray(candidate.activityIds)
    ? candidate.activityIds.filter((id): id is string => typeof id === 'string') : [];
  return { uid: candidate.uid, name: candidate.name, active: true, roles, revision: candidate.revision as number,
    clubName: candidate.clubName, departmentScopes, activityIds };
}

export function watchSession(update: (state: AuthState) => void) {
  const client = supabaseClient();
  let active = true, generation = 0;
  let signedIn = false;
  const callbackError = oauthCallbackError(typeof window === 'undefined' ? '' : window.location?.search ?? '');
  const restore = async (background = false) => {
    const attempt = ++generation;
    if (callbackError) {
      update({ profile: null, signedIn, loading: false, error: callbackError }); return;
    }
    // Focus rechecks still validate grants, but must not unmount an in-progress receipt editor.
    if (!background) update({ ...initialAuthState, signedIn: true, loading: true });
    try {
      const { data: current, error: authError } = await client.auth.getUser();
      if (authError || !current.user) {
        if (active && generation === attempt) update({ ...initialAuthState, loading: false });
        return;
      }
      const { data: accepted, error: invitationError } = await client.rpc('accept_club_invitation');
      if (invitationError) throw invitationError;
      if (accepted !== true) {
        if (active && generation === attempt) update({ profile: null, signedIn: true, loading: false, error: denied });
        return;
      }
      const { data, error } = await client.rpc('current_club_session');
      if (error) throw error;
      const profile = sessionProfile(data);
      if (!profile || profile.uid !== current.user.id) {
        if (active && generation === attempt) update({ profile: null, signedIn: true, loading: false, error: denied });
        return;
      }
      if (active && generation === attempt) update({ profile, signedIn: true, loading: false, error: '' });
    } catch (error) {
      if (active && generation === attempt) update({ profile: null, signedIn: true, loading: false, error: membershipAccessError(error) });
    }
  };
  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    ++generation;
    signedIn = !!session;
    if (callbackError) { update({ profile: null, signedIn, loading: false, error: callbackError }); return; }
    if (!session) update({ profile: null, signedIn: false, loading: false, error: '' });
    else queueMicrotask(() => { if (active) void restore(); });
  });
  const recheck = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') void restore(true); };
  if (typeof window !== 'undefined') window.addEventListener('focus', recheck);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', recheck);
  return () => {
    active = false; ++generation; subscription.unsubscribe();
    if (typeof window !== 'undefined') window.removeEventListener('focus', recheck);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', recheck);
  };
}

export async function login() {
  const { error } = await supabaseClient().auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
}
export async function loginLocal(email: string, password: string) {
  if (!import.meta.env.DEV || dataMode !== 'local' || import.meta.env.VITE_LOCAL_TEST_LOGIN !== 'true')
    throw new Error('Synthetic sign-in requires the explicitly enabled local development environment.');
  const { error } = await supabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function logout() {
  const { error } = await supabaseClient().auth.signOut();
  if (error) throw error;
}
export async function saveNotificationPreference(notificationEnabled: boolean) {
  const client = supabaseClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('Sign in to continue.');
  const { data, error } = await client.from('member_preferences').update({ notification_enabled: notificationEnabled })
    .eq('user_id', user.id).select('user_id').maybeSingle();
  if (error) throw new Error('Notification preference could not be saved.');
  if (!data) throw new Error('Active club membership is required to change notification preferences.');
}
