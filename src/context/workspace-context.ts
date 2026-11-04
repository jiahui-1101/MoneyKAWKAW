import { createContext, useContext } from 'react';
import type { Store } from '../domain/models';

interface WorkspaceValue {
  store: Store | null;
  loading: boolean;
  error: string;
  busy: boolean;
  notice: string;
  reload: () => Promise<void>;
  reset: () => Promise<void>;
  mutate: (change: (store: Store) => Store, message: string) => Promise<Store>;
  dismiss: () => void;
}

// Keep context identity outside the component module during React Fast Refresh.
export const WorkspaceContext = createContext<WorkspaceValue | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('WorkspaceProvider is required.');
  return value;
}
