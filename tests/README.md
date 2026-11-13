# Automated tests

Run `npm test` with Node.js 24 (locally verified on 24.20.0). No dependency
installation is required. The workflow targets Node 22 and 24 on pushes to all
branches, pull requests targeting main, and manual dispatches. Node 22 and
GitHub-hosted execution of this revision remain pending until CI runs.
On Windows PowerShell, if execution policy blocks `npm.ps1`, run `npm.cmd test`
to use npm's Windows command launcher instead.

## Provenance

The original 30 checks were executed through an inline PowerShell script piped
to Node.js, not saved in a test file. Their source was recovered from the earlier
conversation tool call. `form-validation.test.js` ports all 30 checks to
`node:test`, retaining the simulated DOM, real ES-module loading, input cases,
expected monetary results and injected failure scenarios. Each test now gets
an isolated VM context and module graph instead of sharing one for the full run.
No original scenario needed reconstruction or was omitted.

Assertions for result clearing were updated for the subsequent requested UI
behaviour: errors show `-`, while editing an input resets results to `£0.00`.
Two additional tests cover initial placeholders and editing after an error.

`uk-calculations.test.js` preserves the three tests already present in the
working tree and adds eight tests for conversion, configured tax-band boundaries,
Personal Allowance tapering, National Insurance, take-home pay and breakdowns.
These are regression tests of the existing calculation rules, not independent
verification of tax legislation.

Phase 4.1 adds eight pension calculation tests. Phase 4.2 adds 17 form/HTML
checks covering pension defaults, toggling, validation, clearing, recovery,
monthly salary inputs, deduction totals, chart shares and accessible markup.

Phase 4.3 adds four unit tests and four integration/HTML tests for four-weekly
gross, take-home, tax, NI and pension values; disabled/enabled pensions; decimal
monthly inputs; display rounding; and output-only frequency support. Existing
placeholder assertions now also check the four-weekly take-home output, including after
salary/pension edits, invalid inputs and injected calculation/render failures.

Phase 4.4.1 adds 22 student loan unit tests in `uk-calculations.test.js`:
all five configured thresholds/rates; annual and monthly boundaries; first
whole-pound deductions; all five repayment frequencies; threshold penny flooring;
floating-point boundaries; combined standard/postgraduate rounding; no selection;
custom/missing/invalid rules; invalid earnings/options/plans/flags/frequencies;
pension and allowance interactions; take-home/breakdown reconciliation; old API
compatibility; and salary-input versus repayment-frequency independence.

Phase 4.4.2 adds six unit tests for average-week flooring before multiplying by
four/two and 23 integration/HTML tests for plan selection, postgraduate alone or
combined, all payroll choices, pension interactions, salary-entry independence,
resets, accessible validation/recovery, engine errors and temporary chart hiding.
All 98 previous scenarios are retained. One existing period test corrects its
FourWeekly/Fortnightly expectations from 494 to 468 under HMRC SL3 guidance.

Phase 4.4.3 adds one unit test for separate loan period objects and reconciliation,
plus 15 integration/HTML tests covering all standard plans, postgraduate alone and
combined, six chart proportions and legend visibility, all average periods,
weekly/four-weekly payroll, selected zero repayments, zero/negative take-home,
expanded-state preservation, stale-result clearing, accessible labels and live totals.
All 127 prior scenarios remain. Assertions for the temporary hidden loan chart and
absence of loan segments now expect the completed chart. Existing clearing helpers
also verify every new output and chart segment.

The vertical salary summary adds ten integration/HTML tests: eight pension/loan
combinations, stale-value and plan-label clearing, and accessible markup/order/colour
reuse. Existing chart and clearing helpers now also check summary amounts and
visibility, including zero/negative take-home scenarios.

Total: **153 tests (101 form/HTML checks and 52 calculation tests)**.
See [student loan engine documentation](../docs/student-loans.md)
for the API, calculation flow, HMRC sources and annual-estimate limitations.

## Local commands and CI stages

| Command | Stage |
| --- | --- |
| `npm run check:syntax` | `node --check` for all JavaScript in js/, tests/ and scripts/. |
| `npm run test:unit` | Calculation tests, including thresholds and four-weekly amounts. |
| `npm run test:integration` | Form/HTML tests using real modules and a simulated DOM. |
| `npm test` | Full regression suite; all tests remain in CI. |
| `npm run test:coverage` | Full suite with Node's built-in coverage report. |

Use `npm.cmd` on PowerShell. The existing single GitHub Actions workflow runs
the first four stages on Node 22 and 24; coverage runs on Node 24. Commands fail
the job on errors. A conditional `npm ci` step applies only when a lockfile exists;
this dependency-free checkout has no lockfile. Workflow permissions are read-only.

The measured local coverage report lists `uk.js`, `main.js` and `uk-2026-27.js`:
99.70% lines, 99.24% branches and 100% functions overall, confirmed on Node
24.20.0 on 13 November 2026. All five commands above passed. There is no threshold.
The report covers executed JavaScript, including VM-loaded modules on this local
Node version; it is not browser, CSS, workflow or tax-law verification.

## Manual pension UI checks

- Check desktop and narrow mobile layouts, including wrapped labels and chart legend.
- Use Tab and Space to enable pensions; confirm the rate becomes editable at 5%.
- Submit blank, negative and above-100 rates; verify focus moves to the input and
  a screen reader announces its associated error. Correct it and submit again.
- Confirm edits and toggles clear all amounts and chart shares until resubmission.
- Compare £35,000 with pension disabled (£28,719.60 take-home) and enabled at 5%
  (£27,319.60 take-home, £1,750 pension). Check the chart's pension segment.
- At 100%, confirm negative take-home remains visible and the chart explanation
  appears. Disable pensions and submit to restore the chart.
- Check “Take-Home Pay Every 4 Weeks” alongside weekly and daily pay at desktop
  and mobile widths, including zoom and long amounts. All three use the same styling.
- At £35,000, confirm £2,209.20 take-home every four weeks without pension,
  or £2,101.51 with 5% pension. No extra four-weekly breakdown is displayed.
- Compare £2,500.25 monthly with £30,003 annual at 5% pension; both should show
  £1,840.13 four-weekly take-home. Annual/monthly remain the only input options.
- Edit salary, pension, frequency or tax year and confirm four-weekly take-home
  clears alongside existing results. Invalid submissions should show dashes.

## Test scope

Student loan browser checks remain manual:

- Verify the new annual summary appears below the existing legend on desktop and
  mobile, with matching swatch colours. Check long labels/amounts at 320px and zoom,
  screen-reader label/value associations, hidden zero rows and signed negative pay.

- Check desktop and 320px mobile layouts, zoom, long currency values and wrapped
  loan summaries/legend labels; no horizontal overflow or clipped controls.
- Use Tab, Enter and Space to expand/collapse loan details. Confirm expanded state
  survives recalculation and focus is visible. Verify plan changes clear stale labels.
- Use a screen reader to check each period output's loan label, total deductions,
  the concise results announcement, and access to amounts without the chart.
- At £35,000 with 5% pension, Plan 2 and postgraduate, check £504/£840 annual loans,
  £1,344 subtotal, £9,024.40 total deductions and £25,975.60 take-home; all six chart
  components must be represented. Switch to four-weekly payroll: £468/£832 loans.
- Check no loans, postgraduate only, selected loans below threshold, and restoring
  controls after errors. Hidden rows, zero segments and zero legends must stay hidden.
- At £10,000 and 100% pension, verify zero take-home and a pension-only chart. At
  £35,000 and 100% pension with both loans, verify negative take-home remains textual
  and only the chart is unavailable, with its explanation.

Automated checks in this phase used the simulated DOM, not a live browser.

The tests load production JavaScript without rewriting its imports or adding
test hooks. Node's `vm.SourceTextModule` requires `--experimental-vm-modules`,
included in `npm test`; Node may print an experimental-feature warning.

The small DOM simulation exercises event handlers and output updates. It does
not emulate browser number-input sanitisation, layout, native form behaviour or
screen-reader announcements. HTML assertions check the inline-validation and
live-region markup separately. Real-browser accessibility and visual checks
remain manual. Test counts describe scenarios, not a measured coverage percentage.
