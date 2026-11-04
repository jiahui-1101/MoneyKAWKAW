import { Bell, CircleHelp, ClipboardList, FolderKanban, LayoutDashboard, Menu, RefreshCw, ShieldCheck, Users, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMember } from '../context/member-context';
import { useSession } from '../context/session-context';
import { memberNotifications } from '../domain/member-notifications';
import { DemoRoleSwitcher } from './DemoAccess';
import { Empty, Modal, Skeleton, ToastMessage } from './ui';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';
const entries=[
  {to:'/member',title:'My overview',icon:LayoutDashboard,end:true},
  {to:'/member/activities',title:'My activities',icon:FolderKanban},
  {to:'/member/tasks',title:'My purchasing tasks',icon:ClipboardList},
  {to:'/member/claims',title:'My claims',icon:Wallet},
  {to:'/member/accounts',title:'Payment accounts',icon:ShieldCheck},
  {to:'/member/notifications',title:'Notifications',icon:Bell},
];
export function MemberShell() {
  const {data,loading,error,reload,notice,dismiss}=useMember();const {actor}=useSession();const nav=useWorkspaceNavigation(),location=useLocation();
  const [help,setHelp]=useState(false);const initials=actor.name.split(' ').map(s=>s[0]).join('');
  const unread=data?memberNotifications(data).filter(n=>!n.read).length:0;
  const section=entries.find(e=>e.end?e.to===location.pathname:location.pathname.startsWith(e.to))?.title??'My purchase';
  return <div className="app-shell member-shell"><a className="skip-link" href="#main">Skip to content</a>
    {nav.open&&<button className="nav-scrim" aria-label="Close navigation" onClick={()=>nav.setOpen(false)}/>}
    <aside className={`sidebar ${nav.open?'is-open':''}`} ref={nav.ref} inert={nav.mobile&&!nav.open} aria-label="Member navigation">
      <Link className="brand" to="/member" onClick={()=>nav.setOpen(false)}><span className="brand-mark"><Wallet size={21}/></span><span>Money<span className="brand-accent">KAWKAW</span><small>CLUB FINANCE, MADE CLEAR.</small></span></Link>
      <button className="icon-btn mobile-close" aria-label="Close navigation" onClick={()=>nav.setOpen(false)}><X size={18}/></button>
      <div className="workspace-card"><span className="club-mark">C</span><div><strong>Campus Collective</strong><small>Committee workspace</small></div><Users size={15}/></div>
      <p className="nav-label">MY RESPONSIBILITIES</p><nav>{entries.map(({to,title,icon:Icon,end})=><NavLink key={to} to={to} end={end} onClick={()=>nav.setOpen(false)} className={({isActive})=>`nav-item ${isActive?'selected':''}`}><Icon size={18}/><span>{title}</span>{to.endsWith('notifications')&&!!unread&&<span className="nav-count">{unread}</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="eyebrow">SMALL PURCHASES. SHARED PURPOSE.</span><h3>Your part,<br/>clearly in view.</h3><p>Keep your purchases, receipts, and reimbursements together.</p><Link to="/member/tasks" onClick={()=>nav.setOpen(false)}>See my next purchase →</Link></div>
        <button className="nav-item" onClick={()=>{nav.setOpen(false);setHelp(true);}}><CircleHelp size={18}/>Help & guidance</button><Link className="nav-item" to="/demo" onClick={()=>nav.setOpen(false)}><Users size={18}/>Demo profiles</Link>
        <div className="user-card"><span className="avatar">{initials}</span><div><strong>{actor.name}</strong><small>Committee Member · Demo</small></div><span className="online-dot"/></div>
      </div>
    </aside>
    <div className="main-shell" inert={nav.open}><header className="topbar"><div className="row"><button className="icon-btn mobile-menu" aria-label="Open navigation" aria-expanded={nav.open} onClick={()=>nav.setOpen(true)}><Menu size={20}/></button><span className="breadcrumb"><Link to="/member">Member</Link><span>/</span><strong>{section}</strong></span></div><div className="row"><DemoRoleSwitcher/><button className="icon-btn" aria-label="Refresh Member data" disabled={loading} onClick={()=>void reload()}><RefreshCw size={16}/></button><span className="avatar">{initials}</span></div></header>
      <main id="main" tabIndex={-1} key={location.pathname}>{loading?<Skeleton/>:error?<Empty title="Your workspace couldn’t load" action={<button className="btn primary" onClick={()=>void reload()}>Retry loading</button>}>{error}</Empty>:<Outlet/>}</main>
      <footer className="app-footer"><span>Clear responsibilities. Confident purchases.</span><span>MoneyKAWKAW · Member · Local demo</span></footer>
    </div><ToastMessage notice={notice} dismiss={dismiss}/>
    {help&&<Modal title="Your Member workspace" onClose={()=>setHelp(false)}><div className="stack"><p>Coordinate with your department and update only your own assigned purchases. Your HOD controls task budgets, ownership, and deadlines.</p><p>Upload the original receipt, read it on device or enter source values manually, and retain corrections and exclusions. The Treasurer decides your submitted claim.</p><p>Store fictional payout instructions for this local demo. A recorded payment is separate from bank verification and your acknowledgment of receipt.</p></div></Modal>}
  </div>;
}
