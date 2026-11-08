import { useState, type FormEvent } from 'react';
import { Wallet } from 'lucide-react';
import { login, loginLocal, logout, type AuthState } from '../services/supabase/auth';
import { dataMode } from '../services/supabase/client';
import { Field } from './Field';
import { PageHeader, Panel, Skeleton } from './ui';
export function ClubLogin({ state, retry }: { state: AuthState; retry: () => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const localLoginEnabled = import.meta.env.DEV && dataMode === 'local' && import.meta.env.VITE_LOCAL_TEST_LOGIN === 'true';
  const act = async (operation: () => Promise<unknown>) => {
    setError(''); setBusy(true);
    try { await operation(); } catch { setError('Sign-in could not complete. Please try again.'); }
    finally { setBusy(false); }
  };
  const submitLocal = (event: FormEvent) => {
    event.preventDefault();
    void act(() => loginLocal(email.trim(), password));
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
          {localLoginEnabled && !state.signedIn && <form className="stack" onSubmit={submitLocal}>
            <p className="data-note">Local test accounts only. Club membership is still checked after sign-in.</p>
            <Field label="Test account email" id="local-test-email" required>
              <input id="local-test-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Test account password" id="local-test-password" required>
              <input id="local-test-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <button className="btn" disabled={busy}>Sign in to local test account</button>
          </form>}
        </>}
      </div>
    </Panel>
  </main>;
}
