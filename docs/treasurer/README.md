# Treasurer workspace

The Treasurer frontend extends the existing React/TypeScript application and shared version-1 ledger. It preserves Director setup and HOD purchasing. No Member frontend, bank transfer service, production authentication, OCR engine, or predictive model is introduced.

## Entry and routes

Run `npm ci`, then `npm run dev -- --port 5186`. Open `/demo` and select **Nora Lim**. Director activity creation/editing explicitly grants or removes Nora’s activity oversight. The default grant covers Summit, Design Workshop, Community Day, and Annual Dinner; Leadership Retreat is deliberately excluded.

| Route | Behavior |
| --- | --- |
| `/treasurer` | Derived financial metrics, review/payment counts, four chart views, alerts, recent history |
| `/treasurer/activities` | Authorized activities, financial status, search/type filter |
| `/treasurer/activities/:id` | Activity budget, department balances, scoped claim filters, payment history link |
| `/treasurer/claims` | Status tabs, search, date/amount sorting, activity/department/member/date filters |
| `/treasurer/claims/:id` | Evidence comparison, review start, confirmed decisions, justification, audit |
| `/treasurer/claims/:id/risk` | Configurable advisory analysis, contributing factors, decision snapshot |
| `/treasurer/reimbursements` | Approved claims with no existing payment |
| `/treasurer/claims/:id/reimburse` | Selected instructions and manual transfer record/proof form |
| `/treasurer/history` | Immutable payment records, filters, metadata, preserved proof viewer |

## Shared data and boundaries

`domain/treasury.ts` adds metadata to existing Expense and Payment IDs. `treasury-migration.ts` adds deterministic fictional receipt/history/payout fixtures without changing activity budgets, claim amounts, historical payment amounts, or purchasing memberships. Reapplying the migration is idempotent.

The role-facing mock services read fresh shared data and recheck role/activity grants on each command and evidence read. Treasury projections omit original receipt files, full payout identifiers, and proof bytes. Separate receipt/proof endpoints require scope; payout disclosure additionally requires an approved, unpaid claim with a matching claimant-owned snapshot. The identifier remains masked until revealed in the payment screen.

Director reads strip manual payment/private evidence metadata. Director saves preserve fresh claim, payment, task, receipt, and audit records. HOD DTOs continue to expose only scoped financial status and totals, without payout instructions, receipts, or proof. UI hiding alone is not the permission boundary.

These checks are demonstrative client-side rules, not production security. Browser localStorage is inspectable and unencrypted. Only fictional data belongs here. Replace service adapters with authenticated, authorized APIs and protected object/file storage before handling real financial information.

## Financial rules

- Money uses integer minor units; totals derive from linked source records.
- Recorded = Pending review + In review + Approved claim amounts. Declined evidence remains in history but is excluded.
- Pending = Pending review + In review amounts. Approved liability = approved amounts minus recorded payments.
- Open reservations include unclaimed active tasks and the original estimate for tasks whose claim was declined. Cancelled tasks reserve nothing.
- Committed = open reservations + approved unpaid amounts. Available = budget − recorded claims − open reservations. Remaining = budget − recorded claims.
- A submitted actual amount replaces its item estimate. Approval and payment reclassify the same expense; they never add another expense.
- Declining RM190 against a RM150 task restores the RM150 reservation, releasing only the RM40 variance. Resubmission is a future Member workflow.

## Review and advisory rules

Pending review → In review → Approved or Declined. Starting review appends actor/time history. Final decisions require the current revision and a confirmation dialog; declining requires a reason. Receipt lines must reconcile before approval, and item overruns or negative department/activity headroom require prior analysis. Treasurer cannot edit submitted amounts, originals, or claimant corrections.

Analyze Risk calculates item variance, department/activity available funds, other pending amounts, and commitments. Default item variance thresholds are Medium ≥10% and High ≥25%; headroom at or below 20% is Medium, and negative available funds are High. The highest factor sets the band. Thresholds are configurable club-wide in the demo, validated, and copied into snapshots. Results are deterministic advisory levels, with no probability or automatic approval. Decision-time analysis is recomputed from fresh balances and retained separately from earlier analysis events.

RM150 → RM190 produces RM40 variance and 26.67%, High under default rules. Approval converts the already-reserved claim into liability; it does not reduce availability a second time. Legacy decisions without analysis show an explicit historical-data limitation.

## Manual reimbursements

Approved → Payment pending → Manual payment recorded / proof available → Awaiting member confirmation. Only a future authorized Member command may set receipt confirmation; no Treasurer action does so.

The demo accepts one full reimbursement per claim. It validates amount, date between submission and today, reference, external-transfer/demo attestation, and proof. PNG/JPEG/PDF files are limited to 1 MB and checked for encoding, byte count, and file signatures. The original proof bytes, reference, payment date, actor, recording timestamp, and masked destination are preserved. There is no edit/delete endpoint for finalized payments. Web Locks serialize Treasurer commands across supporting browser tabs, with an in-process queue fallback; production needs database transactions and idempotency keys.

Payment success feedback means **a local record was saved**, not that a bank transfer was verified. Existing legacy sample payments have no retained proof/reference/instructions and state that limitation. Some legacy claims lack claimant ownership or selected payout metadata; no real destination is invented to make them payable.

## Demonstrating the integrated workflow

1. Director: create an activity with RM10,000 and explicitly assign Nora as Treasurer.
2. Director: create Multimedia with RM2,000, assign Sarah as HOD and Ava as eligible member.
3. HOD Sarah: select that department and create an assigned RM150 purchasing task.
4. Treasurer Nora: Claim review → Load demo claim → choose that existing task → enter RM190 and an over-budget reason.
5. The fixture explicitly creates fictional receipt/OCR history and a non-payable demo payout snapshot. This is not a real member submission.
6. Start review; inspect original evidence, corrected RM200 → RM190 line, excluded RM8 personal line, justification, and audit.
7. Analyze Risk; inspect RM40 / 26.67% variance and budget headroom. Approve with confirmation, or decline with a reason.
8. For approval, process reimbursement, inspect selected instructions, enter a demo reference/date, upload sample proof, and attest that this is a fictional external transfer record.
9. Confirm recording. History shows RM190 paid, proof available, and member receipt pending. Refresh and revisit the payment route to verify persistence and duplicate blocking.
10. Director/HOD show the same RM190 recorded/paid and RM1,810 department availability. Purchasing progress remains distinct from reimbursement status.

## Components and design

`TreasuryShell`, `ClaimList`, `ReceiptReview`, `ClaimDecision`, `RiskRulesForm`, `ProofPreview`, `DemoClaimLoader`, and financial chart widgets reuse the existing shared primitives. TreasuryProvider isolates scoped DTO state; FormatSettingsContext retains workspace currency/timezone formatting. The centralized Manrope/DM Sans typography, burnt-orange actions, semantic green/amber/red, chart colors, spacing, borders, radii, and shadows remain authoritative. `treasury.css` adds role layouts using existing tokens; no second theme or font system is introduced.

See [verification](VERIFICATION.md), [computed-style evidence](style-audit.json), [route boundary checks](access-route-checks.json), [screenshots](screenshots/overview-preview.png), and [incremental commits](COMMITS.md).
