# HOD verification report

Verification completed 5 November 2026, Asia/Singapore. Browser checks used the actual localhost application in the in-app browser.

## Technical checks

- `npm run build`: TypeScript and Vite production build passed.
- `npm test`: 39 tests passed across four files: 21 original Director tests and 18 HOD domain/service tests.
- `npm audit`: zero vulnerabilities; no dependencies were added for the HOD implementation.
- Final fresh browser session: zero console warnings/errors, recorded in `browser-console.json`.
- Source scan found no Times New Roman, Arial/system-ui primary fonts, starter logos/colors, or default-blue link declarations.
- Local `AGENTS.md` and `REQUIREMENTS.md` remain ignored and untracked; no push or deployment was performed.

## Functional browser evidence

| Workflow | Result |
| --- | --- |
| Required fields and budget limit | Empty task rejected; RM4,801 rejected against RM4,800 purchasing capacity; form values remained available for correction |
| Create and assign | RM80 HDMI task assigned to Ava; planned budgets became RM7,080 and available funds RM4,720 |
| Edit/reassign | Changed item estimate to RM100, assignee to Ryan, and due date; details updated correctly |
| Track progress | Not Started → In Progress → Purchased → Completed; no claim, approval, or payment was created |
| Refresh persistence | Saved assignment, item budget, ownership and purchasing status survived a full page reload |
| Cancel | Confirmation could be dismissed; confirmed cancellation preserved the record and history |
| Existing claim protection | Direct edit URL for the submitted sample claim showed a protected state with no editing controls |
| Cross-department access | Foreign department, mismatched activity/department, and foreign task identifiers were denied without exposing their records |
| Role boundary | HOD direct navigation to `/director` showed Director access required |
| Members and task filters | Member workload links, search/no-match/clear states, unassigned tasks, department switching, and over-estimate filtering worked |
| Review versus payment | Pending review, approved-unpaid, and paid fictional records were separately displayed under the correct HOD profiles |
| Mobile interaction | Keyboard navigation, focus restoration, custom due-date calendar, unsaved-change confirmation, Escape dismissal, and wide-table hints worked |
| HOD revocation | Director removed Amir's explicit assignments; Amir saw No departments assigned despite unchanged descriptive lead names |

## Director → HOD → Director integration

Created a disposable Director activity with an overall RM3,000 budget and a Multimedia department allocated RM2,000. Explicitly assigned Sarah as HOD and Ava as an eligible member.

Sarah's HOD workspace showed that same activity, department and RM2,000 allocation. Its assignee list contained only Sarah and Ava. Created an RM80 HDMI purchase, refreshed, and confirmed persistence. The HOD department showed RM1,920 available; the Director's shared purchasing table showed the same task, owner, item estimate and RM80 reservation. The activity-level Director balance was RM2,920 because the overall activity still had RM1,000 unallocated to departments.

Saved `shared-director-budget.jpg` and `shared-hod-department.jpg` capture this workflow. Disposable test data and revocations were then cleared through the explicit Director demo-reset action, restoring the sample workspace.

## Automated data and access tests

Tests cover role rejection, activity/department scoping, allowlisted DTOs, foreign/inactive assignees, financial reconciliation, invalid money and dates, item budget ceilings, reassignment, claim-linked protection, invalid status transitions, stale edits, completion without payment, cancellation reservations, idempotent legacy migration, original Director totals, shared persistence, revoked memberships, identity changes during reads, empty authorized workspaces, and storage write failures.

## Rendered style and responsive audit

- Ten HOD page variants × four widths (320, 390, 820, 1440): 40 checks passed.
- Ten Director page variants × the same widths: 40 regression checks passed.
- Checked document width against usable client width, including scrollbar space. Also checked monetary summary text against card widths. No overflow remained in the final 80 checks.
- Computed text/control font families matched Manrope Variable and DM Sans Variable. Both primary font files were verified loaded with `document.fonts.check`.
- No default-blue links or unintended native control appearances remained. Computed canvas, text and border colors were inspected. Keyboard focus was observed; hover, selected, active, disabled, loading and error styles were reviewed in CSS.
- Improved violet badge contrast to 4.95:1 against its soft background, and changed chart-label text to the shared muted foreground while retaining colored markers.
- Reviewed saved desktop and mobile screenshots for dashboard, task board, creation form, protected claim-linked details, member workload, financial monitoring, and budget variance pages.

Raw evidence: `style-audit.json`, `director-regression-audit.json`, `access-route-checks.json`, `browser-console.json`, and `screenshots/`.

## Fixes discovered during verification

Corrected a nullable protected-task reference, preserved form state on validation failure, made fixture audit IDs idempotent during migration, kept purchased items separate from overdue buying tasks, improved status contrast, highlighted invalid member selections, added table-scroll guidance, and resolved currency values overflowing narrow summary cards. Long activity/department labels now wrap within the responsive layout.

## Limits

This is a frontend and mock-service implementation. Role and scope checks demonstrate intended permissions but cannot secure browser storage or replace backend authorization. Cross-tab storage is synchronized but is not a production transaction system. Corruption/quota failures were exercised in automated service tests rather than forcing browser storage settings. Browser QA used the in-app browser; Safari/Firefox/device testing and a full screen-reader certification were not performed. Sample claims/payments are explicitly fictional, and no real approval, transfer, OCR or risk analysis was performed.
