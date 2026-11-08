import { Link, Route, Routes } from 'react-router-dom';
import { useSession } from '../../context/session-context';
import { MemberProvider } from '../../context/Member';
import { MemberShell } from '../../components/MemberShell';
import { Empty } from '../../components/ui';
import { MemberDashboard } from './Dashboard';
import { MemberActivities, MemberDepartment } from './Activities';
import { MemberTasks } from './Tasks';
import { MemberTaskDetail } from './TaskDetail';
import { MemberAccounts } from './Accounts';
import { MemberClaims } from './Claims';
import { MemberDraft } from './Draft';
import { MemberClaimDetail } from './ClaimDetail';
import { MemberPayment } from './Payment';
import { MemberNotifications } from './Notifications';
import { demoMode } from '../../services/supabase/client';
export function MemberRoutes() {
  const { actor } = useSession();
  return (
    <MemberProvider key={actor.userId}>
      <Routes>
        <Route element={<MemberShell />}>
          <Route index element={<MemberDashboard />} />
          <Route path="activities" element={<MemberActivities />} />
          <Route
            path="activities/:activityId/departments/:departmentId"
            element={<MemberDepartment />}
          />
          <Route path="tasks" element={<MemberTasks />} />
          <Route path="tasks/:id" element={<MemberTaskDetail />} />
          {demoMode ? <>
            <Route path="drafts/:id" element={<MemberDraft />} />
            <Route path="claims" element={<MemberClaims />} />
            <Route path="claims/:id" element={<MemberClaimDetail />} />
            <Route path="claims/:id/payment" element={<MemberPayment />} />
            <Route path="accounts" element={<MemberAccounts />} />
          </> : <>
            <Route path="drafts/*" element={<Phase03Unavailable />} />
            <Route path="claims/*" element={<Phase03Unavailable />} />
            <Route path="accounts" element={<Phase03Unavailable />} />
          </>}
          <Route path="notifications" element={<MemberNotifications />} />
          <Route
            path="*"
            element={
              <Empty
                title="This page isn’t in your Member workspace"
                action={
                  <Link className="btn primary" to="/member">
                    Return to my overview
                  </Link>
                }
              >
                Choose one of your activities, assigned purchases, or private claims.
              </Empty>
            }
          />
        </Route>
      </Routes>
    </MemberProvider>
  );
}
function Phase03Unavailable() {
  return (
    <Empty title="Claims and payment accounts aren’t available yet">
      Purchasing tasks and progress are connected. Receipt uploads, claims, and payout details are planned for Phase 03.
    </Empty>
  );
}
