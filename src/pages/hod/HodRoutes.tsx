import { Link, Route, Routes } from 'react-router-dom';
import { HodProvider } from '../../context/Hod';
import { useSession } from '../../context/session-context';
import { HodShell } from '../../components/HodShell';
import { Empty } from '../../components/ui';
import { HodDashboard } from './Dashboard';
import { HodTasks } from './Tasks';
import { HodTaskForm } from './TaskForm';
import { HodTaskDetail } from './TaskDetail';
import { HodMembers } from './Members';
import { HodExpenses } from './Expenses';
import { HodBudget } from './Budget';
import { HodHistory } from './History';

const department = 'activities/:activityId/departments/:departmentId';
export function HodRoutes() {
  const { actor } = useSession();
  return (
    <HodProvider key={actor.userId}>
      <Routes>
        <Route element={<HodShell />}>
          <Route index element={<HodDashboard />} />
          <Route path={department} element={<HodDashboard department />} />
          <Route path={`${department}/tasks`} element={<HodTasks />} />
          <Route path={`${department}/tasks/new`} element={<HodTaskForm key="new" />} />
          <Route path={`${department}/tasks/:taskId`} element={<HodTaskDetail />} />
          <Route path={`${department}/tasks/:taskId/edit`} element={<HodTaskForm />} />
          <Route path={`${department}/members`} element={<HodMembers />} />
          <Route path={`${department}/budget`} element={<HodBudget />} />
          <Route path={`${department}/expenses`} element={<HodExpenses />} />
          <Route path={`${department}/history`} element={<HodHistory />} />
          <Route
            path="*"
            element={
              <Empty
                title="This page isn’t in your department workspace"
                action={
                  <Link className="btn primary" to="/hod">
                    Back to my departments
                  </Link>
                }
              >
                Choose a department or purchasing task from your workspace.
              </Empty>
            }
          />
        </Route>
      </Routes>
    </HodProvider>
  );
}
