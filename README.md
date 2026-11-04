# MoneyKAWKAW · Club budget & purchasing workspace

A browser-local Director, HOD, and Treasurer frontend for club activity planning, purchasing, claim review, and reimbursement records. React 19, TypeScript, Vite, and React Router. The Committee Member frontend remains a future phase.

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
- Explicit review start, confirmed approval/decline, mandatory decline reasons, configurable deterministic advisory risk bands, and retained decision snapshots.
- Approved-only payout instructions, masked by default; manual reimbursement recording with file validation, confirmation, preserved proof, and duplicate prevention.
- Centralized payment history, proof viewing, and separate member receipt status. No Treasurer action confirms receipt for a member.

Review → analyze → approve/decline → record an external manual payment with proof → await member confirmation. **Load demo claim** explicitly adds fictional evidence against an existing assigned HOD task; it does not implement member submission. All supplied payout snapshots are fictional and non-payable. See [Treasurer architecture, routes, and demo steps](docs/treasurer/README.md) and [verification evidence](docs/treasurer/VERIFICATION.md).

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
| `/demo` | Explicit local demo profile selection |
| Unknown paths | Useful not-found view |

## Architecture and calculations

- `src/domain`: typed linked activity, department, assignment, expense, payment, history, and settings models; pure budget calculations and setup rules.
- `src/services`: fictional seed records and a versioned localStorage adapter. Mutations validate input and append setup history; storage failures are surfaced before UI state changes.
- `src/context`: shared context identity and async workspace provider. This boundary supports replacing local persistence with API-backed operations while keeping view components.
- `src/components`: `Shell`, `Field`, `DateField`, `Modal`, `Panel`, `Badge`, `Progress`, metrics, charts, financial tables, history, and department workflows.
- `src/pages`: Director routes and isolated HOD/Treasurer route groups.
- `src/styles/tokens.css`: intentional font families, palette, spacing scale, radii, focus color, and shadows. Component, shell, calendar, and responsive page styles use these tokens.

Amounts are integer minor units. Recorded expenses include pending, in-review, and approved claims; declined claims remain in history but leave recorded totals. Remaining = budget − recorded. Committed = open task reservations + approved unpaid amounts. Available = budget − paid − pending − committed. Pending includes in-review claims. A submitted claim replaces its task estimate, preventing double counting; declining it restores the original task reservation. Department allocations cannot exceed the activity ceiling; lowering an activity budget below current allocations is rejected. Reducing an allocation below historical expenses preserves records and visibly flags the resulting overrun.

Currency is configured in `src/services/seed.ts` (MYR by default; MYR/SGD/USD supported). Reset the demo after changing seed configuration. Currency conversion is deliberately unavailable. Timezone and the utilization attention threshold are editable in workspace settings.

## Visual direction

Inspected HolyShip's actual [tokens](https://github.com/mavisbong41/HolyShip/blob/main/frontend/src/styles/tokens.css), [styles](https://github.com/mavisbong41/HolyShip/blob/main/frontend/src/styles/app.css), and [frontend structure](https://github.com/mavisbong41/HolyShip/tree/main/frontend/src). Adapted its compact navigation, warm accents, neutral surfaces, restrained shadows, and status hierarchy. No HolyShip branding or components were copied.

Manrope headings and DM Sans body/UI text are bundled through Fontsource, with no external font request. The custom light palette uses burnt orange actions, deep green financial health, amber attention, red overruns, and restrained chart colors. Only a light theme is supported, explicitly independent of the operating system theme.

## Verification and future integration

See [original Director verification](docs/VERIFICATION.md), [HOD verification and Director regression checks](docs/hod/VERIFICATION.md), [HOD commit history](docs/hod/COMMITS.md), and [HOD screenshots](docs/hod/screenshots/overview-preview.jpg).

This is frontend-only: local demo identity is not authentication, browser storage is not a security boundary, and history is not durable production audit storage. Claims, destinations, receipts, and payments are fictional. Treasurer decisions and manual payment records persist locally; there are no money transfers, live OCR, or trained financial predictions. Historical sample payments lack proof/reference metadata and are labeled accordingly.

The future Member frontend can reuse linked tasks/claims, receipt originals and corrections, payout snapshots, review/payment status, and audit events. Its submission, saved payout methods, receipt confirmation, and discrepancy workflows still need their own ownership checks. Before production, replace mock adapters with authenticated APIs, server-enforced scope, authoritative validation/calculations, transaction-level concurrency, durable append-only history, encrypted payout storage, and protected receipt/proof downloads.

Local `AGENTS.md` and `REQUIREMENTS.md` are ignored and excluded from Git. Nothing has been pushed or deployed as part of this implementation.
