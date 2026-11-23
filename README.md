# MoneyKAWKAW

<p align="center">
  <b>A club budget and expense tracker that connects activity planning, department purchasing, receipt-backed claims, Treasurer review, and verified reimbursement.</b>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Build-Vite%207-646CFF?style=for-the-badge&logo=vite&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Backend-Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white">
  <img alt="Vitest" src="https://img.shields.io/badge/Tests-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white">
  <img alt="Cloudflare Pages" src="https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white">
</p>

<p align="center">
  <a href="https://moneykawkaw.pages.dev/">🌐 Live Deployment</a> ·
  <a href="#main-functions">📊 Main Functions</a> ·
  <a href="#local-development">🛠️ Run Locally</a> ·
  <a href="docs/supabase/README.md">🔐 Supabase Setup & Security</a>
</p>

---

## Table of Contents

- [AIROST Internship Project](#airost-internship-project)
- [Introduction](#introduction)
- [Demo](#demo)
- [Live Deployment](#live-deployment)
- [Main Functions](#main-functions)
- [Role Workflows](#role-workflows)
- [System Flow](#system-flow)
- [Architecture and Access Control](#architecture-and-access-control)
- [Frontend & Backend](#frontend-and-backend)
- [Technical Stack](#technical-stack)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Cloud Deployment](#cloud-deployment)
- [Application Routes](#application-routes)
- [Project Structure](#project-structure)
- [Verification](#verification)
- [Team](#team)
- [Notes for Evaluators](#notes-for-evaluators)

---

## AIROST Internship Project

| Field | Details |
|---|---|
| Project name | MoneyKAWKAW |
| Submission | AIROST Internship Project |
| Project type | Club budget, purchasing, and expense tracking web app |
| Repository contributor | [Wong Jia Hui](https://github.com/jiahui-1101) |

<!-- Add other confirmed team member names here if applicable. -->

## Introduction

Club activities often involve several departments, advance purchases, member reimbursement claims, and a fixed overall budget. MoneyKAWKAW keeps those steps in one auditable workspace. Each activity has a budget; each department receives an allocation; purchasing tasks connect to members, receipts, claims, decisions, and payment records.

The app supports Director, Treasurer, Head of Department (HOD), and Committee Member workflows. Role and activity/department scope are enforced by Supabase policies and authorized database operations, so a hidden button is never the only access check.

## Demo

Open the [MoneyKAWKAW live app](https://moneykawkaw.pages.dev/). Workspace sign-in is invite-only; credentials are not published here.

## Live Deployment

| Resource | Link | Notes |
|---|---|---|
| Web application | [moneykawkaw.pages.dev](https://moneykawkaw.pages.dev/) | Cloudflare Pages frontend. Invite-only workspace access. |
| Source code | [GitHub repository](https://github.com/jiahui-1101/MoneyKAWKAW) | React, TypeScript, and Supabase project. |
| Supabase setup | [Database, authentication, and security guide](docs/supabase/README.md) | Includes local setup and role/access boundaries. |

## Main Functions

- **Activity and budget setup:** Directors create activities, set an overall budget, create departments, assign department access, and review activity and organization-wide financial dashboards.
- **Department purchasing:** HODs manage only departments they are assigned to, create itemized purchasing tasks, set budgets and due dates, and assign work to eligible members.
- **Receipt-backed claims:** Members record purchases, upload or capture receipts, review OCR suggestions, correct or exclude lines with reasons, and submit the reconciled amount with any over-budget explanation.
- **Treasurer review and payment:** Treasurers review authorized claims, inspect evidence and audit history, analyze over-budget requests, approve or decline with a recorded decision, then separately record an external payment and its proof.
- **Member confirmation:** Members see claim and payment status, view proof for their own claim, report a discrepancy, and confirm receipt of payment.
- **Dashboards and traceability:** Activity, department, Treasurer, HOD, and Member views summarize budget stages and link totals back to the underlying tasks, claims, and payments.

## Role Workflows

### Director

- Create and update activities, dates, status, overall budgets, departments, and allocations.
- Explicitly grant HOD and Member access to activity departments.
- Track organization and activity budgets, recorded expenses, reservations, pending claims, utilization, and recent history.
- View financial summaries while claim details remain restricted to authorized claim participants and Treasurers.

### Treasurer

- See only activities for which Treasurer access is explicitly granted.
- Review a searchable claim queue and open original receipts, OCR output, corrections, exclusions, explanations, and claim history.
- Start a review, run an advisory over-budget analysis, and record an approval or decline with a reason where required.
- Access payout instructions at the authorized payment step; details are masked in normal views.
- Record an externally completed payment, attach proof, review payment history, and wait for the Member to confirm receipt.

Approval is a decision, not a payment. Recording a payment does not mark it received by the Member.

### Head of Department (HOD)

- Switch between explicitly assigned activities and departments.
- Create purchasing tasks, define item budgets and due dates, and assign eligible department members.
- Track task progress, department purchasing plans, allocated budget, and recorded spending.
- HODs cannot change the Director’s overall allocations, review or approve claims, or record reimbursements.

### Committee Member

- View personal activities, assigned purchasing work, and permitted department coordination details.
- Manage saved bank or Touch 'n Go payout instructions; values are masked and can be selected for a claim.
- Upload a receipt image or use camera capture, review on-device English OCR, correct line items, and keep excluded lines with reasons in the audit history.
- Submit a claim, follow its review and payment status, view the Treasurer’s proof, and confirm or dispute receipt.

## System Flow

1. The Director creates an activity, sets the overall budget, creates departments, and grants access.
2. The HOD creates a purchasing task with an item budget and deadline, then assigns a Member.
3. The Member buys the item, uploads or captures the receipt, reviews OCR, edits claim lines, and submits the claim.
4. The Treasurer reviews the original evidence and change history, then approves or declines. An over-budget risk analysis is advisory and shows its contributing factors.
5. After approval, the Treasurer separately records the external payment and uploads proof.
6. The Member confirms receipt or records a discrepancy. The activity history and financial totals update from linked records.

## Architecture and Access Control

- Supabase Auth identifies the signed-in user. PostgreSQL row-level security and scoped RPCs enforce role, activity, department, and record ownership on the server.
- Directors configure activity budgets and membership; HODs manage assigned departments; Members access their own claims and payment details; Treasurers access claims and payment instructions only within their explicit activity scope.
- Claim review, payment, and Member receipt confirmation are separate audited events.
- Original receipt files and OCR extraction are preserved. Corrections and excluded lines retain before/after values, actor, time, and reason.
- OCR is a review aid. Over-budget risk results are advisory; the Treasurer makes the approval decision.
- Payout details are payment instructions, not authorization to transfer funds. The app records an external transfer and its proof; it does not initiate bank or wallet payments.
- Dashboard figures are derived from linked activity, department, task, claim, and payment records. Client-submitted totals are not authoritative.
- Archived activities become read-only after reconciliation. Financial archive records remain linked to separately retained receipt files; full recovery also requires database and Storage backups.

### Budget Calculations

Amounts use integer minor units. Recorded expenses include pending, in-review, and approved claims; declined claims remain in history but are removed from recorded totals. Remaining budget is the budget minus recorded expenses. Committed amounts include open task reservations and approved unpaid claims. A submitted claim replaces its task estimate to prevent double counting; declining a claim restores that reservation.

Department allocations cannot exceed the activity budget. Lowering an activity budget below current allocations is rejected. Reducing an allocation below historical expenses preserves the records and shows the resulting overrun.

<a id="frontend-and-backend"></a>

## Frontend & Backend

The repository contains a React frontend and a Supabase-backed data layer; it does not use a separate application-server folder.

| Area | Location | Responsibility |
|---|---|---|
| Frontend application | <code>src/</code> | Role-based pages, dashboards, forms, receipt capture, charts, and navigation |
| Domain rules | <code>src/domain/</code> | Linked records, budget calculations, statuses, and setup validation |
| Data services | <code>src/services/</code> | Supabase repositories/RPC adapters and explicit local demo adapters |
| Database backend | <code>supabase/</code> | SQL migrations, functions, row-level security, and local configuration |
| Automated checks | <code>tests/</code> | Unit, permission, lifecycle, persistence, and integration coverage |

Supabase is the backend for authentication, PostgreSQL persistence, database functions, and access policies. The public frontend uses a publishable key; server-only credentials must never be placed in Vite variables or committed.

## Technical Stack

- **Frontend:** React 19, TypeScript, React Router, and Vite 7.
- **Database and authentication:** Supabase Auth and PostgreSQL with row-level security and RPCs.
- **Receipt capture:** Browser camera/file input and on-device English OCR with Tesseract.js.
- **Testing and linting:** Vitest, TypeScript, and Oxlint.
- **Hosting:** Cloudflare Pages static frontend with security headers emitted by the release build.

## Local Development

Requirements: Node.js and npm. From the repository root:

1. Install dependencies with <code>npm ci</code>.
2. Start the app with <code>npm run dev -- --port 5186</code>.
3. Open the localhost URL printed by Vite.

Useful commands:

| Command | Purpose |
|---|---|
| <code>npm test</code> | Run unit and local application tests; excludes the separate Supabase integration suite. |
| <code>npm run lint</code> | Lint source and tests with Oxlint. |
| <code>npm run typecheck</code> | Run TypeScript without emitting files. |
| <code>npm run build</code> | Typecheck and create a standard Vite build. |
| <code>npm run build:release</code> | Create the constrained production candidate for the authorized hosted Supabase project. |
| <code>npm run test:supabase</code> | Run integration tests against the local Supabase/Docker environment. |

For the database, authentication, seed data, and local Supabase test setup, follow [docs/supabase/README.md](docs/supabase/README.md). Do not use a database reset command against a hosted project.

## Environment Variables

See [.env.example](.env.example) for the variable names and local defaults.

| Variable | Purpose |
|---|---|
| <code>VITE_DATA_MODE</code> | Select the explicit local demo or Supabase data source. |
| <code>VITE_SUPABASE_URL</code> | Supabase project URL used by the client. |
| <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> | Public Supabase publishable/anonymous key for the browser. Never use a server secret here. |
| <code>VITE_LOCAL_TEST_LOGIN</code> | Local-only authentication option; production release disables it. |
| <code>VITE_RECEIPT_MODEL</code>, <code>VITE_PRESSURE_MODEL</code>, <code>VITE_QWEN_MODEL</code> | Optional experimental features; production release forces these off. |

Google OAuth client secrets belong in Supabase provider configuration and must not be exposed to the browser or committed to Git. Use fictional payout details in local demo data.

## Cloud Deployment

The public frontend is hosted on [Cloudflare Pages](https://moneykawkaw.pages.dev/).

For a reviewed production candidate:

1. Set <code>VITE_SUPABASE_URL</code> to the authorized HTTPS Supabase project.
2. Set <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to its public publishable key.
3. Build with <code>npm run build:release</code>.
4. Publish the generated <code>dist/</code> directory to the existing Pages project.
5. Configure the exact HTTPS origin in Supabase Auth redirect allowlists and verify the invited-user sign-in flow.

The release build forces Supabase mode, disables synthetic login and experimental models, copies the supported OCR assets, emits a Content Security Policy and other security headers, and redirects temporary hosted QA routes. Keep secrets out of the static build and repository. Database migrations are reviewed and applied separately from the frontend deployment.

## Application Routes

| Route | Page |
|---|---|
| <code>/</code> | Redirect to the selected role overview |
| <code>/director</code> | Organization overview and budget dashboard |
| <code>/director/activities</code> | Searchable activity portfolio |
| <code>/director/activities/new</code> | Create an activity |
| <code>/director/activities/:id</code> | Activity overview |
| <code>/director/activities/:id/edit</code> | Edit activity details |
| <code>/director/activities/:id/departments</code> | Department setup and allocations |
| <code>/director/activities/:id/budget</code> | Activity budget dashboard |
| <code>/director/activities/:id/map</code> | Activity Money Map |
| <code>/director/budgets</code> | Organization financial breakdown |
| <code>/director/history</code> | Searchable change history |
| <code>/director/settings</code> | Workspace timezone, thresholds, and demo settings |
| <code>/hod</code> | HOD overview |
| <code>/hod/activities/:activityId/departments/:departmentId</code> | Scoped department workspace |
| <code>/treasurer</code> | Treasurer financial overview |
| <code>/treasurer/activities</code> | Authorized activity finances |
| <code>/treasurer/activities/:id</code> | Activity finances and Money Map |
| <code>/treasurer/claims</code> | Searchable claim review queue |
| <code>/treasurer/claims/:id</code> | Claim evidence and review decisions |
| <code>/treasurer/claims/:id/risk</code> | Advisory over-budget analysis |
| <code>/treasurer/claims/:id/reimburse</code> | Approved-only manual payment step |
| <code>/treasurer/reimbursements</code> | Approved, unpaid claims |
| <code>/treasurer/history</code> | Payment history and proof |
| <code>/member</code> | Personal overview |
| <code>/member/activities</code> | Assigned activity/department workspaces |
| <code>/member/activities/:activityId/departments/:departmentId</code> | Scoped roster and purchasing plans |
| <code>/member/tasks</code> | Personal tasks and department coordination |
| <code>/member/tasks/:id</code> | Owned purchase progress or read-only coordination |
| <code>/member/drafts/:id</code> | Receipt and claim submission |
| <code>/member/claims</code> | Own drafts and submitted claims |
| <code>/member/claims/:id</code> | Own evidence, review, and timeline |
| <code>/member/claims/:id/payment</code> | Own payment proof and receipt confirmation |
| <code>/member/accounts</code> | Own saved payout instructions |
| <code>/member/notifications</code> | Personal notifications |
| <code>/demo</code> | Explicit local demo profile selection |

## Project Structure

- <code>src/components/</code> — shared UI, charts, receipt and budget components.
- <code>src/pages/</code> — Director, HOD, Treasurer, and Member workspaces.
- <code>src/services/supabase/</code> — Supabase authentication, repository, and authorized RPC access.
- <code>src/services/</code> — explicit demo seed and local persistence adapters.
- <code>src/domain/</code> — models, budget rules, and pure calculations.
- <code>supabase/migrations/</code> — ordered schema, policy, and database-function migrations.
- <code>tests/</code> — unit and workflow tests.
- <code>docs/</code> — setup and role-specific implementation guides.

## Verification

The current project has unit coverage for role scoping, finance calculations, review/payment lifecycle, receipt history, and dashboard behavior. Run the commands in [Local Development](#local-development) before submitting a change. Supabase integration tests use an isolated local project; do not point test/reset scripts at hosted data.

The release build is designed to reject model weights and environment files. Experimental models are disabled in the static release.

## Team

**Project team:** MoneyKAWKAW
**Repository contributor:** [Wong Jia Hui](https://github.com/jiahui-1101)

<!-- Add any additional confirmed team members and their contributions here. -->

## Notes for Evaluators

- The deployed workspace uses invite-only sign-in. Do not publish or share account credentials in this README.
- Local demo profiles and fixtures are fictional and are not production identities or financial data.
- English OCR suggestions must be reviewed by the Member before submission; OCR does not decide what is claimable.
- Risk analysis is deterministic and advisory. It presents contributing factors but does not approve a claim.
- Reimbursements are manually recorded after an external transfer. There is no bank or Touch 'n Go payment integration.
- Payout details are masked and scoped. Use fictional payment details in local demo mode.
