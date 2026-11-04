import { Component, Suspense, lazy, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { WorkspaceProvider } from './context/Workspace';
import { Shell } from './components/Shell';
import { Empty, Skeleton } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { Activities } from './pages/Activities';
import { ActivityForm } from './pages/ActivityForm';
import { ActivityDetail } from './pages/ActivityDetail';
import { History, Settings } from './pages/WorkspacePages';
import { SessionProvider } from './context/Session';
import { useSession } from './context/session-context';
import { DemoAccess, RoleGate } from './components/DemoAccess';
import { HodRoutes } from './pages/hod/HodRoutes';
import { TreasuryRoutes } from './pages/treasurer/TreasuryRoutes';
import { roleHome } from './domain/session';
const MemberRoutes=lazy(()=>import('./pages/member/MemberRoutes').then(m=>({default:m.MemberRoutes})));

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Club workspace render failed', error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <div className="empty">
        <h1>The workspace couldn’t render.</h1>
        <p>Reload the page to try again. Your saved local data is preserved.</p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SessionProvider>
          <Routes>
            <Route path="/" element={<LandingRedirect />} />
            <Route path="/demo" element={<DemoAccess />} />
            <Route path="/member/*" element={<RoleGate requiredRole="Member"><Suspense fallback={<div className="access-page"><Skeleton/></div>}><MemberRoutes/></Suspense></RoleGate>}/>
            <Route
              path="/treasurer/*"
              element={
                <RoleGate requiredRole="Treasurer">
                  <TreasuryRoutes />
                </RoleGate>
              }
            />
            <Route
              path="/hod/*"
              element={
                <RoleGate requiredRole="HOD">
                  <HodRoutes />
                </RoleGate>
              }
            />
            <Route
              path="/director"
              element={
                <RoleGate requiredRole="Director">
                  <WorkspaceProvider>
                    <Shell />
                  </WorkspaceProvider>
                </RoleGate>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="activities" element={<Activities />} />
              <Route path="activities/new" element={<ActivityForm key="new" />} />
              <Route path="activities/:id" element={<ActivityDetail />} />
              <Route path="activities/:id/edit" element={<ActivityForm />} />
              <Route
                path="activities/:id/departments"
                element={<ActivityDetail tab="departments" />}
              />
              <Route path="activities/:id/budget" element={<ActivityDetail tab="budget" />} />
              <Route path="budgets" element={<Dashboard key="budgets" budgets />} />
              <Route path="history" element={<History />} />
              <Route path="settings" element={<Settings />} />
              <Route
                path="*"
                element={
                  <Empty
                    title="This page isn’t in your workspace"
                    action={
                      <Link className="btn primary" to="/director">
                        Back to overview
                      </Link>
                    }
                  >
                    Choose an activity or a workspace section from the navigation.
                  </Empty>
                }
              />
            </Route>
            <Route path="*" element={<LandingRedirect missing />} />
          </Routes>
        </SessionProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
function LandingRedirect({ missing = false }: { missing?: boolean }) {
  const { actor } = useSession();
  return <Navigate to={`${roleHome(actor.role)}${missing ? '/not-found' : ''}`} replace />;
}
