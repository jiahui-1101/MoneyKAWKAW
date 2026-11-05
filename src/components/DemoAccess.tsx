import { ArrowRight, ShieldCheck, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../context/session-context';
import { demoProfiles, roleHome, type DemoActor } from '../domain/session';
import { Empty, PageHeader, Panel } from './ui';
import { demoMode } from '../services/firebase/client';
import { logout } from '../services/firebase/auth';

export function DemoRoleSwitcher() {
  const { actor, select, roles } = useSession();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState('');
  if (!demoMode) return <div className="row wrap">
    <select className="compact-select demo-profile" aria-label="Workspace" value={actor.role}
      onChange={(e) => { select(e.target.value); navigate(roleHome(e.target.value as DemoActor['role'])); }}>
      {roles?.map((role) => <option key={role}>{role}</option>)}
    </select>
    <button className="btn" onClick={() => { void logout().catch(() => setSignOutError('Unable to sign out. Please retry.')); }}>Sign out</button>
    {signOutError && <span role="alert">{signOutError}</span>}
  </div>;
  return (
    <select
      className="compact-select demo-profile"
      aria-label="Demo profile"
      value={actor.userId}
      onChange={(e) => {
        const profile = demoProfiles.find((p) => p.userId === e.target.value)!;
        select(profile.userId);
        navigate(roleHome(profile.role));
      }}
    >
      {demoProfiles.map((p) => (
        <option key={p.userId} value={p.userId}>
          {p.name} · {p.role} demo
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
        title={`${role} access required`}
        action={
          <div className="row wrap">
            <Link className="btn primary" to={roleHome(actor.role)}>
              Return to my workspace
            </Link>
            <Link className="btn" to="/demo">
              Choose a workspace
            </Link>
          </div>
        }
      >
        Your current {actor.role} profile cannot open this workspace. An explicit role assignment is required.
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
        Money<span className="brand-accent">KAWKAW</span>
      </div>
      <PageHeader
        eyebrow="LOCAL DEMO PROFILES"
        title="The right workspace for your role."
        description="Choose an explicit demo identity. These profiles demonstrate access boundaries; they are not production authentication."
      />
      <Panel
        title="Explore the shared club workspace"
        subtitle="Every profile uses the same activities, departments, and financial records"
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
                  ? 'Activity setup & club financial oversight'
                  : profile.role === 'Treasurer'
                    ? 'Claim review & reimbursement oversight'
                    : profile.role === 'Member'
                      ? 'My purchases, receipt-backed claims & reimbursement tracking'
                      : 'Assigned department purchasing & team oversight'}
              </p>
              <span className="text-link">
                Open {profile.role} workspace <ArrowRight size={15} />
              </span>
            </button>
          ))}
        </div>
      </Panel>
      <p className="data-note">
        All four role workspaces share one local ledger. HOD/Member department memberships and
        Treasurer activity grants are explicit; demo profiles are not production authentication.
      </p>
    </main>
  );
}
