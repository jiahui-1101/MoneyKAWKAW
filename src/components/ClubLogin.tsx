import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { login, logout, type AuthState } from '../services/firebase/auth';
import { PageHeader, Panel, Skeleton } from './ui';
export function ClubLogin({ state, retry }: { state: AuthState; retry: () => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const act = async (operation: () => Promise<unknown>) => {
    setError(''); setBusy(true);
    try { await operation(); } catch { setError('Sign-in could not complete. Please try again.'); }
    finally { setBusy(false); }
  };
  return <main className="access-page stack">
    <div className="brand"><Wallet size={22} /> Money<span className="brand-accent">KAWKAW</span></div>
    <PageHeader eyebrow="CLUB WORKSPACE" title="Your club. One clear workspace."
      description="Sign in with your invited Google account to continue." />
    <Panel title={state.loading ? 'Checking your membership' : 'Welcome to your club workspace'}>
      <div className="member-content stack">
        {state.loading ? <Skeleton /> : <>
          <p>Club access is by invitation. Signing in does not grant a role or department access.</p>
          {(error || state.error) && <p role="alert">{error || state.error}</p>}
          <div className="row wrap">
            <button className="btn primary" disabled={busy} onClick={() => void act(state.signedIn ? logout : login)}>
              {state.signedIn ? 'Sign out' : 'Continue with Google'}
            </button>
            {state.error && <button className="btn" onClick={retry}>Retry access</button>}
          </div>
        </>}
      </div>
    </Panel>
  </main>;
}
