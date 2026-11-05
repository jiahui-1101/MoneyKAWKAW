import { demoMode } from '../services/firebase/client';
import type { Role } from '../../functions/src/contracts';
export const demoProfiles = [
  { userId: 'director-jamie', name: 'Jamie Lee', role: 'Director' },
  { userId: 'hod-sarah', name: 'Sarah Tan', role: 'HOD' },
  { userId: 'hod-amir', name: 'Amir Hassan', role: 'HOD' },
  { userId: 'hod-mei', name: 'Mei Wong', role: 'HOD' },
  { userId: 'treasurer-nora', name: 'Nora Lim', role: 'Treasurer' },
  { userId: 'member-ava', name: 'Ava Chen', role: 'Member' },
  { userId: 'member-ryan', name: 'Ryan Lee', role: 'Member' },
  { userId: 'member-grace', name: 'Grace Lim', role: 'Member' },
] as const;
export type DemoActor = { userId: string; name: string; role: Role };
export const roleHome = (role: DemoActor['role']) =>
  role === 'Director'
    ? '/director'
    : role === 'HOD'
      ? '/hod'
      : role === 'Treasurer'
        ? '/treasurer'
        : '/member';
const key = 'moneykawkaw.demo-actor';
function initialActor(): DemoActor {
  try {
    return demoProfiles.find((p) => p.userId === sessionStorage.getItem(key)) ?? demoProfiles[0];
  } catch {
    return demoProfiles[0];
  }
}
let actor: DemoActor | null = demoMode ? initialActor() : null;
export const getDemoActor = () => {
  if (!actor) throw new Error('Sign in to an authorized club workspace.');
  return actor;
};
export function setSessionActor(value: DemoActor | null) { actor = value; }
export function selectDemoActor(id: string) {
  if (!demoMode) throw new Error('Demo profiles are disabled in Firebase mode.');
  const next = demoProfiles.find((p) => p.userId === id);
  if (!next) throw new Error('Choose an available demo profile.');
  try {
    sessionStorage.setItem(key, next.userId);
  } catch {
    /* Session remains usable in memory. */
  }
  actor = next;
  return next;
}
export function requireRole(role: DemoActor['role']) {
  const current = getDemoActor();
  if (current.role !== role) throw new Error('This action is not available to your current role.');
  return current;
}
