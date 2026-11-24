import {
  Activity,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Menu,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useHod } from '../context/hod-context';
import { useSession } from '../context/session-context';
import { scopePath } from '../domain/hod';
import { DemoRoleSwitcher } from './DemoAccess';
import { demoMode } from '../services/supabase/client';
import { Empty, Modal, Skeleton, ToastMessage } from './ui';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';

export function HodShell() {
  const { data, loading, error, reload, notice, dismiss } = useHod();
  const { actor, clubName } = useSession();
  const nav = useWorkspaceNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const match = useMatch('/hod/activities/:activityId/departments/:departmentId/*');
  const scope =
    data?.scopes.find(
      (s) =>
        s.activity.id === match?.params.activityId &&
        s.department.id === match?.params.departmentId,
    ) ?? data?.scopes[0];
  const unauthorized =
    !!match &&
    !data?.scopes.some(
      (s) =>
        s.activity.id === match.params.activityId && s.department.id === match.params.departmentId,
    );
  const base = scope ? scopePath(scope.activity.id, scope.department.id) : '/hod';
  const entries = [
    { to: '/hod', title: 'Overview', icon: LayoutDashboard, end: true },
    { to: base, title: 'My department', icon: ShieldCheck, end: true },
    { to: `${base}/tasks`, title: 'Purchasing tasks', icon: ClipboardList },
    { to: `${base}/members`, title: 'Members', icon: Users },
    { to: `${base}/budget`, title: 'Budget', icon: PiggyBank },
    ...(demoMode ? [{ to: `${base}/expenses`, title: 'Expenses & claims', icon: Wallet }] : []),
    { to: `${base}/history`, title: 'History', icon: Activity },
  ];
  const [help, setHelp] = useState(false);
  const initials = actor.name
    .split(' ')
    .map((n) => n[0])
    .join('');
  return (
    <div className="app-shell hod-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {nav.open && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => nav.setOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${nav.open ? 'is-open' : ''}`}
        ref={nav.ref}
        inert={nav.mobile && !nav.open}
        aria-label="HOD navigation"
      >
        <Link className="brand" to="/hod" onClick={() => nav.setOpen(false)}>
          <span className="brand-mark">
            <Wallet size={21} />
          </span>
          <span>
            Money<span className="brand-accent">KAWKAW</span>
            <small>CLUB FINANCE, MADE CLEAR.</small>
          </span>
        </Link>
        <button
          className="icon-btn mobile-close"
          aria-label="Close navigation"
          onClick={() => nav.setOpen(false)}
        >
          <X size={18} />
        </button>
        <div className="workspace-card">
          <span className="club-mark">C</span>
          <div>
            <strong>{clubName ?? 'Campus Collective'}</strong>
            <small>Department workspace</small>
          </div>
          <ShieldCheck size={15} />
        </div>
        <p className="nav-label">DEPARTMENT MANAGEMENT</p>
        <nav>
          {entries
            .filter((_, i) => i === 0 || !!scope)
            .map(({ to, title, icon: Icon, end }) => (
              <NavLink
                to={to}
                key={title}
                end={end}
                onClick={() => nav.setOpen(false)}
                className={({ isActive }) => `nav-item ${isActive ? 'selected' : ''}`}
              >
                <Icon size={18} />
                <span>{title}</span>
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => {
              nav.setOpen(false);
              setHelp(true);
            }}
          >
            <CircleHelp size={18} />
            Help & guidance
          </button>
          <Link className="nav-item" to="/demo" onClick={() => nav.setOpen(false)}>
            <Users size={18} />
            {demoMode ? 'Demo profiles' : 'My workspaces'}
          </Link>
          <div className="user-card">
            <span className="avatar">{initials}</span>
            <div>
              <strong>{actor.name}</strong>
              <small>Head of Department{demoMode ? ' · Demo' : ''}</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={nav.open}>
        <header className="topbar">
          <div className="row">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              aria-expanded={nav.open}
              onClick={() => nav.setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>
              <strong>My department</strong>
            </span>
          </div>
          <div className="row">
            <DemoRoleSwitcher />
            <button
              className="icon-btn"
              aria-label="Refresh department data"
              disabled={loading}
              onClick={() => void reload()}
            >
              <RefreshCw size={16} />
            </button>
            <span className="avatar">{initials}</span>
          </div>
        </header>
        <main id="main" tabIndex={-1} key={location.pathname}>
          {!loading && data && data.scopes.length > 0 && (
            <div className="hod-scope-bar">
              <div>
                <span className="eyebrow">VIEWING</span>
                <p>Only the Director can change your budget.</p>
              </div>
              <div className="hod-scope-select">
                <label htmlFor="hod-department">Activity & department</label>
                <select id="hod-department" value={base} onChange={(e) => navigate(e.target.value)}>
                  {data.scopes.map((s) => (
                    <option key={s.department.id} value={scopePath(s.activity.id, s.department.id)}>
                      {s.activity.name} · {s.department.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {loading ? (
            <Skeleton />
          ) : error ? (
            <Empty
              title="Your department workspace couldn’t load"
              action={
                <button className="btn primary" onClick={() => void reload()}>
                  Try again
                </button>
              }
            >
              {error}
            </Empty>
          ) : !scope ? (
            <Empty
              title="No departments assigned"
              action={
                <div className="row wrap">
                  <button className="btn" onClick={() => void reload()}>
                    Check again
                  </button>
                  <Link className="btn primary" to="/demo">
                    Choose demo profile
                  </Link>
                </div>
              }
            >
              A Director must explicitly assign your profile to a department. A descriptive lead
              name does not grant access.
            </Empty>
          ) : unauthorized ? (
            <Empty
              title="You can’t open this department"
              action={
                <Link className="btn primary" to="/hod">
                  Back to my departments
                </Link>
              }
            >
              You are not the HOD of this department.
            </Empty>
          ) : (
            <Outlet />
          )}
        </main>
        <footer className="app-footer">
          <span>Clear responsibilities. Thoughtful spending.</span>
          <span>MoneyKAWKAW · HOD workspace{demoMode ? ' · Local demo' : ''}</span>
        </footer>
      </div>
      <ToastMessage notice={notice} dismiss={dismiss} />
      {help && (
        <Modal title="How the HOD workspace works" onClose={() => setHelp(false)}>
          <div className="stack">
            <p>
              Choose one of your departments, plan purchases, assign them to department members, and
              track progress. The Director sets your budget.
            </p>
            <p>
              Task amounts are estimates. Spending comes from members’ claims. Free to spend = budget
              minus claims minus tasks with no claim yet.
            </p>
            <p>
              Once a claim is submitted, the task is locked. Marking a purchase done does not approve
              or pay the claim; only the Treasurer does that.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
