# MoneyKAWKAW · Director workspace

A complete, browser-local Director frontend for club activity planning and financial oversight. React 19, TypeScript, Vite, and React Router. Other role frontends are intentionally not implemented.

## Run locally

```sh
npm ci
npm run dev -- --port 5186
```

Open the printed localhost URL. `npm run build` checks TypeScript and creates `dist/`; `npm run preview -- --port 5186` serves that production build. `npm test` runs the financial and persistence tests. Static hosting must route unknown application paths to `index.html` for deep links.

## Director experience

- Organization dashboard: activity count, overall budgets, recorded expenses, remaining balance, utilization, budget/spending comparison, distribution chart, financial lifecycle balances, and recent history.
- Activity portfolio: search, type/status filters, and sorting with URL-persisted filter state.
- Activity creation and editing: name, description, type, status, dates, and budget; custom keyboard-friendly date calendar and validation.
- Department setup: descriptive lead, description, allocation, search, editing, and confirmed removal. Linked expense/assignment records protect departments from removal.
- Dedicated activity budget dashboards: department contribution, spending and overspending, commitments, pending claims, paid amounts, available balance, and read-only expense source records.
- Responsive navigation, keyboard focus handling, loading skeletons, useful empty states, error/retry recovery, local success feedback, history, help, and workspace preferences.

Create activity → configure departments → allocate budget → open budget dashboard → edit activity. Changes persist across refreshes. Workspace settings can explicitly restore the fictional sample data.

## Routes

| Route | Page |
| --- | --- |
| `/` | Redirect to Director overview |
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
| Unknown paths | Useful not-found view |

## Architecture and calculations

- `src/domain`: typed linked activity, department, assignment, expense, payment, history, and settings models; pure budget calculations and setup rules.
- `src/services`: fictional seed records and a versioned localStorage adapter. Mutations validate input and append setup history; storage failures are surfaced before UI state changes.
- `src/context`: shared context identity and async workspace provider. This boundary supports replacing local persistence with API-backed operations while keeping view components.
- `src/components`: `Shell`, `Field`, `DateField`, `Modal`, `Panel`, `Badge`, `Progress`, metrics, charts, financial tables, history, and department workflows.
- `src/pages`: Director routes and forms only.
- `src/styles/tokens.css`: intentional font families, palette, spacing scale, radii, focus color, and shadows. Component, shell, calendar, and responsive page styles use these tokens.

Amounts are integer minor units. Recorded expenses are pending plus approved claims. Remaining = budget − recorded. Committed = open assignments without a linked claim + approved unpaid amounts. Available = budget − paid − pending − committed. Linked assignment budgets are excluded once a claim exists, preventing double counting. Department allocations cannot exceed the activity ceiling; lowering an activity budget below current allocations is rejected. Reducing an allocation below historical expenses preserves records and visibly flags the resulting overrun.

Currency is configured in `src/services/seed.ts` (MYR by default; MYR/SGD/USD supported). Reset the demo after changing seed configuration. Currency conversion is deliberately unavailable. Timezone and the utilization attention threshold are editable in workspace settings.

## Visual direction

Inspected HolyShip's actual [tokens](https://github.com/mavisbong41/HolyShip/blob/main/frontend/src/styles/tokens.css), [styles](https://github.com/mavisbong41/HolyShip/blob/main/frontend/src/styles/app.css), and [frontend structure](https://github.com/mavisbong41/HolyShip/tree/main/frontend/src). Adapted its compact navigation, warm accents, neutral surfaces, restrained shadows, and status hierarchy. No HolyShip branding or components were copied.

Manrope headings and DM Sans body/UI text are bundled through Fontsource, with no external font request. The custom light palette uses burnt orange actions, deep green financial health, amber attention, red overruns, and restrained chart colors. Only a light theme is supported, explicitly independent of the operating system theme.

## Verification and future integration

See [verification evidence](docs/VERIFICATION.md), [commit history](docs/COMMITS.md), and [screenshots](docs/screenshots/overview-desktop.jpg).

This is frontend-only: local demo identity is not authentication, browser storage is not a security boundary, and history is not durable production audit storage. Sample claims and payments are fictional, read-only records. There are no approval actions, transfers, OCR, payout identifiers, or financial risk predictions.

Future Treasurer, HOD, and Member frontends can reuse the design system and linked models. Before production, introduce authenticated command APIs, server-enforced role/activity/department scope, authoritative monetary validation/calculations, concurrency control, durable append-only history, and protected file/payment data. Preserve the existing distinction between claim review and payment. No other actors' pages should be exposed until those boundaries are implemented.

Local `AGENTS.md` and `REQUIREMENTS.md` are ignored and excluded from Git. Nothing has been pushed or deployed as part of this implementation.
