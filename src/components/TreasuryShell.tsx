import {
  Activity,
  CircleHelp,
  ClipboardList,
  History,
  LayoutDashboard,
  Menu,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTreasury } from '../context/treasury-context';
import { useSession } from '../context/session-context';
import { DemoRoleSwitcher } from './DemoAccess';
import { demoMode } from '../services/supabase/client';
import { Empty, Modal, Skeleton, ToastMessage } from './ui';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';

const entries = [
  { to: '/treasurer', title: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/treasurer/activities', title: 'Activities', icon: Activity },
  { to: '/treasurer/claims', title: 'Claim review', icon: ClipboardList },
  { to: '/treasurer/reimbursements', title: 'Reimbursements', icon: Wallet },
  { to: '/treasurer/history', title: 'Payment history', icon: History },
];
export function TreasuryShell() {
  const { data, loading, error, reload, notice, dismiss } = useTreasury();
  const { actor, clubName } = useSession();
  const initials = actor.name.split(' ').map((part) => part[0]).slice(0, 2).join('');
  const nav = useWorkspaceNavigation();
  const location = useLocation();
  const [help, setHelp] = useState(false);
  const visibleEntries = entries;
  const section =
    visibleEntries.find((e) => (e.end ? e.to === location.pathname : location.pathname.startsWith(e.to)))
      ?.title ?? 'Treasurer';
  return (
    <div className="app-shell treasury-shell">
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
        aria-label="Treasurer navigation"
      >
        <Link className="brand" to="/treasurer" onClick={() => nav.setOpen(false)}>
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
            <small>Treasurer workspace</small>
          </div>
          <ShieldCheck size={15} />
        </div>
        <p className="nav-label">FINANCIAL MANAGEMENT</p>
        <nav>
          {visibleEntries.map(({ to, title, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
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
              <small>Treasurer{demoMode ? ' · Demo' : ''}</small>
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
              <Link to="/treasurer">Treasurer</Link>
              <span>/</span>
              <strong>{section}</strong>
            </span>
          </div>
          <div className="row">
            <DemoRoleSwitcher />
            <button
              className="icon-btn"
              aria-label="Refresh financial data"
              disabled={loading}
              onClick={() => void reload()}
            >
              <RefreshCw size={16} />
            </button>
            <span className="avatar">{initials}</span>
          </div>
        </header>
        <main id="main" tabIndex={-1} key={location.pathname}>
          {loading ? (
            <Skeleton />
          ) : error ? (
            <Empty
              title="Couldn’t load your data"
              action={
                <button className="btn primary" onClick={() => void reload()}>
                  Try again
                </button>
              }
            >
              {error}
            </Empty>
          ) : data?.activities.length ? (
            <Outlet />
          ) : (
            <Empty
              title="No activities assigned"
              action={
                <Link className="btn primary" to="/demo">
                  Choose demo profile
                </Link>
              }
            >
              Ask a Director to add you as Treasurer of an activity.
            </Empty>
          )}
        </main>
        <footer className="app-footer">
          <span>Thoughtful review. Traceable decisions.</span>
          <span>MoneyKAWKAW · Treasurer{demoMode ? ' · Local demo' : ''}</span>
        </footer>
      </div>
      <ToastMessage notice={notice} dismiss={dismiss} />
      {help && (
        <Modal title="How the Treasurer workspace works" onClose={() => setHelp(false)}>
          <div className="stack">
            <p>
              Check each receipt and the budget, then approve or decline. Approving a claim means
              the club owes the member. It does not pay them.
            </p>
            <p>
              Pay the member through your bank or TNG, then record it here with proof. This app
              doesn’t send money. Only the member can confirm they got it.
            </p>
            <p>
              Each claim is counted once in the budget. Approving or paying it doesn’t count it
              again.
            </p>
            {demoMode && <p>These are made-up records saved in this browser.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
