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

Total: **76 passing tests (53 form/HTML checks and 23 calculation tests)**,
confirmed locally on Node 24.20.0 on 7 November 2026.

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
99.56% lines, 98.28% branches and 100% functions overall. There is no threshold.
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

The tests load production JavaScript without rewriting its imports or adding
test hooks. Node's `vm.SourceTextModule` requires `--experimental-vm-modules`,
included in `npm test`; Node may print an experimental-feature warning.

The small DOM simulation exercises event handlers and output updates. It does
not emulate browser number-input sanitisation, layout, native form behaviour or
screen-reader announcements. HTML assertions check the inline-validation and
live-region markup separately. Real-browser accessibility and visual checks
remain manual. Test counts describe scenarios, not a measured coverage percentage.
