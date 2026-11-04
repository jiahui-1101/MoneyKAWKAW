import { useState, type ReactNode } from 'react';
import { getDemoActor, selectDemoActor } from '../domain/session';
import { SessionContext } from './session-context';
export function SessionProvider({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState(getDemoActor);
  return (
    <SessionContext.Provider value={{ actor, select: (id) => setActor(selectDemoActor(id)) }}>
      {children}
    </SessionContext.Provider>
  );
}
