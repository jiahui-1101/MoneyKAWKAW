# Member frontend verification

Verified locally on 2026-11-05, branch `codex/member-frontend`, using the existing shared browser ledger. No push, deployment, backend, authentication provider, bank transfer, or third-party OCR API was introduced.

## Automated checks

- `npm test`: **68 tests passed in 11 files**, including the existing 56 Director/HOD/Treasurer checks.
- `npm run lint`: passed with React/accessibility checks and denied warnings.
- `npm run build`: passed TypeScript and Vite production compilation; 1,828 modules transformed, no chunk-size warning. Initial application JS is approximately 372 KB before gzip; role workspaces and OCR load separately.
- `npm run typecheck`: separately passed during integration, with final TypeScript checking repeated by the build.
- `git diff --check`: passed. Local `AGENTS.md` and `REQUIREMENTS.md` remain ignored and untracked.

New tests cover real-text OCR parsing, quantity rounding, gross/included reconciliation, immutable source and correction history, required reasons, private scope/claim/account ownership, session changes, revoked membership, reassigned drafts, storage failure, stale revisions, concurrent duplicate submission, destination snapshot/default behavior, audited unpaid destination replacement, invalid files, and the complete four-role lifecycle.

The service integration scenario uses an RM10,000 activity, RM2,000 department, RM80 assignment, and RM110 submitted receipt: RM30 / 37.5% over estimate. It requires justification and advisory analysis, records approval and a proof-backed payment, retains a discrepancy, then confirms receipt once. Recorded/paid totals remain RM110; department availability stays RM1,890. The original receipt remains identical throughout. Director saves retain private records while redacting private payment event details in their ordinary views.

## Actual browser workflow

Used the app in the in-app Chromium browser at `http://127.0.0.1:5186`, first through Vite development and then the built production preview on the same origin.

| Step | Observed result |
| --- | --- |
| Director creates **Member Workflow Showcase** | RM10,000 budget, Nora oversight, Multimedia department RM2,000; Sarah HOD and Ava/Ryan explicitly assigned |
| HOD creates **HDMI Cable · Member OCR** | Same shared task assigned to Ava, RM80 estimate, 10 Nov deadline |
| Member updates purchase | Not Started → In Progress → Purchased; no approval/payment generated |
| Original sample receipt upload | Exact PNG displayed and retained; 21.9 KB, clearly labeled fictional receipt |
| Actual Tesseract OCR | Read merchant, ISO date, two cables at RM47.50 each (RM95), RM15 personal snacks, RM110 total; retained actual raw recognized text |
| Edit/exclude | Missing exclusion reason rejected; snack exclusion saved with actor/time/reason and before/after values; gross stays RM110, claim becomes RM95 |
| Accounts | Empty-field validation, Bank and TNG creation, masking, refresh persistence, default change, owned editing, protected referenced account, confirmed unused removal |
| Submission | Missing explanation rejected; RM15 / 18.75% variance shown; activity/department/task, amount and masked destination reviewed; Pending review claim created once |
| Treasurer | Same RM95 evidence and exclusion report; explicit review and Medium advisory result (18.75% variance; adequate department/activity headroom); approval remains unpaid |
| Payment | RM95 fictional full transfer recorded with reference `DEMO-MEMBER-95` and retained uploaded sample proof; awaiting Member acknowledgment |
| Member issue/receipt | Issue reporting keeps receipt unconfirmed; RM90 acknowledgment rejected; RM95 explicit acknowledgment succeeds once; prior issue retained as resolved |
| Shared follow-through | Treasurer Received filter shows Ava/time and prior issue. HOD shows Completed task, RM95 spending/paid, RM1,905 available. Director shows RM95 recorded/paid, department RM1,905 remaining, activity RM9,905 remaining |
| Other Member | Ryan sees Ava’s same-department task as read-only coordination; Ava’s private claim URL shows an access-restricted recovery view |

Additional browser checks: persisted draft resume, OCR cancellation with manual fallback, explicitly labeled manual source capture, quantity/unit-price correction history, search/filter empty state, notification individual/all-read and reload persistence, mobile drawer inert background/Escape/focus return, help dialog Escape/focus return, and proof visibility after refresh. Submitted claim evidence has no editable Member controls; paid destinations are locked; received payments have no duplicate confirmation control.

After an explicit confirmation, replaced only an **unsubmitted test draft** source and reran actual OCR successfully in the production build. Unsupported text upload was rejected with receipt-specific PNG/JPEG guidance while the prior source remained intact. The primary submitted claim and its history were unaffected.

## Style, accessibility and responsive audit

- Inspected actual rendered Member overview, activities, department, task board/detail, claims/detail, payment, accounts, notifications, receipt stages, account forms, item editor, and confirmation/help dialogs.
- [Computed-style evidence](style-audit.json): 11 rendered pages × 320/390/820/1440 pixels = **44 checks**; no page-level horizontal overflow after fixes.
- [Final receipt/identity checks](wizard-audit.json): four receipt stages plus payment at the same four widths = **20 further checks**, no overflow.
- Computed fonts are exclusively intended **DM Sans Variable** and **Manrope Variable** families with reliability fallbacks. Fonts are bundled WOFF2 assets. No browser-blue links appeared; inspected input/select/button appearance is `none` with explicit application styling.
- Captured foreground/background/border colors use the existing palette. Reviewed shared hover/active/selected/disabled/loading/error rules and checked rendered keyboard focus, selected states, validation, loading and success feedback. Focus returns to the invoking control; mobile drawer makes content inert while open.
- Representative text contrast ratios: ink/white 15.37, muted/white 5.02, muted/canvas 4.73, brand/white 5.17, green/green-soft 4.86, gold/gold-soft 4.73, danger/danger-soft 5.26, violet/violet-soft 4.95. This is a focused token contrast check, not a formal full WCAG certification.
- Fixed issues found visually: an HOD checkbox-icon class collision in Member forms, narrow payment grid overflow, and long discrepancy badge overflow. Rechecked the corrected pages. Added keyboard access to scrollable source text and clarified draft versus submitted receipt labels.
- Final captured [browser warnings/errors](browser-console.json): **none**. Light appearance is intentional; no dark theme is offered.

## Visual evidence

- [Desktop overview](screenshots/overview-desktop.jpg) and [mobile overview](screenshots/overview-mobile.jpg)
- [Actual production OCR](screenshots/ocr-production.jpg)
- [Original/annotated receipt](screenshots/receipt-annotations.jpg) and [full claim review](screenshots/receipt-review-desktop.jpg)
- [Mobile item editor after collision fix](screenshots/item-editor-mobile.jpg)
- [Confirmed payment with retained issue](screenshots/payment-confirmed-desktop.jpg) and [mobile payment/proof](screenshots/payment-mobile.jpg)

Screenshots contain fictional demo identities and financial data. Existing prior-role verification records remain present in the browser ledger, so portfolio-wide metrics include those examples. Generated OCR assets, local fixture inputs, and the build output are ignored; visual evidence is committed deliberately.

## Limits and handoff

This is a tested frontend mock, not a secure production financial system. Browser storage and demo role switching do not enforce a real security boundary. Real APIs must repeat every scope/ownership check, compute authoritative totals, protect files, encrypt payout details, and persist durable audit history atomically.

Actual OCR was demonstrated on a clear generated English sample, not a diverse receipt accuracy benchmark. Poor photos and ambiguous dates require human corrections/manual entry. Camera capture is exposed on compatible devices, but physical phone camera hardware was not tested. Receipt image limits are 1 MB / 20 megapixels; localStorage quota limits apply.

Image/proof preview and persistence were tested. Download delivery was not retested in this embedded browser: earlier role verification encountered its restriction on data-URL downloads. No workaround was attempted. Validate download delivery in a normal supported browser and replace data URLs with authorized object-storage downloads before production.

Only one full reimbursement is supported per claim; no partial payments or declined-claim resubmission workflow was added. Risk remains deterministic advisory logic, external transfers remain unverified, and a Member acknowledgment records that Member’s assertion of receipt. Development/preview servers were stopped and the browser viewport override was reset after verification.
