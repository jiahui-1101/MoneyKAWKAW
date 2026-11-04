# HOD frontend

Complete department-scoped purchasing management integrated with the existing Director workspace. No Treasurer or Committee Member frontend is implemented.

## Start and choose a profile

Run `npm ci` then `npm run dev -- --port 5186`. Open `/demo` or use the shared **Demo profile** selector. Profile selection is explicit and persists within the browser tab's session.

| HOD demo profile | Assigned departments |
| --- | --- |
| Sarah Tan | Innovation Summit / Programme; Annual Appreciation Dinner / Programme |
| Amir Hassan | Innovation Summit / Logistics; Design Thinking Workshop / Logistics |
| Mei Wong | Design Thinking Workshop / Programme; Leadership Retreat / Operations |

The Director can assign an HOD and eligible members while creating or editing a department. HODs see only explicitly assigned departments. The assigned HOD is also eligible to take purchasing work in that department.

## Implemented pages and routes

Let **D** mean `/hod/activities/:activityId/departments/:departmentId`.

| Route | Behavior |
| --- | --- |
| `/hod` | Assigned activities, contextual department finances, task counts, procurement flow, expense overview, deadlines, recent changes |
| **D** | Department description, Director allocation, procurement and financial overview |
| **D**`/tasks` | Search, purchasing status, member and priority filters; overdue/unassigned/awaiting-purchase/purchased-no-claim shortcuts |
| **D**`/tasks/new` | Item, description, eligible assignee, due date, priority, validated estimated budget |
| **D**`/tasks/:taskId` | Purchase details, progress updates, cancellation confirmation, claim/payment visibility, history |
| **D**`/tasks/:taskId/edit` | Edit or reassign an unsubmitted purchase; submitted and cancelled records are protected |
| **D**`/members` | Scoped roster, responsibilities, workload and completion counts, member-filtered task links |
| **D**`/budget` | Planned versus recorded spending, available capacity, commitments, item variances and over-estimate filter |
| **D**`/expenses` | Read-only submitted amounts, review state, paid/unpaid monitoring, variances, purchased items without claims |
| **D**`/history` | Searchable department audit events and before/after details |
| `/demo` | Explicit fictional role/profile chooser |

Unknown routes, forged department/activity combinations, out-of-scope tasks, unassigned HODs, loading, validation failures, storage errors, and successful writes have distinct UI states. All visible actions are connected to navigation or validated services.

## Reused and new components

Reused the Director fonts, palette, spacing, radii, shadows, sidebar classes, `Panel`, `PageHeader`, `Badge`, `Status`, `Progress`, `Field`, `DateField`, `Modal`, and `Skeleton`. Extracted `MetricCards` and `ToastMessage` for both roles; `useFormat` accepts scoped settings without loading the Director store into an HOD view.

New components include `HodShell`, `DemoRoleSwitcher`, `RoleGate`, `DepartmentAccessFields`, shared purchasing widgets, workload cards, and the read-only Director `SharedPurchasingPlans` table. Navigation supports mobile focus containment, inert offscreen navigation, Escape, and focus restoration. Wide tables are keyboard-focusable and include a phone scrolling hint.

`src/styles/hod.css` uses the existing design tokens. No new fonts or independent palette were introduced. The existing violet foreground was darkened to make status text readable; the same token applies to both roles. Only the existing intentional light appearance is supported.

## Shared data integration

The storage key remains `moneykawkaw.director.v1`. Activities, departments, assignments, expenses, payments, and events are the same underlying records used by both roles. An idempotent additive migration adds an explicit club directory, scoped memberships, purchasing metadata, and linked sample purchase plans to legacy Director data. Existing budgets and financial totals remain unchanged.

The HOD provider receives an allowlisted `HodSnapshot`, not the complete Director store. Authorized activity summaries omit overall budgets and unrelated departments. Directory users, task/expense/payment records, and events are filtered to assigned scopes. Sensitive or unknown expense/payment/user fields are not copied into HOD DTOs.

`hodService` exposes scoped reads and purchasing-specific commands, not a generic store save. Every command reloads current shared data and rechecks role, activity, department, membership, assignee eligibility, expected task version, and budget constraints before persistence. Director service operations reject HOD identities. Profile changes during an asynchronous read are rejected.

New HOD task and membership changes produce department-linked audit events. Ordinary HOD controls cannot edit or delete history. Fixture history is explicitly labeled fictional. Director history and the Director activity budget table reflect the same purchasing changes.

## Financial rules

All amounts use integer minor units. Calculated totals are not editable.

- **Planned item budgets:** sum of task estimates except cancelled tasks, including estimates for linked claims.
- **Recorded spending:** actual pending and approved shared expense amounts; never inferred from purchasing stage.
- **Open purchasing reservations:** unclaimed task estimates except cancelled tasks. Completed purchases without claims remain reserved.
- **Remaining after expenses:** department allocation − recorded spending.
- **Available for purchases:** allocation − recorded spending − open purchasing reservations.
- **Committed:** open purchasing reservations + approved-but-unpaid claim amounts.
- **Maximum new item estimate:** the smaller of available funds and allocation − planned estimates. Editing replaces the existing estimate rather than counting it twice.
- **Variance:** recorded claim − item estimate. Positive values flag overspending; only the Treasurer can review or decide a claim.
- **Utilization:** recorded spending / department allocation. Zero-budget states stay finite and show explicit overspending when applicable.

Purchasing stages are Not Started, In Progress, Purchased, Claim Submitted, Completed, and Cancelled. HODs cannot manufacture Claim Submitted; that stage requires a linked claim record. Claim-linked tasks cannot be edited, reassigned, or cancelled. Marking a purchase Completed never creates an approval or payment. Buying deadlines are overdue only while Not Started or In Progress; purchased items awaiting a claim are tracked separately.

## Verification and future Member readiness

See [verification evidence](VERIFICATION.md), [commit history](COMMITS.md), and the screenshots in this directory.

The Member frontend can reuse scoped memberships, task owners, deadlines, purchasing stages, financial calculations, expense references, and the same UI components. It must add its own service boundary: read department assignments but edit only owned/delegated tasks, preserve receipt originals and OCR correction history, submit validated claims, protect payout methods, and separate confirmation from payment recording. Do not expose HOD command permissions through a Member screen.

Production authentication, trusted server principals, server-side authorization/validation, durable audit storage, concurrency control, secure receipt/payment files, and payout-data protection remain future backend work. The local demo role chooser and editable browser storage are not security boundaries. No OCR, approval, risk-review, payment execution, or Member/Treasurer UI is presented as implemented.
