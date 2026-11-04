# Committee Member workspace

The Member frontend extends the existing Director, HOD, and Treasurer product. It uses the same local ledger, financial rules, custom light theme, DM Sans body/UI text, Manrope headings, and shared controls. HolyShip's actual token source was inspected again; no branding or components were copied.

## Routes

| Route | Behavior |
| --- | --- |
| `/member` | Personal metrics, deadlines, department purchasing progress, claims, notifications |
| `/member/activities` | Search assigned activity/department workspaces |
| `/member/activities/:activityId/departments/:departmentId` | Active department roster and public purchasing plans |
| `/member/tasks` | Search/filter own tasks or department coordination |
| `/member/tasks/:id` | Owned purchase progress, linked claim, or read-only colleague task |
| `/member/drafts/:id` | Receipt source, claimable items, original/annotated comparison, submission |
| `/member/claims` | Own saved drafts and submitted claim statuses |
| `/member/claims/:id` | Evidence, decision, selected destination, and actual timeline |
| `/member/claims/:id/payment` | Own transfer record, proof, issue report, receipt acknowledgment |
| `/member/accounts` | Own Bank/TNG payment instructions |
| `/member/notifications` | Event-derived updates and persistent read state |

Draft stages use `?step=upload|items|review|submit`; later stages require a captured source. Unknown Member paths have a recovery view. `/demo` and the header selector provide explicit Ava, Ryan, and Grace Member identities.

## Demonstrate the complete flow

1. Director Jamie: create an activity, set its budget, assign Nora Treasurer oversight, create a department, choose Sarah as HOD and Ava/Ryan as Members.
2. HOD Sarah: select that department, create an HDMI cable purchasing task, assign Ava, set an RM80 estimate and deadline.
3. Member Ava: open the same task, start/mark purchased, and prepare a reimbursement claim.
4. Save fictional Bank/TNG instructions under Payment accounts. Upload an actual PNG/JPEG receipt and run on-device OCR or explicitly transcribe it manually.
5. Capture source values, correct/exclude lines with reasons, reconcile the gross receipt, and compare original evidence with the annotated panel. The requested amount is derived.
6. Explain any over-budget request, choose an owned account, review the activity/department/task and amount, then confirm submission.
7. Treasurer Nora: review the shared claim and receipt history, analyze overruns, approve/decline, and separately record a fictional full reimbursement with uploaded proof.
8. Member Ava: inspect the proof. Keep it awaiting confirmation or report a discrepancy. After actual receipt (fictional during this demo), explicitly acknowledge the full amount.
9. Treasurer history shows the same claimant/time and receipt status. HOD and Director totals agree; acknowledgment does not add another expense or payment.

## Models and service boundaries

- `domain/member.ts`: private accounts, drafts, read state, and explicit Member DTOs. `domain/accounts.ts`, `receipt.ts`, and `member-notifications.ts` hold validation/calculations/event derivation.
- `member-core.ts`: fresh role, active membership, task-assignee, and claimant checks. Public department coordination omits colleagues' claim links. Private account identifiers, receipts, and proof use owned detail endpoints.
- `member-accounts.ts`: allowlisted fields, masking, one default per owner, unused removal, and private masked change history. Editing/default changes never rewrite submitted snapshots.
- `member-drafts.ts` and `member-receipt-edits.ts`: persisted private source work, immutable captured baseline, append-only before/after corrections, missing items, exclusions/reinclusions, and reviewed-total changes with reasons.
- `member-claims.ts`: derives amounts from included receipt lines, checks draft/task/account revisions, atomically links one claim to an owned purchase, stores evidence and destination snapshots, and audits explicit unpaid destination changes.
- `member.ts`: constrained purchase transitions, own proof retrieval, discrepancy reporting, and one full receipt acknowledgment. Reports remain in history after resolution by acknowledgment.
- `member-validation.ts` and `receipt-validation.ts`: persisted record/reference/history validation. All commands re-read the shared ledger; Member and Treasurer mutations share a local queue/Web Lock.
- Director/HOD ordinary DTOs omit private payment evidence/instructions. Their history redacts private transfer references and discrepancy detail. Treasurer loads exclude Members' saved account collections and private drafts.

`MemberProvider`, `MemberShell`, the member tables, account form, receipt upload/baseline/item editor, submission form, and destination component are reusable. `ReceiptEvidenceView` serves both Member and Treasurer. Existing `Modal`, `Field`, `DateField`, `Panel`, `Badge`, `MetricCards`, `Progress`, skeletons, toasts, and keyboard navigation are reused.

`styles/member.css` extends centralized shared tokens; it introduces no separate palette or fonts. Role workspaces load lazily. Reimbursement approval, external transfer recording, and receipt acknowledgment remain distinct.

## OCR and receipt calculations

Tesseract.js 7 performs real English OCR in a browser worker. The parser uses recognized text, keeps raw text, extracts conservative trailing amount lines, recognizes unambiguous quantities, separates tax/discounts, and only suggests ISO dates. Uncertain fields remain blank for human review. No receipt image is sent to a third-party OCR API.

`npm ci` installs locked dependencies. `predev` and `prebuild` run `scripts/prepare-ocr.mjs`, copying the worker, compatible WebAssembly variants, English model, and package license files into ignored `public/ocr/`. Build output includes about 28.9 MB of OCR assets (the English gzip model is 2.95 MB). The browser selects one compatible engine; OCR is loaded on demand. Preserve `/ocr/` when hosting `dist/`.

Receipts support PNG/JPEG up to 1 MB and 20 megapixels, without silent resizing. Camera input requests the environment camera where supported. Cancellation, timeout, unreadable scans, and engine failures offer an explicitly labeled manual path. The original uploaded bytes are retained; no OCR coordinates or confidence values are fabricated. The linked annotated-item panel is used instead of invented image overlays.

Amounts use integer minor units; quantity multiplication uses BigInt and rounds to the nearest minor unit. Tax adds; discounts subtract. All final lines, including exclusions, must reconcile to the reviewed gross receipt total. Included lines determine the claim; it must be positive and cannot exceed that gross total. Shared tax/discount treatment requires explicit lines/reasons, with no hidden proration.

An unsubmitted source can be removed/replaced only after confirmation; the dialog explicitly clears that working extraction/history. Submitted source evidence and amounts have no Member edit endpoint. Default changes never redirect a claim; unpaid destination changes require an owned account, reason, and retained prior masked destination. Payment locks that snapshot.

## Production integration and limits

This remains a frontend demonstration. Session profiles and localStorage are inspectable by the browser owner, not production authentication, authorization, encryption, or durable audit storage. Use fictional identifiers and proof. Storage failure surfaces an error without a success update. Large image collections can exhaust browser quota.

Replace adapters with authenticated APIs that repeat role/membership/ownership checks on every read, mutation, and file download; use server-derived totals, atomic transactions/idempotency, encrypted payout storage, protected object storage, and durable append-only history. Keep existing DTOs and commands as the UI boundary.

OCR accuracy is not guaranteed, multilingual/date-format inference is limited, and actual mobile camera hardware was not tested. One full reimbursement is supported per claim; partial payments and declined-claim resubmission require a separately designed lifecycle. Legacy fictional records retain their original limitations instead of receiving invented OCR, proof, or acknowledgments. No money is transferred and no external transfer is verified.

See [verification](VERIFICATION.md), [computed style audit](style-audit.json), [receipt stage checks](wizard-audit.json), [screenshots](screenshots/receipt-annotations.jpg), and [incremental commits](COMMITS.md).
