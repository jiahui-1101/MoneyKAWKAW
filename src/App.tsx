import { Component, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { WorkspaceProvider } from './context/Workspace';
import { Shell } from './components/Shell';
import { Empty } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { Activities } from './pages/Activities';
import { ActivityForm } from './pages/ActivityForm';
import { ActivityDetail } from './pages/ActivityDetail';
import { History, Settings } from './pages/WorkspacePages';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Director workspace render failed', error, info.componentStack);
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
        <WorkspaceProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/director" replace />} />
            <Route path="/director" element={<Shell />}>
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
            <Route path="*" element={<Navigate to="/director/not-found" replace />} />
          </Routes>
        </WorkspaceProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
