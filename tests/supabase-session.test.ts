import { afterEach, beforeEach, expect, it, vi } from 'vitest';
type MockClient = { auth: { getUser: ReturnType<typeof vi.fn>; onAuthStateChange: ReturnType<typeof vi.fn>;
  signInWithOAuth: ReturnType<typeof vi.fn>; signOut: ReturnType<typeof vi.fn> }; rpc: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn> };
const mocks = vi.hoisted(() => ({ listener: (_event: string, _session: unknown) => {}, client: {} as MockClient,
  actor: { userId: 'member-a', name: 'A Member', role: 'Member' } }));
vi.mock('../src/services/supabase/client', () => ({ supabaseClient: () => mocks.client }));
vi.mock('../src/domain/session', () => ({ getDemoActor: () => mocks.actor }));
import { initialAuthState, login, logout, saveNotificationPreference, watchSession, type AuthState } from '../src/services/supabase/auth';
import { supabaseRepository } from '../src/services/supabase/repository';

const profile = { uid: 'member-a', name: 'A Member', active: true, roles: ['Member'], revision: 0,
  clubName: 'Synthetic Club', departmentScopes: [], activityIds: [] };
let states: AuthState[];
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.clearAllMocks(); states = [];
  const subscription = { unsubscribe: vi.fn() };
  mocks.client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'member-a' } }, error: null }),
      onAuthStateChange: vi.fn((listener) => { mocks.listener = listener; return { data: { subscription } }; }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn((name: string) => Promise.resolve({ data: name === 'accept_club_invitation' ? true : profile, error: null })),
    from: vi.fn(() => ({ update: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { user_id: 'member-a' }, error: null }) }) }) }) })),
  };
});
const signIn = () => mocks.listener('SIGNED_IN', { user: { id: 'member-a' } });

it('restores only the database-assigned profile and clears it at sign-out', async () => {
  const stop = watchSession((state) => states.push(state)); signIn();
  await vi.waitFor(() => expect(states.at(-1)?.profile?.uid).toBe('member-a'));
  expect(mocks.client.rpc).toHaveBeenCalledWith('accept_club_invitation');
  expect(mocks.client.rpc).toHaveBeenCalledWith('current_club_session');
  mocks.listener('SIGNED_OUT', null);
  expect(states.at(-1)).toEqual({ ...initialAuthState, loading: false });
  stop();
});
it('rejects an authenticated account without an active invitation', async () => {
  mocks.client.rpc.mockResolvedValueOnce({ data: false, error: null });
  const stop = watchSession((state) => states.push(state)); signIn();
  await vi.waitFor(() => expect(states.at(-1)?.error).toContain('not an active club member'));
  expect(states.at(-1)?.profile).toBeNull();
  expect(mocks.client.rpc).toHaveBeenCalledTimes(1); stop();
});
it('explains a frozen invitation without publishing a profile or unrelated server details', async () => {
  mocks.client.rpc.mockResolvedValueOnce({ data: null, error: {
    code: '23514', message: 'This financial operation is frozen during activity closing',
  } });
  let stop = watchSession(state => states.push(state)); signIn();
  await vi.waitFor(() => expect(states.at(-1)?.error).toContain('new invitation to an open activity'));
  expect(states.at(-1)?.profile).toBeNull();
  expect(mocks.client.rpc).toHaveBeenCalledTimes(1); stop();
  mocks.client.rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'private-account-secret' } });
  stop = watchSession(state => states.push(state)); signIn();
  await vi.waitFor(() => expect(states.at(-1)?.error).toContain('Check your connection'));
  expect(states.at(-1)?.error).not.toContain('private-account-secret'); stop();
});
it('does not publish a stale profile after logout races with session restoration', async () => {
  let resolve!: (value: unknown) => void;
  mocks.client.rpc.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const stop = watchSession((state) => states.push(state)); signIn();
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  mocks.listener('SIGNED_OUT', null);
  resolve({ data: true, error: null });
  await vi.waitFor(() => expect(states.at(-1)?.signedIn).toBe(false));
  expect(states.at(-1)?.profile).toBeNull(); stop();
});
it('uses Google OAuth, persists sign-out, and writes only the member preference', async () => {
  vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:5173' } });
  await login(); await logout(); await saveNotificationPreference(false);
  expect(mocks.client.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }));
  expect(mocks.client.auth.signOut).toHaveBeenCalled();
});
it('fails closed for missing sessions and unfinished financial writes', async () => {
  mocks.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') });
  await expect(supabaseRepository.load()).rejects.toThrow('Sign in again');
  await expect(supabaseRepository.save({} as never)).rejects.toThrow('No changes were saved');
  await expect(supabaseRepository.reset()).rejects.toThrow('No changes were saved');
});
it('rechecks focus without discarding the editor, and still removes revoked access', async () => {
  const events = new EventTarget();
  vi.stubGlobal('window', events);
  const stop = watchSession(state => states.push(state)); signIn();
  await vi.waitFor(() => expect(states.at(-1)?.profile?.uid).toBe('member-a'));
  states = [];
  events.dispatchEvent(new Event('focus'));
  await vi.waitFor(() => expect(states.at(-1)?.profile?.uid).toBe('member-a'));
  expect(states.every(s => !s.loading && s.profile !== null)).toBe(true);
  mocks.client.rpc.mockResolvedValueOnce({ data: false, error: null });
  events.dispatchEvent(new Event('focus'));
  await vi.waitFor(() => expect(states.at(-1)?.profile).toBeNull());
  expect(states.at(-1)?.error).toContain('not an active club member'); stop();
});
