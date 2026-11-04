import { useState } from 'react';
import { ClaimList } from '../../components/treasurer/ClaimList';
import { DemoClaimLoader } from '../../components/treasurer/DemoClaimLoader';
import { PageHeader, Panel } from '../../components/ui';
export function TreasuryClaims({ reimbursements = false }: { reimbursements?: boolean }) {
  const [fixture, setFixture] = useState(false);
  return (
    <div className="stack">
      <PageHeader
        eyebrow={reimbursements ? 'REIMBURSEMENTS' : 'CLAIM MANAGEMENT'}
        title={
          reimbursements
            ? 'Approved. Ready for the next step.'
            : 'Good decisions start with the evidence.'
        }
        description={
          reimbursements
            ? 'Approved, unpaid claims with a selected payout snapshot. Record external transfers with proof.'
            : 'Compare receipts, understand the variance, and leave a traceable decision.'
        }
      >
        {!reimbursements && (
          <button className="btn" onClick={() => setFixture(true)}>
            Load demo claim
          </button>
        )}
      </PageHeader>
      <Panel
        title={reimbursements ? 'Pending reimbursements' : 'Claim review queue'}
        subtitle={
          reimbursements
            ? 'Payments are recorded manually; this application does not move money.'
            : 'Shared submission records · original evidence remains unchanged'
        }
      >
        <ClaimList reimbursements={reimbursements} />
      </Panel>
      {fixture && <DemoClaimLoader onClose={() => setFixture(false)} />}
    </div>
  );
}
