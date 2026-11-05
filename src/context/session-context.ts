import { createContext, useContext } from 'react';
import type { DemoActor } from '../domain/session';
export const SessionContext = createContext<{
  actor: DemoActor;
  clubName?: string;
  roles?: DemoActor['role'][];
  select: (id: string) => void;
} | null>(null);
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is required.');
  return value;
}
