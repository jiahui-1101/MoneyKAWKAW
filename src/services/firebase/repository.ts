import { httpsCallable } from 'firebase/functions';
import type { Store } from '../../domain/models';
import { getDemoActor } from '../../domain/session';
import { firebaseClient } from './client';
export interface WorkspaceRepository {
  load(): Promise<Store>;
  save(store: Store): Promise<Store>;
  reset(): Promise<Store>;
}
const unavailable = async (): Promise<Store> => {
  throw new Error('This business action is not enabled in Firebase yet. No changes were saved.');
};
export const firebaseRepository: WorkspaceRepository = {
  async load() {
    const actor = getDemoActor(), { auth, functions } = firebaseClient();
    if (auth.currentUser?.uid !== actor.userId) throw new Error('Sign in again to refresh club access.');
    const result = await httpsCallable<{ role: string }, Store>(functions, 'foundationWorkspace')({ role: actor.role });
    if (auth.currentUser?.uid !== actor.userId || getDemoActor().role !== actor.role)
      throw new Error('Workspace changed. Refresh to continue.');
    return result.data;
  },
  save: unavailable,
  reset: unavailable,
};
