import { useEffect, useState, type ReactNode } from 'react';
import { getDemoActor, selectDemoActor, setSessionActor } from '../domain/session';
import { SessionContext } from './session-context';
import { demoMode } from '../services/firebase/client';
import { initialAuthState, watchSession } from '../services/firebase/auth';
import { ClubLogin } from '../components/ClubLogin';
import type { Role } from '../../functions/src/contracts';
export function SessionProvider({ children }: { children: ReactNode }) {
  return demoMode ? <DemoSession>{children}</DemoSession> : <FirebaseSession>{children}</FirebaseSession>;
}
function DemoSession({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState(getDemoActor);
  return (
    <SessionContext.Provider value={{ actor, select: (id) => setActor(selectDemoActor(id)) }}>
      {children}
    </SessionContext.Provider>
  );
}
function FirebaseSession({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialAuthState), [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Role | null>(null);
  useEffect(() => {
    setState(initialAuthState);
    try { return watchSession(setState); }
    catch (e) { setState({ profile: null, signedIn: false, loading: false,
      error: e instanceof Error ? e.message : 'Unable to connect to the club.' }); }
  }, [retry]);
  const profile = state.profile;
  if (!profile || state.loading) {
    setSessionActor(null);
    return <ClubLogin state={state} retry={() => setRetry((n) => n + 1)} />;
  }
  const role = selected && profile.roles.includes(selected) ? selected : profile.roles[0];
  const actor = { userId: profile.uid, name: profile.name, role };
  setSessionActor(actor);
  return <SessionContext.Provider value={{ actor, clubName: profile.clubName, roles: profile.roles, select: (value) => {
    if (!profile.roles.includes(value as Role)) throw new Error('This workspace is not assigned to you.');
    setSelected(value as Role);
  } }}><div className="data-note" role="status">Club connection active · Business actions will be enabled in the next phases.</div>
    {children}
  </SessionContext.Provider>;
}
