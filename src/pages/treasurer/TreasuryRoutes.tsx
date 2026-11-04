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
export function TreasuryRoutes() {
  return (
    <TreasuryProvider>
      <Routes>
        <Route element={<TreasuryShell />}>
          <Route index element={<TreasuryDashboard />} />
          <Route path="activities" element={<TreasuryActivities />} />
          <Route path="activities/:id" element={<TreasuryActivityDetail />} />
          <Route path="claims" element={<TreasuryClaims />} />
          <Route path="claims/:id" element={<TreasuryClaimDetail />} />
          <Route path="claims/:id/risk" element={<TreasuryRisk />} />
          <Route path="claims/:id/reimburse" element={<TreasuryReimburse />} />
          <Route path="history" element={<TreasuryHistory />} />
          <Route path="reimbursements" element={<TreasuryClaims reimbursements />} />
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
