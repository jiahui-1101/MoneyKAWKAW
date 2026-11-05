# MoneyKAWKAW · Club budget & purchasing workspace

A Director, HOD, Treasurer, and Committee Member frontend with an invite-only Firebase foundation. React 19, TypeScript, Vite, and React Router. Firebase mode enables Google sign-in and scoped club/activity/department/roster reads; business commands remain disabled until later phases.

Follow the [Firebase setup, schema, security boundaries and emulator guide](docs/firebase/README.md) first. The feature descriptions below describe the original explicit demo mode; they are not a claim that financial modules are Firebase-backed.

## Run locally

```sh
npm ci
npm run dev -- --port 5186
```

Open the printed localhost URL. `npm run build` checks TypeScript and creates `dist/`; `npm run preview -- --port 5186` serves that production build. `npm test` runs financial, permission, lifecycle, and persistence tests. `npm run lint` checks source/tests with Oxlint; `npm run typecheck` runs TypeScript separately. Static hosting must route unknown application paths to `index.html` for deep links.

## Director experience

- Organization dashboard: activity count, overall budgets, recorded expenses, remaining balance, utilization, budget/spending comparison, distribution chart, financial lifecycle balances, and recent history.
- Activity portfolio: search, type/status filters, and sorting with URL-persisted filter state.
- Activity creation and editing: name, description, type, status, dates, and budget; custom keyboard-friendly date calendar and validation.
- Department setup: descriptive lead, description, allocation, search, editing, and confirmed removal. Linked expense/assignment records protect departments from removal.
- Dedicated activity budget dashboards: department contribution, spending and overspending, commitments, pending claims, paid amounts, available balance, and read-only expense source records.
- Responsive navigation, keyboard focus handling, loading skeletons, useful empty states, error/retry recovery, local success feedback, history, help, and workspace preferences.

Create activity → configure departments → allocate budget → open budget dashboard → edit activity. Changes persist across refreshes. Workspace settings can explicitly restore the fictional sample data.

## HOD experience

Use the **Demo profile** selector or open `/demo` to explicitly choose an identity. Sarah, Amir, and Mei each have department-specific memberships; descriptive department lead names alone do not grant access. These are local demo identities, not production authentication.

- Department dashboards, activity/department switching, procurement progress, deadlines, and financial summaries.
- Purchasing task creation, eligible-member assignment, reassignment, editing, progress tracking, and confirmed cancellation.
- A searchable task board, member workload views, item-budget tracking, claim variances, read-only reimbursement monitoring, and department history.
- Shared Director/HOD data and persistence, additive migration of existing records, and role/scoped service checks. Director department setup now includes explicit HOD/member access assignment; activity budget pages show shared purchasing plans read-only.

Select department → create purchasing task → assign member → set budget/deadline → save → review dashboard → edit/track progress. HODs cannot change Director allocations, approve claims, or record payments. See the [complete HOD route map, financial rules, and integration notes](docs/hod/README.md).

## Treasurer experience

Select **Nora Lim · Treasurer demo**. Activity oversight must be explicitly granted in Director activity setup; the sample Leadership Retreat is outside Nora’s scope.

- Financial dashboard, budget/spending charts, claim status distribution, activity and department breakdowns, and over-budget alerts.
- Searchable claim queues with status tabs, amount/date sorting, and activity/department/member/date filters.
- Immutable original receipt, annotated claim lines, retained OCR suggestions and edit/exclusion history, justifications, and claim audit history.
- Explicit review start, confirmed approval/decline, mandatory decline reasons, configurable deterministic advisory risk bands, and retained decision snapshots. Over-budget approval requires renewed analysis if financial context changes after review.
- Approved-only payout instructions, masked by default; manual reimbursement recording with file validation, confirmation, preserved proof, and duplicate prevention.
- Centralized payment history, proof viewing, append-only discrepancy resolution notes, and separate member receipt status. No Treasurer action confirms receipt for a member.

Review → analyze → approve/decline → record an external manual payment with proof → await member confirmation. The optional **Load demo claim** tool adds clearly fictional fixtures; Members now submit their own uploaded receipt evidence through their separate workspace. Use fictional payout details throughout this local demo. See [Treasurer architecture and routes](docs/treasurer/README.md) and the [current four-role verification](docs/member/VERIFICATION.md).

## Committee Member experience

Select **Ava Chen**, **Ryan Lee**, or **Grace Lim · Member demo**. Active department membership and task ownership determine access.

- Personal dashboard, assigned activities/departments, searchable purchasing tasks, department coordination, and owned purchase progress.
- Bank/TNG destination CRUD with masking, default selection, protected removal, per-claim snapshots, and separately audited unpaid destination changes.
- Persisted receipt drafts, original PNG/JPEG upload or camera input, actual on-device English OCR, and explicit manual fallback.
- Retained source image/text, quantity/price corrections, missing lines, tax/discount treatment, exclusions with reasons, comparison views, and reconciled derived claim amounts.
- Over-budget justification, confirmed submission, shared Treasurer review status, decisions, proof viewing, payment discrepancies, and one-time receipt acknowledgment.
- Event-derived notifications with persistent read state, responsive navigation, keyboard focus, loading, error/retry, and empty states.

Director setup → HOD assignment → Member purchase/receipt/submission → Treasurer review/payment proof → Member confirmation. See the [Member route map, architecture, OCR assets, and API readiness](docs/member/README.md).

## Routes

| Route | Page |
| --- | --- |
| `/` | Redirect to the selected role’s overview |
| `/director` | Organization overview |
| `/director/activities` | Searchable activity portfolio |
| `/director/activities/new` | Activity creation |
| `/director/activities/:id` | Activity overview |
| `/director/activities/:id/edit` | Activity editing |
| `/director/activities/:id/departments` | Department setup and allocations |
| `/director/activities/:id/budget` | Activity budget dashboard |
| `/director/budgets` | Organization financial breakdown |
| `/director/history` | Searchable/filterable change history |
| `/director/settings` | Timezone, attention threshold, demo reset |
| `/hod` | HOD workspace overview |
| `/hod/activities/:activityId/departments/:departmentId` | Department overview and scoped purchasing pages |
| `/treasurer` | Financial overview |
| `/treasurer/activities` | Authorized activity finances |
| `/treasurer/activities/:id` | Activity financial details |
| `/treasurer/claims` | Searchable claim review queue |
| `/treasurer/claims/:id` | Claim evidence and review decisions |
| `/treasurer/claims/:id/risk` | Advisory budget/risk analysis |
| `/treasurer/claims/:id/reimburse` | Approved-only manual payment step |
| `/treasurer/reimbursements` | Approved, unpaid claims |
| `/treasurer/history` | Payment history and proof |
| `/member` | Personal overview |
| `/member/activities` | Assigned activity/department workspaces |
| `/member/activities/:activityId/departments/:departmentId` | Scoped roster and public purchasing plans |
| `/member/tasks` | Own tasks and department coordination |
| `/member/tasks/:id` | Owned purchase progress or read-only coordination |
| `/member/drafts/:id` | Receipt, items, comparison, and submission wizard |
| `/member/claims` | Own drafts and submitted claims |
| `/member/claims/:id` | Own evidence, review, destination, and timeline |
| `/member/claims/:id/payment` | Own proof, discrepancy, and receipt acknowledgment |
| `/member/accounts` | Own saved Bank/TNG instructions |
| `/member/notifications` | Event-derived personal notifications |
| `/demo` | Explicit local demo profile selection |
| Unknown paths | Useful not-found view |

## Architecture and calculations

- `src/domain`: typed linked activity, department, assignment, expense, payment, history, and settings models; pure budget calculations and setup rules.
- `src/services`: fictional seed records and a versioned localStorage adapter. Mutations validate input and append setup history; storage failures are surfaced before UI state changes.
- `src/context`: shared context identity and async workspace provider. This boundary supports replacing local persistence with API-backed operations while keeping view components.
- `src/components`: `Shell`, `Field`, `DateField`, `Modal`, `Panel`, `Badge`, `Progress`, metrics, charts, financial tables, history, and department workflows.
- `src/pages`: Director routes and isolated, lazily loaded HOD/Treasurer/Member route groups.
- `src/styles/tokens.css`: intentional font families, palette, spacing scale, radii, focus color, and shadows. Component, shell, calendar, and responsive page styles use these tokens.

Amounts are integer minor units. Recorded expenses include pending, in-review, and approved claims; declined claims remain in history but leave recorded totals. Remaining = budget − recorded. Committed = open task reservations + approved unpaid amounts. Available = budget − paid − pending − committed. Pending includes in-review claims. A submitted claim replaces its task estimate, preventing double counting; declining it restores the original task reservation. Department allocations cannot exceed the activity ceiling; lowering an activity budget below current allocations is rejected. Reducing an allocation below historical expenses preserves records and visibly flags the resulting overrun.

Setup saves use a revision check to reject stale Director snapshots. Background storage updates preserve filters and in-progress forms; setup forms retain their opening revision and require reload if another setup edit intervenes. Reimbursement recording requires the reviewed destination revision. A Member destination change closes an old payment confirmation and requires the Treasurer to review/reconfirm current instructions; it does not redirect an existing payment.

Currency is configured in `src/services/seed.ts` (MYR by default; MYR/SGD/USD supported). Reset the demo after changing seed configuration. Currency conversion is deliberately unavailable. Timezone and the utilization attention threshold are editable in workspace settings.

## Visual direction

Inspected HolyShip's actual [tokens](https://github.com/mavisbong41/HolyShip/blob/main/frontend/src/styles/tokens.css), [styles](https://github.com/mavisbong41/HolyShip/blob/main/frontend/src/styles/app.css), and [frontend structure](https://github.com/mavisbong41/HolyShip/tree/main/frontend/src). Adapted its compact navigation, warm accents, neutral surfaces, restrained shadows, and status hierarchy. No HolyShip branding or components were copied.

Manrope headings and DM Sans body/UI text are bundled through Fontsource, with no external font request. The custom light palette uses burnt orange actions, deep green financial health, amber attention, red overruns, and restrained chart colors. Only a light theme is supported, explicitly independent of the operating system theme.

## Verification and future integration

See [original Director verification](docs/VERIFICATION.md), [HOD verification and Director regression checks](docs/hod/VERIFICATION.md), [HOD commit history](docs/hod/COMMITS.md), and [HOD screenshots](docs/hod/screenshots/overview-preview.jpg).

This is frontend-only: local demo identity is not authentication, browser storage is not a security boundary, and history is not durable production audit storage. Use fictional financial information. Treasurer decisions, manual payment records, and Member acknowledgments persist locally. There are no money transfers, external transfer verification, or trained financial predictions. English receipt OCR runs in the browser using locally served Tesseract assets and needs human review. Historical sample payments lack proof/reference metadata and are labeled accordingly.

The four frontends share linked tasks/claims, immutable submitted receipts, corrections, payout snapshots, review/payment status, and audit events. Before production, replace mock adapters with authenticated APIs, server-enforced ownership/scope, authoritative validation/calculations, transaction-level concurrency, durable append-only history, encrypted payout storage, and protected receipt/proof downloads. OCR assets are prepared automatically before dev/build from locked dependencies; see the Member notes for footprint and limitations.

Local `AGENTS.md` and `REQUIREMENTS.md` are ignored and excluded from Git. Nothing has been pushed or deployed as part of this implementation.
