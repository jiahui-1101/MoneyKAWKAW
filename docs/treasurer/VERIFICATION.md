# Treasurer verification

Verified locally on 5 November 2026. The test story follows an existing Director-managed activity and HOD task through a clearly fictional claim fixture, Treasurer review/decision, and a manually recorded demo reimbursement with uploaded proof. No real member submission or bank transfer was performed.

## Technical checks

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, no warnings |
| `npm run typecheck` | Passed |
| `npm test` | 56 passed across 7 files, including all 39 existing tests |
| `npm run build` | Passed; TypeScript + Vite production bundle |
| Production preview | Rendered persisted dashboard, decision snapshot, and uploaded 800×500 PNG proof after reload |
| Browser console | No captured errors or warnings during the exercised flows; [log](browser-console.json) |
| Local-only documents | Ignore rules active, neither guidance file tracked or staged |
| Commit cadence | Every implementation/test/config slice at most 101 changed lines; separate formatting-only commit and generated artifacts excluded |

Oxlint checks correctness, React/hooks, TypeScript, and accessibility. Configuration excludes React Compiler diagnostics because this application does not use the compiler and the rules misclassify existing custom navigation refs, async loading effects, and local accumulation. It also permits keyboard-scrollable table regions, native dialog/summary semantics, and initial modal autofocus. These exceptions do not suppress the remaining accessibility or hooks checks.

## Functional browser evidence

1. Selected Nora explicitly; only her four default authorized activities appeared. Leadership Retreat and its claim were denied, as were Director/HOD routes under the Treasurer identity.
2. Started review on `exp-3`; status became In review with Nora/time in history. Declined with a reason, then refreshed and verified the preserved decision. Separately tested an empty decline reason on mobile; the service rejected it and kept the dialog open.
3. Director created **Treasury Verification Dinner**, RM10,000, explicitly granting Nora oversight. Created Multimedia with RM2,000, Sarah as HOD, and Ava as eligible member.
4. HOD Sarah created **Projector HDMI adapter**, RM150, assigned to Ava. Treasurer’s fixture loader found the same task ID.
5. Tried loading a RM190 fixture without an over-budget explanation; it was rejected. Added a reason and saved the explicitly fictional claim.
6. Claim detail showed RM150 item budget, RM190 claimed, RM40 variance, 26.67%, and RM1,810 department availability. Original source, corrected/excluded line annotations, original extraction, before/after reasons, and source history rendered correctly.
7. Tried approval before analysis; it was blocked. Analyze Risk returned High under the 25% threshold. Invalid thresholds were rejected; changing High to 30% changed the band to Medium; restoring 25% returned High. No analysis action made a decision.
8. Confirmed approval with a decision note. The claim became Approved and remained unpaid. A decision-time analysis snapshot was retained.
9. Opened the approved payment step. Destination was masked, with explicit fictional/non-payable labeling. Reveal/mask worked; account editing was unavailable.
10. Incomplete payment fields were rejected. A disguised PNG was rejected for content/type mismatch. Uploaded an actual sample PNG, entered `DEMO-UI-190`, kept the valid payment date, and checked the explicit external/demo-transfer attestation.
11. Confirmed the manual record on mobile. History showed RM190 paid, masked destination, reference, proof, responsible Treasurer, and member confirmation pending. The uploaded proof rendered after refresh; production preview also loaded the preserved image at its original dimensions.
12. Reopened the reimbursement route; duplicate processing was blocked. There was no Treasurer receipt-confirmation action.
13. Director budget and HOD expense screens both showed the same RM190 recorded/paid and RM1,810 department availability. HOD’s financial view retained no proof or full destination. A service regression test additionally confirms HOD audit projections redact the payment reference.
14. Confirmed that the original receipt data URL remained unchanged after analysis, decision, and payment. Service tests also deep-compare the preserved evidence and uploaded proof.
15. Exercised combined activity/department/member/date/status filters, amount sorting, empty search results and filter clearing, payment receipt-status filters, legacy payment details, calendars, mobile navigation, keyboard focus restoration, Escape dismissal, and not-found recovery.

See [structured workflow checks](workflow-checks.json) and [route checks](access-route-checks.json). Test fixture IDs are retained only to correlate the screenshots; browser-local records are not repository data.

## Rendered style audit

All nine main Treasurer page variants were inspected at 320, 390, 820, and 1440 pixels. The [39 responsive samples and palette/control audits](style-audit.json) include extra proof-form and production-dashboard checks. Tables intentionally scroll within labeled, keyboard-focusable containers; there was no document-level horizontal overflow or detected overflow in metric cards, fact values, receipt totals, annotations, or page headings.

- Both bundled intended fonts loaded: Manrope headings and DM Sans body/controls. No unintended primary font or default-blue text was found.
- Inspected computed text/background/border colors, button/input/select appearance, selected and disabled states, loading/error feedback, and keyboard focus. All audited controls used `appearance: none`; numeric spinner chrome was also removed and inspected in advisory settings.
- Reviewed hover/focus/active CSS against shared tokens. The proof dialog’s keyboard focus ring computed to the intended green. Native dialog focus, Escape, and mobile navigation restoration worked.
- Tested the narrow payment calendar, its future-date disabled state, advisory settings dialog, receipt annotations, upload field, file preview, and payment confirmation dialog.
- Shared palette contrast calculations: body/canvas 14.46:1, muted/canvas 4.73:1, primary button 5.17:1, green status 4.86:1, amber status 4.73:1, danger status 5.26:1.
- Light theme only, with an explicit color scheme. Source scan found no unintended Times New Roman, Arial/system-ui primary fonts, default-blue declarations, or Vite starter colors.

Actual image inspection caught missing spending-bar fills; this was fixed using the existing chart palette and rechecked in the rendered browser. Additional polish clarified legacy missing-analysis states, not-found recovery, member confirmation counts, and declined-task reservations.

The [24 screenshots](screenshots/) cover desktop/mobile dashboards, financial details, claim evidence, risk factors, payment input/proof/confirmation, narrow dialogs, and shared Director/HOD records. [Dashboard preview](screenshots/overview-preview.png) is suitable for quick review.

## Limitations and future readiness

The embedded browser’s security policy blocked data-URL download delivery. Download targets and filenames are present, and uploaded/original evidence renders and persists, but actual file delivery through those links could not be verified. This restriction was not bypassed. Other browser engines and physical touch devices were not tested.

This remains a fictional browser-local implementation. No production authorization, encrypted payout/file storage, banking verification, live OCR, trained risk model, actual member submission, or member receipt confirmation is claimed. Existing historical sample payments explicitly lack proof/reference metadata; unsupported partial payments, finalized-record corrections, and claim resubmission remain future workflows.

Future Member work can consume linked claim/review/payment records and immutable receipt histories, then add owned submission, saved payout preferences, proof access, confirmation, and discrepancy commands. Real APIs must enforce role/activity/department/file scope, monetary/status validation, transactional idempotency, append-only history, and encryption. Director/HOD remain separate roles; no Member UI was added.

Owned preview servers were stopped and temporary browser viewport overrides reset after verification. Nothing was pushed or deployed.
