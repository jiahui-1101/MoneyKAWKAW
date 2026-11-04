# Member frontend commit history

Branch: `codex/member-frontend`.

Implementation and verification snapshot through `e94b5e1`, starting after Treasurer baseline `e90b820`.

Each behavior/enabling milestone was committed separately. Handwritten implementation increments stayed within the local 150-line ceiling; the explicit formatting-only commits expand the already committed compact source into project formatting. Generated lockfiles, screenshots, and audit JSON are separate from handwritten implementation.

```text
3630d2b feat(member): extend shared models for owned drafts accounts and receipt confirmation
3f495a2 feat(member): centralize receipt quantities charges and private-store boundaries
2bb753e feat(member): enforce scoped coordination views and private record ownership
8d82e95 feat(member): manage owned payout accounts without redirecting submitted claims
9c51c8b feat(member): persist owned claim drafts and immutable extraction baselines
d277d49 feat(member): retain receipt corrections exclusions and added-line provenance
815bdd9 feat(member): submit linked receipt-backed claims and controlled payout snapshots
d0b75a6 feat(member): reconcile signed charges and preserve receipt history across review
1bcb4b7 feat(member): validate persistent private records and owned account references
2622980 feat(member): update owned purchases and acknowledge or dispute recorded payments
1099142 feat(member): derive notifications from actual assignments claims and payment events
2561329 feat(member): bundle browser OCR worker and language assets locally
25aabc9 feat(member): recognize uploaded receipt text on device with manual fallback
017d1a7 feat(member): reuse receipt comparison for uploaded sources quantities and discounts
d4c232c feat(member): add isolated workspace state and responsive role navigation
4d6a51a feat(member): show owned tasks and read-only department coordination
adc135a feat(member): build personal dashboard activities and department overviews
1864edb feat(member): manage own purchasing progress and start linked claim drafts
e9dc9e1 feat(member): add masked bank and wallet preference management
2fc29fe feat(member): capture OCR or explicit manual receipt source values
7b06d46 feat(member): upload immutable receipt images with real OCR and manual capture
81da94c feat(member): edit receipt quantities amounts exclusions and reviewed totals
99d5abb feat(member): reconcile claimable items and confirm budget-aware submissions
1fc18b5 feat(member): navigate receipt preparation own claims and persistent notifications
4089e45 feat(member): track private claim evidence decisions and auditable destination changes
a133bce feat(member): view own proof and explicitly confirm or dispute receipt
2682c93 feat(member): connect all Member routes and explicit demo identities
c175989 style(member): extend shared tokens for receipt workflows and responsive views
635ab98 fix(member): retain validation feedback and load role workspaces on demand
6927223 fix(integration): surface member receipt acknowledgments and retained payment issues
35f9352 fix(member): keep reassigned drafts private without blocking the new assignee
74d5912 fix(integration): describe restricted payment events accurately
7472508 test(member): verify receipt parsing reconciliation and immutable corrections
10bd339 test(member): enforce account claim and reassigned draft ownership
db3db00 test(member): exercise four-role submission payment and receipt lifecycle
ab4d651 test(member): align assertions with retained ledger status labels
b2fec29 style(member): format the Member workspace with project conventions
53fedaf test(member): type the receipt fixture as a supported proof file
440ddc5 fix(member): prevent checkbox style collisions and clarify receipt draft labels
bd5c357 fix(member): constrain payment grids on narrow mobile screens
7700544 fix(member): wrap long discrepancy badges within mobile cards
eeae614 fix(privacy): redact private payment event details from Director views
51dae76 test(member): verify duplicate submission and audited destination replacement
c02dd30 style(tests): format Member submission coverage
6af6f0b fix(member): show receipt-specific unsupported upload feedback
b4a8565 docs: describe the integrated four-role frontend and Member routes
3c56f18 fix(member): keep activity department and claim identity visible through review
07c8afa docs(member): document workflows OCR assets ownership and API readiness
e94b5e1 docs(member): record browser workflow responsive audits and visual evidence
```

The commit containing this history file follows this snapshot. No commits were pushed. Local AGENTS.md and REQUIREMENTS.md remain ignored and untracked.
