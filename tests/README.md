# Automated tests

Run `npm test` with Node.js 24 (the version selected by the existing GitHub
Actions workflow). No dependency installation is required. The workflow already
runs this command for pushes and pull requests to main, and manual dispatches.
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

Total: 43 tests (32 form/HTML checks and 11 calculation tests).

## Test scope

The tests load production JavaScript without rewriting its imports or adding
test hooks. Node's `vm.SourceTextModule` requires `--experimental-vm-modules`,
included in `npm test`; Node may print an experimental-feature warning.

The small DOM simulation exercises event handlers and output updates. It does
not emulate browser number-input sanitisation, layout, native form behaviour or
screen-reader announcements. HTML assertions check the inline-validation and
live-region markup separately. Real-browser accessibility and visual checks
remain manual. Test counts describe scenarios, not a measured coverage percentage.
