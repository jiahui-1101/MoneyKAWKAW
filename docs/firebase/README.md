# Firebase foundation (Phase 01)

The app keeps its existing React routes, providers, and design system. Firebase mode supplies authenticated club/activity/department/roster data through a scoped repository adapter. Purchasing, claims, receipts, payouts, reimbursements, notifications and archive commands are **not enabled** in Firebase mode. Empty business arrays are placeholders, not a financial report. No local demo ledger is imported.

## Local setup

Use Node 22 and Java 21+ for the current Firebase Emulator Suite. Install both package trees:

```powershell
npm ci
npm ci --prefix functions
Copy-Item .env.example .env.local
npm run emulators
```

In another terminal, seed only the running local emulators, then start the frontend:

```powershell
$env:GCLOUD_PROJECT='demo-moneykawkaw'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIREBASE_STORAGE_EMULATOR_HOST='127.0.0.1:9199'
npm run emulators:seed
npm run dev
```

The seed refuses missing/non-local hosts and any non-demo project. It creates missing records only; re-running preserves changes and revocations. All identities use example.test and fictional names. Google Sign-In opens the Auth emulator account chooser. Select director@example.test, treasurer@example.test, hod@example.test, member-a@example.test or member-b@example.test. Use an unseeded identity to verify the invitation denial.

By default emulator state is disposable. For local restart persistence, use the Firebase CLI's --import and --export-on-exit options with a directory inside .local. Browser refresh/session restoration does not require an emulator restart. Do not import real personal or payment data.

For the original standalone sample screens set VITE_DATA_MODE=demo explicitly in .env.local and restart Vite. Unit tests explicitly use demo mode. Firebase failures never fall back to mock data. Emulator mode requires the exact demo project and a loopback browser host. Live mode requires VITE_DATA_MODE=firebase plus explicit web configuration; demo project IDs are rejected. The checked-in example contains no live credentials. Never put Admin credentials or secrets in VITE_ variables.

## Membership and authorization

Firebase Auth proves identity. A verified Google provider plus an active clubs/main/members/{uid} record grants club access; login itself never creates membership. The Firebase UID is authoritative. Roles are Director, Treasurer, HOD and Member (the UI's Committee Member).

Club membership and activity grants are server-owned. An approved operator must provision/revoke them using a trusted Admin environment after verifying the user's Google identity/UID. There is no self-service enrollment, role editor or invitation-email workflow in Phase 01. A descriptive department head name does not grant access. Production operator/IAM setup remains an authorized deployment prerequisite.

- Director: club activity/department setup data and sanitized summaries; no private claim evidence, payout secrets or proof.
- Treasurer: global role **and** active per-activity treasurer grant; no automatic access to other activities.
- HOD: global role **and** active departmentRoles[departmentId] containing HOD.
- Member: global role **and** active departmentRoles[departmentId] containing Member; private claims/receipts additionally require ownership.
- Dual roles must be separately assigned. The UI selector contains only backend-returned roles. Every callable repeats authorization; Admin SDK bypasses Rules.

sessionProfile accepts no role/UID assignment input. foundationWorkspace accepts only a requested, already-assigned role; injected UID/department parameters cannot widen scope. It projects safe fields and scoped roster names, never arbitrary documents. Names/IDs of same-department colleagues are coordination data; emails, bank details and other departments are excluded. Each request rechecks live membership/grants. The client watches its own club membership to clear the workspace on club/role revocation. Department changes are enforced on the next server read; existing rendered data refreshes on reload/refresh. Provisioning should increment the club membership revision when scope changes.

Firestore rules deny all unlisted reads/writes. The sole client write is the owner's strict notification preference record. All role, activity, budget and financial writes are denied, even for Director. Storage denies every read/list/create/update/delete until the evidence phase supplies a secure upload/download workflow. Payment secrets have no client read path.

## Canonical schema

All paths below are under clubs/main. Typed contracts are in functions/src/contracts.ts. Document IDs are stable IDs, never names/emails; scope IDs remain immutable. Server records use Firestore Timestamp for createdAt/updatedAt, schemaVersion=1, integer revision and createdBy. DTOs use explicit projections. Seed timestamps are deterministic. MYR amounts use integer sen; budget/allocation projections reject negative, fractional, unsafe or out-of-range amounts.

| Path | Canonical contents |
| --- | --- |
| (club document) | Name, MYR currency, timezone, warning threshold |
| members/{uid} | UID, display name, active, explicit roles, revision, metadata |
| members/{uid}/preferences/notifications | notificationEnabled, server updatedAt |
| members/{uid}/payoutMethods/{id} | Owned masked instructions, institution, secretId, preferred; never raw account numbers |
| members/{uid}/drafts/{id} | Owned activity/department draft and evidence references; reads still require current department scope |
| members/{uid}/notifications/{id} | Owner, title, recordId, readAt; delivery/read commands deferred |
| activities/{aid} | Activity details, integer budget, currency, archive metadata |
| activities/{aid}/members/{uid} | active, treasurer boolean, departmentRoles map; canonical activity authorization |
| activities/{aid}/departments/{did} | activityId, descriptive head/hodUserId, integer allocation |
| activities/{aid}/assignments/{id} | Department, assignee, purpose, integer budget, due date, status, claimId |
| activities/{aid}/claims/{cid} | Claimant, department, assignment, receipt/version, integer amount, review state, destination revision |
| claims/{cid}/versions, decisions, analyses, payments | Immutable evidence/decisions/advice/reimbursement records within the activity; parent claim authorization |
| activities/{aid}/receipts/{rid} | Owner/scope, claimId, object path/generation/hash, ready flag |
| receipts/{rid}/extractions, edits | Immutable original OCR and append-only before/after corrections/exclusions within the activity |
| activities/{aid}/claimSummaries, summaries, audit | Sanitized role-readable summaries and auditable actor/time/changes; no raw payout/receipt data |
| paymentSecrets/{id} | Future encrypted payout instruction revisions; all client access denied |

Department allocation is canonical on the department document, not duplicated in a mutable allocation collection. Future allocation changes must use server transactions and append audit entries. Reimbursements live under their claim; approval and payment remain separate. Full instructions must later be encrypted with managed keys and revealed through a payment-step-authorized function; no raw instruction storage/reveal is implemented here. Archive metadata uses archivedAt, archivedBy, retainUntil and legalHold; there is no TTL/deletion job.

Five composite indexes prepare scoped task due-date, member claim history, review queue, department claim summary and department audit queries. OCR originalText, encrypted ciphertext and audit changes are excluded from indexing. Current foundation queries need only default indexes. Emulator tests do not prove production composite-index deployment or enforcement; validate those in an authorized staging project before rollout.

## Verification and rollout boundary

Stop any running emulators before the isolated test lifecycle:

```powershell
npm run test:firebase
npm run lint
npm run typecheck
npm test
npm run build
```

test:firebase compiles Functions, starts Auth/Firestore/Storage/Functions against the demo project, runs real Rules and callable tests, and shuts down. Rules tests cover direct document/query boundaries, private nested records, role escalation, financial CRUD, preferences, unverified/inactive users and Storage. Callable tests use Auth emulator Google tokens and exercise forged input, uninvited users, scope, revocation, invalid money and idempotent seeds. Session/repository unit tests cover restoration, logout, stale responses, errors and forbidden writes. Browser checks remain part of handoff.

Functions target Node 22, default to us-central1 for local testing, scale to zero and cap at two instances each. FUNCTION_REGION and VITE_FIREBASE_REGION must match an explicitly selected production region. No always-running application server, paid AI/GPU service, payment integration, deployment or billing change is introduced.

Before any separately authorized rollout: select/inspect the Firebase project/database/bucket/region; enable Google Auth and authorized domains; configure operator IAM, rules/indexes and regional functions; decide App Check, encrypted secrets and retention; validate staged OAuth and Rules. .firebaserc, environment files, local reports and the local guidance/requirements remain ignored. Do not deploy the placeholder business views as a complete finance system.
