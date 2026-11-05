import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authChanged: (_: { uid: string } | null) => { void _; },
  membershipChanged: async () => {}, membershipError: () => {},
  callable: vi.fn(), signOut: vi.fn(), stopMember: vi.fn(), stopAuth: vi.fn(),
  auth: { currentUser: null as null | { uid: string } }, actor: { userId: 'member-a', role: 'Member' } }));
vi.mock('../src/services/firebase/client', () => ({ firebaseClient: () => ({ auth: mocks.auth, db: {}, functions: {} }) }));
vi.mock('firebase/auth', () => ({ browserLocalPersistence: {}, GoogleAuthProvider: vi.fn(),
  setPersistence: vi.fn(), signInWithPopup: vi.fn(), signOut: mocks.signOut,
  onAuthStateChanged: (_: unknown, cb: typeof mocks.authChanged) => { mocks.authChanged = cb; return mocks.stopAuth; } }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), serverTimestamp: vi.fn(), setDoc: vi.fn(),
  onSnapshot: (_: unknown, cb: typeof mocks.membershipChanged, error: typeof mocks.membershipError) => {
    mocks.membershipChanged = cb; mocks.membershipError = error; return mocks.stopMember;
  } }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => mocks.callable }));
vi.mock('../src/domain/session', () => ({ getDemoActor: () => mocks.actor }));
import { watchSession, logout, type AuthState } from '../src/services/firebase/auth';
import { firebaseRepository } from '../src/services/firebase/repository';
let states: AuthState[];
beforeEach(() => { vi.clearAllMocks(); states = []; mocks.auth.currentUser = { uid: 'member-a' }; });
it('restores only the profile verified by the backend and clears it on sign-out', async () => {
  mocks.callable.mockResolvedValue({ data: { uid: 'member-a', roles: ['Member'] } });
  const stop = watchSession((state) => states.push(state));
  mocks.authChanged({ uid: 'member-a' });
  expect(states.at(-1)?.loading).toBe(true);
  await mocks.membershipChanged();
  expect(states.at(-1)?.profile?.uid).toBe('member-a');
  mocks.authChanged(null);
  expect(states.at(-1)?.profile).toBe(null);
  expect(states.at(-1)?.signedIn).toBe(false);
  await logout(); expect(mocks.signOut).toHaveBeenCalled();
  stop(); expect(mocks.stopAuth).toHaveBeenCalled();
});
it('rejects a stale successful response after membership verification fails', async () => {
  let resolve!: (value: unknown) => void;
  mocks.callable.mockReturnValue(new Promise((done) => { resolve = done; }));
  const stop = watchSession((state) => states.push(state));
  mocks.authChanged({ uid: 'member-a' });
  const pending = mocks.membershipChanged();
  mocks.membershipError();
  resolve({ data: { uid: 'member-a', roles: ['Director'] } }); await pending;
  expect(states.at(-1)?.profile).toBe(null);
  expect(states.at(-1)?.error).toContain('could not be verified'); stop();
});
it('surfaces a backend access error without granting a role', async () => {
  mocks.callable.mockRejectedValue(new Error('permission-denied'));
  const stop = watchSession((state) => states.push(state));
  mocks.authChanged({ uid: 'member-a' }); await mocks.membershipChanged();
  expect(states.at(-1)?.profile).toBe(null);
  expect(states.at(-1)?.error).toContain('invitation'); stop();
});
it('rejects unauthenticated reads and all unfinished business writes', async () => {
  mocks.auth.currentUser = null;
  await expect(firebaseRepository.load()).rejects.toThrow('Sign in');
  await expect(firebaseRepository.reset()).rejects.toThrow('not enabled');
  await expect(firebaseRepository.save({} as never)).rejects.toThrow('No changes were saved');
});
it('never replaces backend failures with mock data', async () => {
  mocks.callable.mockRejectedValue(new Error('unavailable'));
  await expect(firebaseRepository.load()).rejects.toThrow('unavailable');
});
