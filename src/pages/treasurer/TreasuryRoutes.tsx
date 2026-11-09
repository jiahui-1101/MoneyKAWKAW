import { Link, Route, Routes } from 'react-router-dom';
import { TreasuryProvider } from '../../context/Treasury';
import { TreasuryShell } from '../../components/TreasuryShell';
import { Empty } from '../../components/ui';
import { TreasuryDashboard } from './Dashboard';
import { TreasuryActivities, TreasuryActivityDetail } from './Activities';
import { TreasuryClaims } from './Claims';
import { TreasuryClaimDetail } from './ClaimDetail';
import { TreasuryRisk } from './Risk';
import { TreasuryReimburse } from './Reimburse';
import { TreasuryHistory } from './History';
import { demoMode } from '../../services/supabase/client';
export function TreasuryRoutes() {
  return (
    <TreasuryProvider>
      <Routes>
        <Route element={<TreasuryShell />}>
          <Route index element={<TreasuryDashboard />} />
          <Route path="activities" element={<TreasuryActivities />} />
          <Route path="activities/:id" element={<TreasuryActivityDetail />} />
          {demoMode ? <>
            <Route path="claims" element={<TreasuryClaims />} />
            <Route path="claims/:id" element={<TreasuryClaimDetail />} />
            <Route path="claims/:id/risk" element={<TreasuryRisk />} />
            <Route path="claims/:id/reimburse" element={<TreasuryReimburse />} />
            <Route path="history" element={<TreasuryHistory />} />
            <Route path="reimbursements" element={<TreasuryClaims reimbursements />} />
          </> : <>
            <Route path="claims" element={<TreasuryClaims />} />
            <Route path="claims/:id" element={<TreasuryClaimDetail />} />
            <Route path="claims/:id/*" element={<Phase03Unavailable />} />
            <Route path="reimbursements" element={<Phase03Unavailable />} />
            <Route path="history/*" element={<Phase03Unavailable />} />
          </>}
          <Route
            path="*"
            element={
              <Empty
                title="This page isn’t in your financial workspace"
                action={
                  <Link className="btn" to="/treasurer">
                    Return to overview
                  </Link>
                }
              >
                Choose a financial record from your navigation.
              </Empty>
            }
          />
        </Route>
      </Routes>
    </TreasuryProvider>
  );
}
function Phase03Unavailable() {
  return <Empty title="This claim action is not available yet">
    Phase 03 provides read-only claim evidence. Approval, risk assessment, reimbursement, and payment history are reserved for Phase 04.
  </Empty>;
}
