import { ArrowRight, ShieldCheck, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../context/session-context';
import { demoProfiles, type DemoActor } from '../domain/session';
import { Empty, PageHeader, Panel } from './ui';

export function DemoRoleSwitcher() {
  const { actor, select } = useSession();
  const navigate = useNavigate();
  return <select className="compact-select demo-profile" aria-label="Demo profile" value={actor.userId} onChange={e => {
    const profile = demoProfiles.find(p => p.userId === e.target.value)!;
    select(profile.userId); navigate(profile.role === 'Director' ? '/director' : '/hod');
  }}>{demoProfiles.map(p => <option key={p.userId} value={p.userId}>{p.name} · {p.role} demo</option>)}</select>;
}
export function RoleGate({ role, children }: { role: DemoActor['role']; children: ReactNode }) {
  const { actor } = useSession();
  return actor.role === role ? children : <div className="access-page"><Empty title={`${role} access required`} action={<div className="row wrap"><Link className="btn primary" to={actor.role === 'HOD' ? '/hod' : '/director'}>Return to my workspace</Link><Link className="btn" to="/demo">Choose a demo profile</Link></div>}>Your current {actor.role} profile cannot open this workspace. Role changes must be selected explicitly in the local demo.</Empty></div>;
}
export function DemoAccess() {
  const { select } = useSession();
  const navigate = useNavigate();
  return <main className="access-page stack"><div className="brand"><span className="brand-mark"><Wallet size={22} /></span>Money<span className="brand-accent">KAWKAW</span></div><PageHeader eyebrow="LOCAL DEMO PROFILES" title="The right workspace for your role." description="Choose an explicit demo identity. These profiles demonstrate access boundaries; they are not production authentication." /><Panel title="Explore the shared club workspace" subtitle="Every profile uses the same activities, departments, and financial records"><div className="profile-grid">{demoProfiles.map(profile => <button className="profile-card" key={profile.userId} onClick={() => { select(profile.userId); navigate(profile.role === 'HOD' ? '/hod' : '/director'); }}><span className="department-icon"><ShieldCheck size={20} /></span><h2>{profile.name}</h2><p>{profile.role === 'Director' ? 'Activity setup & club financial oversight' : 'Assigned department purchasing & team oversight'}</p><span className="text-link">Open {profile.role} workspace <ArrowRight size={15} /></span></button>)}</div></Panel><p className="data-note">HOD profiles have explicit scoped memberships. No Treasurer or Member workspace is available in this phase.</p></main>;
}
