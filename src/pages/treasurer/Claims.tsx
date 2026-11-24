import { useState } from 'react';
import { ClaimList } from '../../components/treasurer/ClaimList';
import { DemoClaimLoader } from '../../components/treasurer/DemoClaimLoader';
import { PageHeader, Panel } from '../../components/ui';
import { demoMode } from '../../services/supabase/client';
export function TreasuryClaims({ reimbursements = false }: { reimbursements?: boolean }) {
  const [fixture, setFixture] = useState(false);
  return (
    <div className="stack">
      <PageHeader
        eyebrow={reimbursements ? 'REIMBURSEMENTS' : 'CLAIMS'}
        title={
          reimbursements
            ? 'Reimbursements'
            : 'Claim review'
        }
        description={
          !demoMode && !reimbursements
            ? 'Check each receipt and the budget, then approve or decline. Approved claims move to Reimbursements for payment.'
            :
          reimbursements
            ? 'Approved claims waiting for payment. Pay the member yourself, then record it here with proof.'
            : 'Compare each receipt with the budget, then approve or decline.'
        }
      >
        {demoMode && !reimbursements && (
          <button className="btn" onClick={() => setFixture(true)}>
            Load demo claim
          </button>
        )}
      </PageHeader>
      <Panel
        title={reimbursements ? 'Waiting for payment' : 'Claims'}
        subtitle={
          !demoMode && !reimbursements
            ? 'Approving, paying, and the member confirming are separate steps'
            :
          reimbursements
            ? 'This app doesn’t send money. Pay the member, then record it here.'
            : 'Original receipts are never changed'
        }
      >
        <ClaimList reimbursements={reimbursements} />
      </Panel>
      {fixture && <DemoClaimLoader onClose={() => setFixture(false)} />}
    </div>
  );
}
