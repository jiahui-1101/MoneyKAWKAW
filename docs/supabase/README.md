# Supabase foundation

The app now uses Supabase Auth and Postgres for hosted/local foundation data. The four React role views, existing domain `Store`, and HolyShip-inspired UI remain in place. Explicit `VITE_DATA_MODE=demo` is the only browser-local demo mode. A failed Supabase request never falls back to local storage.

## Local setup

1. Install and start Docker Desktop or another Docker-compatible runtime.
2. Copy `.env.example` to `.env.local`. Keep `VITE_DATA_MODE=local`, `VITE_SUPABASE_URL=http://127.0.0.1:54321`, and set the local public key from `npx supabase status -o env`.
3. Run `npm run supabase:start`.
4. Run `npm run supabase:reset` to rebuild only the local database and apply migrations plus synthetic SQL fixtures.
5. Run `npm run supabase:seed` to create synthetic local Auth users and claim their invitations.
6. Run `npm run test:supabase` for the isolated Auth/API/RLS/Storage integration suite. It resets the local database and stops the local stack when finished.
7. Run `npm run supabase:types` to regenerate TypeScript types from the running local schema.

The seed script refuses any non-loopback URL. Test passwords and `.test` email addresses are synthetic and local-only. Never copy them to hosted Auth. Do not add a service-role or secret key to a `VITE_` variable.

## Google OAuth

The local provider is disabled until genuine Google OAuth credentials are supplied. In Google Cloud Console, create a Web OAuth client and register these JavaScript origins: `http://127.0.0.1:5173` and `http://localhost:5173`. Add the local Supabase callback `http://127.0.0.1:54321/auth/v1/callback` as an authorized redirect URI. Put the client ID and secret in ignored `.env.local` as `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, then enable the Google provider in local `supabase/config.toml`.

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
| `member_preferences` | Owner-only notification preference |
| `audit_events`, `archive_records` | Prepared append-only audit and retention metadata; app access is closed |

Purchasing tasks, claim versions/items, receipts/OCR corrections, payout accounts/secrets, reimbursements, notifications, and file metadata are deferred to their own business phases. The current repository maps only allowed foundation rows into the unchanged `Store`; financial arrays are empty and all business writes remain disabled.

## Authorization and integrity

RLS is enabled on every app table. Anonymous reads are revoked. Authenticated roles receive only safe `SELECT`, plus the owner's notification-preference update. Invitation/profile RPCs are no-argument and identity-bound. Scoped helpers live in non-exposed `private`, use a fixed empty search path, and consult active database grants; no user metadata or selected UI role is authoritative.

Director and Treasurer read club foundation data; HOD reads assigned departments and same-department member names; Committee Member reads their own profile/membership and permitted department context. Peer profiles, cross-department data, role grants, invitations, audit/archive records, payment details and evidence remain private. Every privileged hosted function must repeat authorization because service-role credentials bypass RLS.

All monetary columns use integer `bigint` sen with bounded values. Activity currency must match the club. Club currency cannot be relabeled while activities exist. Department allocation changes lock their activity row and reject totals above its budget; activity budget decreases below allocations are rejected. Future business commands must calculate derived totals in a database transaction, lock the activity/claim as appropriate, validate current role/scope/revisions/idempotency, and append an audit event. This phase exposes no such financial write command.

## Storage, retention and AI boundary

`receipts`, `payment-proofs` and `financial-archive` are private buckets with MIME/size limits. Restrictive object policies deny client read/list/upload/replace/delete in this phase. No public URL or file operation is enabled. Future paths should use opaque IDs under club/activity/department/claim, and metadata should retain object generation and a content hash; downloads should use short-lived, server-authorized access.

Activities and `archive_records` carry archive/retention/legal-hold metadata. There is no automatic purge job. Audit/archive tables are inaccessible to clients. Receipt OCR stays in the existing Tesseract browser workflow; no BERT, LightGBM, Qwen, paid GPU, or LLM service is included in this phase. Financial status must not depend on AI inference.

## Migration boundary

The prior Firebase foundation had no configured production project or live data source. Its 27 commits remain in Git history, but Firebase is removed from current runtime/configuration. No Firestore import is needed for synthetic/demo local data. The new migrations are the schema source of truth; they have not been applied to the hosted project. Hosted OAuth, schema rollout, policies, keys, and backups require a separate authorized release step.
