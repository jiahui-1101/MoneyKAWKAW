import {
  Activity,
  ArrowUpRight,
  CircleHelp,
  FolderKanban,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Search,
  Settings2,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/workspace-context';
import { Modal, Skeleton, Toast } from './ui';
import { DemoRoleSwitcher } from './DemoAccess';

const navigation = [
  { to: '/director', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/director/activities', label: 'Activities', icon: FolderKanban },
  { to: '/director/budgets', label: 'Budget overview', icon: PiggyBank },
  { to: '/director/history', label: 'Activity log', icon: Activity },
];
export function Shell() {
  const { store, loading, error, reload, reset } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const change = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const [help, setHelp] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetError, setResetError] = useState('');
  const [search, setSearch] = useState('');
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const items = () =>
      [...(sidebar.current?.querySelectorAll<HTMLElement>('a, button') ?? [])].filter(
        (e) => e.getClientRects().length > 0,
      );
    items()[0]?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key !== 'Tab') return;
      const elements = items();
      if (e.shiftKey && document.activeElement === elements[0]) {
        e.preventDefault();
        elements.at(-1)?.focus();
      }
      if (!e.shiftKey && document.activeElement === elements.at(-1)) {
        e.preventDefault();
        elements[0]?.focus();
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  const navigate = useNavigate();
  const location = useLocation();
  const section = location.pathname.includes('/activities')
    ? 'Activities'
    : location.pathname.includes('/budgets')
      ? 'Budget overview'
      : location.pathname.includes('/history')
        ? 'Activity log'
        : location.pathname.includes('/settings')
          ? 'Workspace settings'
          : 'Overview';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {open && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebar}
        inert={mobile && !open}
        className={`sidebar ${open ? 'is-open' : ''}`}
        aria-label="Director navigation"
      >
        <Link to="/director" className="brand" onClick={() => setOpen(false)}>
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
          onClick={() => setOpen(false)}
        >
          <X size={18} />
        </button>
        <div className="workspace-card">
          <span className="club-mark">C</span>
          <div>
            <strong>Campus Collective</strong>
            <small>Director workspace</small>
          </div>
          <ShieldCheck size={15} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'selected' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Activities' && (
                <span className="nav-count">{store?.activities.length ?? '–'}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="eyebrow">A LITTLE CLARITY.</span>
            <h3>
              Big ideas.
              <br />
              Thoughtful budgets.
            </h3>
            <p>Give every club activity a plan that adds up.</p>
            <Link to="/director/activities/new" onClick={() => setOpen(false)}>
              Plan an activity <ArrowUpRight size={15} />
            </Link>
          </div>
          <NavLink
            to="/director/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'selected' : ''}`}
            onClick={() => setOpen(false)}
          >
            <Settings2 size={18} />
            Workspace settings
          </NavLink>
          <button
            className="nav-item"
            onClick={() => {
              setHelp(true);
              setOpen(false);
            }}
          >
            <CircleHelp size={18} />
            Help & guidance
          </button>
          <div className="user-card">
            <span className="avatar">JL</span>
            <div>
              <strong>Jamie Lee</strong>
              <small>Club Director · Demo</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={open}>
        <header className="topbar">
          <div className="row">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span> <strong>{section}</strong>
            </span>
          </div>
          <div className="row">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/director/activities?q=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search activities globally"
                placeholder="Search activities…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
            <DemoRoleSwitcher />
            <span className="demo-pill">
              <span />
              Local demo
            </span>
            <button
              className="avatar avatar-button"
              aria-label="View workspace settings"
              onClick={() => navigate('/director/settings')}
            >
              JL
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} key={location.pathname}>
          {loading ? (
            <Skeleton />
          ) : error ? (
            <div className="empty error-panel" role="alert">
              <h1>Let’s get your workspace back</h1>
              <p>{error}</p>
              <div className="row">
                <button className="btn primary" onClick={() => void reload()}>
                  Retry loading
                </button>
                <button className="btn" onClick={() => setConfirmReset(true)}>
                  Reset demo data
                </button>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        <footer className="app-footer">
          <span>Made for the people who make things happen.</span>
          <span>
            MoneyKAWKAW <span className="footer-dot">·</span> Director workspace
          </span>
        </footer>
      </div>
      <Toast />
      {help && (
        <Modal title="Your Director workspace" onClose={() => setHelp(false)}>
          <div className="stack help-content">
            <p>
              Create an activity, establish its overall budget, then configure departments and
              allocate funds. Dashboards update as soon as your changes are saved.
            </p>
            <p>
              <strong>Remaining</strong> is the overall budget less recorded expenses.{' '}
              <strong>Available</strong> also accounts for open assignment commitments. Pending
              claims and approved unpaid amounts remain separate.
            </p>
            <p>
              All sample expenses and payment records are fictional and read-only. Claim decisions
              belong to the Treasurer. Member payout details are never included in this workspace.
            </p>
            <Link
              className="btn primary"
              to="/director/activities/new"
              onClick={() => setHelp(false)}
            >
              Create your first activity <ArrowUpRight size={16} />
            </Link>
          </div>
        </Modal>
      )}
      {confirmReset && (
        <Modal title="Restore sample workspace?" onClose={() => setConfirmReset(false)}>
          <p>This removes your local demo changes and restores the fictional sample records.</p>
          {resetError && (
            <p role="alert" className="form-error">
              {resetError}
            </p>
          )}
          <div className="form-actions">
            <button className="btn" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                try {
                  await reset();
                  setConfirmReset(false);
                } catch {
                  setResetError('Browser storage is unavailable. Enable local storage and retry.');
                }
              }}
            >
              Restore sample data
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
