# Supabase foundation

The app now uses Supabase Auth and Postgres for hosted/local foundation data. The four React role views, existing domain `Store`, and HolyShip-inspired UI remain in place. Explicit `VITE_DATA_MODE=demo` is the only browser-local demo mode. A failed Supabase request never falls back to local storage.

## Local setup

1. Install and start Docker Desktop or another Docker-compatible runtime.
2. Run `npm run supabase:start`.
3. Copy `.env.example` to `.env.local`, run `npm run supabase:status`, and copy its three public frontend values into `.env.local`.
4. Run `npm run supabase:reset` to rebuild only the local database and apply migrations plus synthetic SQL fixtures.
5. Run `npm run supabase:seed` to create synthetic local Auth users and claim their invitations.
6. Run `npm run test:supabase` for the isolated Auth/API/RLS/Storage integration suite. It resets the local database and stops the local stack when finished.
7. Run `npm run supabase:types` to regenerate TypeScript types from the running local schema.

The seed script refuses any non-loopback URL. Test passwords and `.test` email addresses are synthetic and local-only. Never copy them to hosted Auth. Do not add a service-role or secret key to a `VITE_` variable.

## Google OAuth

The local provider is disabled until genuine Google OAuth credentials are supplied. In Google Cloud Console, create a Web OAuth client and register these JavaScript origins: `http://127.0.0.1:5173` and `http://localhost:5173`. Add the local Supabase callback `http://127.0.0.1:54321/auth/v1/callback` as an authorized redirect URI. Provide the client ID and secret to the local Supabase CLI process as `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, then enable the Google provider in local `supabase/config.toml`. Do not prefix either secret with `VITE_`.

For hosted OAuth, configure Authentication → Providers → Google in the created project and add the exact hosted callback shown by Supabase to the Google OAuth client. The project callback is `https://mqklyfboywbxcexdttrl.supabase.co/auth/v1/callback`. Also allow the app's final origin in Supabase redirect URLs and Google JavaScript origins. Never invent credentials; actual Google sign-in remains unverified until an authorized operator supplies them.

## Schema and relationships

All app tables are under the exposed `public` schema and use UUID keys. `auth.users` is the identity source; `profiles` contains only a display name. A club membership gates every scope. Club role grants assign Director/Treasurer; activity memberships link users to activities; activity role grants support an explicit activity Treasurer; department memberships assign HOD/Member to one department. Invitations store normalized email and trusted, scoped role grants. The no-argument invitation RPC reads the verified Auth user's email and never accepts a role, user ID, or department from the browser.

| Entity | Relationship and purpose |
| --- | --- |
| `clubs` | Club currency, time zone and warning threshold |
| `profiles`, `club_memberships` | Minimal member profile and active/suspended/revoked gate |
| `invitations`, `invitation_role_grants` | Expiring trusted invitation with club/activity/department role scopes |
| `club_role_grants`, `activity_role_grants` | Explicit Director/Treasurer grants |
| `activities`, `departments` | Activity budget and canonical integer-sen department allocations |
| `activity_memberships`, `department_memberships` | Activity relation and explicit HOD/Member department grants |
| `purchase_tasks` | HOD-authored purchasing plans linked to activity, department, and assigned member; estimates are integer sen |
| `member_preferences` | Owner-only notification preference |
| `claims`, `claim_items`, `claim_receipts`, `receipt_modifications` | Claims with preserved original evidence, source OCR and correction history |
| `payment_accounts`, `claim_payment_destinations` | Private owner instructions and protected per-claim snapshots |
| `reimbursement_payments`, `payment_proofs` | One recorded payment per claim, preserved proof and separate receipt confirmation |
| `activity_reconciliations`, `activity_closing_decisions` | Immutable signed financial snapshots and independent Director decisions |
| `audit_events`, `archive_records` | Scoped append-only history and private verified archive/retention metadata |

The existing `Store` remains the UI boundary. Activities, assignments, permitted claims, recorded payments, masked destinations, notifications and financial summaries load from Supabase. Receipt details load on demand. Purchasing estimates reserve funds. A submitted claim replaces that reservation, approval creates unpaid liability, and payment becomes expenditure once. Received confirms the existing payment.

## Authorization and integrity

RLS is enabled on every app table. Anonymous reads are revoked. Authenticated roles receive only safe `SELECT`, plus the owner's notification-preference update. Invitation/profile RPCs are no-argument and identity-bound. Scoped helpers live in non-exposed `private`, use a fixed empty search path, and consult active database grants; no user metadata or selected UI role is authoritative.

Director saves activity/department setup and oversees aggregate finances. HOD manages assigned departments and eligible purchasing assignments. Members update their own tasks and claims and see their own payment evidence. An independent Treasurer reviews submitted claims and records reimbursements with proof. The payment-step RPC reveals full instructions only for an authorized approved unpaid claim. Every privileged Edge Function repeats authorization because elevated server credentials bypass RLS.

All monetary columns use bounded integer `bigint` sen. Currency cannot be relabeled while activities exist. Allocations, effective task/claim exposure, allowed transitions, approved payment amounts, proof metadata and idempotency are checked in locked database transactions. Closing blocks new financial obligations. Signed reconciliation freezes financial writes, and a different authorized Director must approve the archive.

## Storage, retention and AI boundary

`receipts`, `payment-proofs` and `financial-archive` are private. Receipt/proof staging validates ownership, opaque path, declared MIME and size. Finalized originals cannot be overwritten or deleted by application users. Authorized evidence uses short-lived signed URLs, which remain usable until expiry. File safety scanning is incomplete. Archive access passes through the authenticated `activity-archive` Edge Function, which reads and hashes the actual gzip and referenced original bytes.

Activities and `archive_records` carry retention/hold metadata. Cleanup is a non-destructive preview of abandoned, unfinalized staging. Archive reports enforce current scope. OCR runs locally with human review. Optional BERT, synthetic-trained LightGBM and local Qwen are experimental. All are disabled in `npm run build:release`. SQL remains authoritative for financial decisions.

## Static release candidate

Use `npm run build:release` with the authorized hosted project URL and public key in an ignored release environment. It generates `dist` with OCR assets and a Cloudflare Pages `_headers` policy. Configure final HTTPS origin, exact Supabase redirect allowlist and real Google provider credentials separately. The Google secret belongs in Supabase provider configuration. A Google identity still requires a trusted invitation and current grants.

Before real financial use, assign backup ownership and independently retain the database, original Storage bytes, configuration and encryption recovery keys. Test restore and RLS against a disposable destination. The per-activity gzip reconstructs a financial projection and depends on those originals.

## Migration boundary

The prior Firebase foundation had no configured production project or live data source. Its commits remain in Git history, but Firebase is removed from current runtime/configuration. No Firestore import is needed for synthetic/demo local data. The migrations are the schema source of truth; they have not been applied to the hosted project. `npm run test:supabase` rebuilds the local database, provisions synthetic users, runs Auth/API/RLS/Storage and purchasing checks, then stops the local stack. Hosted OAuth, schema rollout, policies, keys, and backups require a separate authorized release step.
