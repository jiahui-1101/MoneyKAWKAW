import { ArrowRight, ShieldCheck, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../context/session-context';
import { demoProfiles, roleHome, type DemoActor } from '../domain/session';
import { Empty, PageHeader, Panel } from './ui';
import { demoMode } from '../services/supabase/client';
import { logout } from '../services/supabase/auth';

export function DemoRoleSwitcher() {
  const { actor, select, roles } = useSession();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState('');
  if (!demoMode) return <div className="row wrap">
    <select className="compact-select demo-profile" aria-label="Switch role" value={actor.role}
      onChange={(e) => { select(e.target.value); navigate(roleHome(e.target.value as DemoActor['role'])); }}>
      {roles?.map((role) => <option key={role}>{role}</option>)}
    </select>
    <button className="btn" onClick={() => { void logout().catch(() => setSignOutError('Couldn’t sign out. Try again.')); }}>Sign out</button>
    {signOutError && <span role="alert">{signOutError}</span>}
  </div>;
  return (
    <select
      className="compact-select demo-profile"
      aria-label="Switch demo person"
      value={actor.userId}
      onChange={(e) => {
        const profile = demoProfiles.find((p) => p.userId === e.target.value)!;
        select(profile.userId);
        navigate(roleHome(profile.role));
      }}
    >
      {demoProfiles.map((p) => (
        <option key={p.userId} value={p.userId}>
          {p.name} · {p.role === 'Member' ? 'Committee Member' : p.role} demo
        </option>
      ))}
    </select>
  );
}
export function RoleGate({
  requiredRole: role,
  children,
}: {
  requiredRole: DemoActor['role'];
  children: ReactNode;
}) {
  const { actor } = useSession();
  return actor.role === role ? (
    children
  ) : (
    <div className="access-page">
      <Empty
        title={`This page is for the ${role === 'Member' ? 'Committee Member' : role}`}
        action={
          <div className="row wrap">
            <Link className="btn primary" to={roleHome(actor.role)}>
              Go to my home page
            </Link>
            <Link className="btn" to="/demo">
              Switch role
            </Link>
          </div>
        }
      >
        You’re using the {actor.role} role, so this page is closed to you. Ask your Director for access.
      </Empty>
    </div>
  );
}
export function DemoAccess() {
  const { select, actor } = useSession();
  const navigate = useNavigate();
  if (!demoMode) return <main className="access-page stack"><h1>Your club workspace</h1>
    <DemoRoleSwitcher /><Link className="btn primary" to={roleHome(actor.role)}>Open workspace</Link></main>;
  return (
    <main className="access-page stack">
      <div className="brand">
        <span className="brand-mark">
          <Wallet size={22} />
        </span>
        <span>Money<span className="brand-accent">KAWKAW</span></span>
      </div>
      <PageHeader
        eyebrow="TRY THE DEMO"
        title="Who do you want to try?"
        description="Pick a person to see what their role can do. This is a demo, not a real login."
      />
      <Panel
        title="Pick a person"
        subtitle="Everyone sees the same sample club"
      >
        <div className="profile-grid">
          {demoProfiles.map((profile) => (
            <button
              className="profile-card"
              key={profile.userId}
              onClick={() => {
                select(profile.userId);
                navigate(roleHome(profile.role));
              }}
            >
              <span className="department-icon">
                <ShieldCheck size={20} />
              </span>
              <h2>{profile.name}</h2>
              <p>
                {profile.role === 'Director'
                  ? 'Plan activities and set budgets'
                  : profile.role === 'Treasurer'
                    ? 'Review claims and pay members back'
                    : profile.role === 'Member'
                      ? 'Buy items, upload receipts, get paid back'
                      : 'Run your department’s purchases and team'}
              </p>
              <span className="text-link">
                Open {profile.role === 'Member' ? 'Committee Member' : profile.role} workspace <ArrowRight size={15} />
              </span>
            </button>
          ))}
        </div>
      </Panel>
      <p className="data-note">
        All four demo people share the same sample club data, saved in this browser.
      </p>
    </main>
  );
}
