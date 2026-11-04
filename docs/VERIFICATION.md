# Director frontend verification

Verified locally on 4 November 2026 (Asia/Singapore).

## Build and automated checks

- `npm run build`: TypeScript compilation and Vite production build passed.
- `npm test`: 21 tests passed across financial rules and the persistence adapter.
- `npm audit`: zero vulnerabilities in the full dependency tree.
- No starter-template styles or assets, Times New Roman, Arial, system-ui primary fonts, or default-blue links found in application source.

## Browser-tested workflows

Used the actual rendered application in the in-app browser at `http://127.0.0.1:5186`.

1. Submitted an empty activity form and observed styled required-field feedback.
2. Created a workshop with dates and RM1,000 budget; navigation opened department setup.
3. Rejected a RM1,001 allocation, saved Logistics at RM600, then edited it to RM700.
4. Confirmed RM700 allocation and RM300 unallocated funds on the activity budget dashboard.
5. Rejected an overall budget reduction to RM600; saved RM1,200, an updated name, and Active status while preserving the department.
6. Refreshed and confirmed the saved activity and allocation persisted.
7. Cancelled department removal, then removed the unused test department; its allocation returned to the unallocated balance.
8. Rejected removal of a sample department linked to expense/assignment records.
9. Tested search, no-match and clear-filter states, type/status filters, sorting, global search, and budget-dashboard filtering.
10. Filtered sample expenses by review state, filtered history by activity, and expanded change details.
11. Tested invalid and valid preference saves, timezone changes, help, demo reset confirmation, and restored sample data.
12. Used mobile navigation by keyboard; checked focus restoration and inert offscreen navigation. Selected a date with calendar month navigation; tested unsaved-change confirmation and Escape dismissal of dialogs.

The test activity was cleared using the application's explicit demo-reset action after verification. No real claim approvals or payments were created.

## Visual/style audit

- All ten Director page variants plus the not-found view were audited at 1440px and 390px.
- All ten page variants were checked at 320px, 390px, 820px, and 1440px: 40 checks, zero document overflow failures. Tables scroll within their own keyboard-focusable regions. Width checks include scrollbar space.
- Computed font families were exclusively Manrope Variable and DM Sans Variable for the inspected text/control elements. `document.fonts.check` confirmed both primary fonts loaded.
- Inspected computed text, canvas, dialog, input, button, and border colors. No default-blue links or unintended native control appearances remained.
- Reviewed hover/active/disabled styles in CSS; keyboard focus indicators were observed in rendered forms, calendars, and navigation. No dark theme is implemented; light appearance is explicitly set.
- Screenshots were reviewed for the overview, activity setup, department setup, budget dashboard, phone layouts, and department dialog. Evidence lives in `docs/screenshots/`.
- Raw route/style data: `desktop-style-audit.json`, `mobile-style-audit.json`, and `responsive-audit.json`.

## Issues found and resolved

Fixed desktop visibility of mobile navigation buttons, unrelated recent-history results after filtering, offscreen mobile tab stops, low muted-text contrast, native date entry inconsistency, screen-reader table text escaping its scroll region, and a 15px narrow-phone overflow caused by minimum body width.

Bulk source formatting also exposed a development Fast Refresh context-identity mismatch. Moved the context and hook into a stable shared module, then verified provider hot reload and all 11 routes in a fresh browser session. That final session recorded zero console warnings/errors; see `browser-console.json`.

## Verification limits

Browser checks used the in-app browser, not a Safari/Firefox/device test matrix. Corrupted storage and quota failures were exercised through automated adapter tests; those browser conditions were not forced through developer tools. Accessibility checks cover semantic controls and keyboard operation, not a full screen-reader or third-party accessibility certification. Real API, authorization, file access, and payment behavior are deliberately outside this frontend phase.
