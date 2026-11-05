import { browserLocalPersistence, GoogleAuthProvider, onAuthStateChanged,
  setPersistence, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebaseClient } from './client';
import type { SessionProfile } from '../../../functions/src/contracts';
export type AuthState = { profile: SessionProfile | null; signedIn: boolean; error: string; loading: boolean };
export const initialAuthState: AuthState = { profile: null, signedIn: false, error: '', loading: true };
export function watchSession(update: (state: AuthState) => void) {
  const { auth, db, functions } = firebaseClient();
  let generation = 0, stopMember = () => {};
  const stopAuth = onAuthStateChanged(auth, (user) => {
    ++generation;
    stopMember();
    update({ ...initialAuthState, signedIn: !!user, loading: !!user });
    if (!user) return;
    let alive = true;
    const unsubscribe = onSnapshot(doc(db, 'clubs/main/members', user.uid), async () => {
      const attempt = ++generation;
      update({ ...initialAuthState, signedIn: true });
      try {
        const result = await httpsCallable<void, SessionProfile>(functions, 'sessionProfile')();
        if (generation === attempt) update({ profile: result.data, signedIn: true, loading: false, error: '' });
      } catch {
        if (generation === attempt) update({ profile: null, signedIn: true, loading: false,
          error: 'Club access is unavailable. Check your invitation or retry your connection.' });
      }
    }, () => {
      if (alive) {
        ++generation;
        update({ profile: null, signedIn: true, loading: false,
          error: 'Your club membership could not be verified. Retry to continue.' });
      }
    });
    stopMember = () => { alive = false; unsubscribe(); };
  }, () => {
    ++generation; stopMember();
    update({ profile: null, signedIn: false, loading: false, error: 'Unable to restore your session.' });
  });
  return () => { ++generation; stopMember(); stopAuth(); };
}
export async function login() {
  const { auth } = firebaseClient();
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}
export const logout = () => signOut(firebaseClient().auth);
export async function saveNotificationPreference(notificationEnabled: boolean) {
  const { auth, db } = firebaseClient();
  if (!auth.currentUser) throw new Error('Sign in to continue.');
  await setDoc(doc(db, 'clubs/main/members', auth.currentUser.uid, 'preferences/notifications'),
    { notificationEnabled, updatedAt: serverTimestamp() });
}
