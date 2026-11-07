# PayCalc — Take-Home Pay Calculator

PayCalc is a one-page calculator that estimates how much of a gross salary remains after Income Tax, employee National Insurance and optional workplace pension contributions. It makes the difference between gross pay and money available to spend easier to understand.

I created this project to practise building websites from scratch, solving practical problems with JavaScript and keeping code understandable as features grow. The longer-term goal is to develop skills in testing, CI/CD, containerisation, cloud deployment and maintaining an application after release.

## Current features

- UK salary estimates using the configured standard England Income Tax rules for 2026/27. Other UK tax configurations are not implemented.
- Annual and monthly gross salary inputs. Four-weekly is an output period only.
- Progressive Income Tax, Personal Allowance tapering above £100,000 and employee National Insurance.
- Optional workplace pensions under a **net pay arrangement**, calculated on full gross salary. Disabled means 0%; enabling starts at 5%. Valid rates are 0–100%.
- Pension contributions reduce income for Income Tax and the Personal Allowance taper; NI still uses original gross salary.
- Annual, monthly, four-weekly, weekly and daily take-home breakdowns. The calculation module also returns those periods for pensions, gross salary and taxes when supplied with the annual details.
- A dashboard with annual deductions, a salary chart and pension legend. “Take-Home Pay Every 4 Weeks” uses the same simple presentation as weekly and daily take-home pay, without extra period breakdowns.
- Inline validation, associated pension error messages, keyboard focus styles and responsive layouts. Editing inputs clears outdated results until the next submission.

Only **2026/27** is supported. The existing 2025/26 selector option is rejected with an unsupported-year message. Student loans, salary sacrifice, relief-at-source pensions and other countries are planned, not implemented.

Calculations are estimates, not a payroll service. Period amounts are averages of annual calculations, not period-specific payroll deductions. Four-weekly amounts use annual / 13, monthly annual / 12, weekly annual / 52 and daily annual / 365. Values remain unrounded until GBP presentation. A 100% pension can leave negative take-home pay because NI still applies; the dashboard shows the amounts and hides the stacked chart with an explanation.

## Technology stack

HTML5, CSS3 and vanilla JavaScript ES modules power the application. Node.js provides the built-in test runner and syntax/coverage checks. Git and GitHub provide version control, and GitHub Actions defines automated checks. There are no runtime frameworks, external npm dependencies or build step.

## Local development

Clone the repository:

```sh
git clone https://github.com/hamdqasim25/take-home-pay-calculator.git
cd take-home-pay-calculator
```

Serve the repository over HTTP because the browser loads JavaScript modules. If Python is already installed, its built-in server needs no extra packages:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000` and stop the server with Ctrl+C when finished. Alternatively, use an existing editor's static HTTP preview. Opening `index.html` directly as a file may prevent module loading.

Use Node.js 24 for the locally verified test environment; CI is configured for Node 22 and 24. No `npm install` is needed. On PowerShell use `npm.cmd` if execution policy blocks the `npm.ps1` launcher.

## Project architecture

| Path | Responsibility |
| --- | --- |
| `index.html` | Accessible form, pension controls, dashboard outputs and chart markup. |
| `css/styles.css` | Shared styling, focus/error states and responsive layout. |
| `js/main.js` | Read and validate inputs, call calculations, format results, update the DOM and clear stale results. |
| `js/calculators/uk.js` | Pure salary, pension, allowance, tax, NI and period calculations. No DOM dependencies. |
| `js/tax-rules/` | Country/tax-year rates, bands and allowance configuration. Currently contains `uk-2026-27.js`. |
| `tests/` | Calculation unit tests, simulated-DOM integration tests and manual QA guidance. |
| `scripts/check-syntax.js` | Recursively run `node --check` on JavaScript source, tests and scripts. |
| `.github/workflows/` | CI triggers, Node matrix and named verification stages. |

Tax rules remain separate from calculation logic so another tax year can supply different configuration. The engine follows six steps: annualise salary, calculate pension, apply the allowance to income after pension, calculate Income Tax, calculate NI on gross earnings, then subtract deductions and split results into periods. UI rendering consumes those values and formats them without recalculating period amounts.

`calculatePayBreakdown(takeHomePay, pensionContribution, details)` retains its first two arguments. The optional `details` object contains `annualSalary`, `incomeTax` and `nationalInsurance`. Take-home fields stay at the top level; `pension` remains nested. Supplying details adds nested `gross`, `incomeTax` and `nationalInsurance` objects. Each uses `annual`, `monthly`, `fourWeekly`, `weekly` and `daily` keys.

## Development roadmap

Status describes the implementation in this checkout, not an assertion that changes have been deployed. **Complete** means implemented with the stated automated checks; browser QA is tracked separately. **In progress** means part of a phase exists. **Planned** means work has not been implemented.

### Phase 1 — Website Foundation · Complete

- [x] HTML structure, initial calculator form and results regions.
- [x] CSS styling and responsive desktop/mobile layout rules.

**Milestone / acceptance:** the form and results are present, controls have labels, and responsive CSS is implemented. Continue checking layout in real browsers after UI changes.

### Phase 2 — UK Calculation Engine · Complete for the current configuration

- [x] Annual salary conversion from annual/monthly input.
- [x] Income Tax, Personal Allowance tapering and employee NI.
- [x] Tax-year configuration separated from the engine.
- [x] Input validation and automated unit tests for rules and boundaries.

**Milestone / acceptance:** configured threshold cases, unsupported input handling and known salary examples pass. Adding other tax years/regions remains Phase 5 work; these tests do not independently certify tax legislation.

### Phase 3 — Dashboard and UI/UX · Complete implementation; browser QA pending

- [x] Improved salary results layout and annual deductions breakdown.
- [x] Salary chart, labelled legend and responsive UI styling.
- [x] Clear results after edits; recover from validation and rendering failures.

**Milestone / acceptance:** integration tests verify rendering, chart shares, resets and error recovery. Manual desktop/mobile and assistive-technology review remains required.

### Phase 4 — Advanced Salary Features · In progress

- [x] Phase 4.1: net pay workplace pension calculation logic.
- [x] Phase 4.2: pension input, validation, deductions and chart integration.
- [x] Phase 4.3: four-weekly gross, take-home, tax, NI and pension breakdowns.
- [ ] Student loan repayments — planned.
- [ ] Salary sacrifice and relief-at-source pension methods — planned.

**Milestone / acceptance:** implemented pension and period tests pass with existing no-pension results unchanged. Future deduction methods need their own rules, UI explanations and boundary tests before being marked complete.

### Phase 5 — Quality and Extended Functionality · In progress

- [x] Broader automated testing for pensions, periods, validation and dashboard updates.
- [x] Accessible labels, inline errors and keyboard focus styling.
- [ ] Further accessibility improvements following keyboard/screen-reader audits.
- [ ] Additional UK tax configurations, including currently unsupported years/regions.
- [ ] Other countries through modular tax rules and appropriate currency formatting.

**Milestone / acceptance:** audit findings are resolved, and each added configuration has independently checked examples, boundary tests and clear UI selection. Expand browser testing without replacing the existing regression suite.

### Phase 6 — DevOps and Cloud Deployment · In progress

- [x] Expanded GitHub Actions CI definition with syntax, unit, integration, regression and coverage stages.
- [ ] Verify this expanded workflow on GitHub after pushing.
- [ ] Docker containerisation and container build verification.
- [ ] Select cloud hosting and deploy the application.
- [ ] Automated deployment with release and rollback checks.
- [ ] Monitoring and logging for the hosted application.

**Milestone / acceptance:** the hosted CI matrix passes, a reproducible container builds, and deployment/rollback plus health monitoring work in the chosen environment. Deployment automation is not implemented yet.

## Automated testing and CI

Last confirmed local run: **76 passing tests**, comprising **23 calculation unit tests** and **53 form/HTML integration tests**, on Node.js **24.20.0** (7 November 2026).

```sh
npm run check:syntax
npm run test:unit
npm run test:integration
npm test
npm run test:coverage
```

On Windows, replace `npm` with `npm.cmd`. The full suite includes all tests; the focused commands make failures easier to locate. Integration tests load real production modules through `vm.SourceTextModule` with a small DOM simulation, so `--experimental-vm-modules` is retained. Node may print an experimental-feature warning.

The single workflow, `.github/workflows/tests.yml`, runs on pushes to all branches (including active feature branches), pull requests targeting `main`, and manual dispatch. Node 22 and 24 each run syntax, unit, integration and full regression stages. Node 24 also runs built-in coverage. Failed commands fail the job; no errors are ignored. Permissions are limited to `contents: read`. A conditional `npm ci` step runs if a lockfile is added; today there is none and installation is skipped.

The workflow retains maintained [`actions/checkout@v7`](https://github.com/actions/checkout) and [`actions/setup-node@v7`](https://github.com/actions/setup-node). The matrix defines intended compatibility; Node 22 and GitHub-hosted execution have not yet been verified for this change.

[Node's built-in coverage](https://nodejs.org/api/cli.html#--experimental-test-coverage) reports source-file coverage in logs without dependencies or arbitrary thresholds. The confirmed local report measured **99.56% lines, 98.28% branches and 100% functions** across the reported JavaScript source files. These figures describe this test run; they do not measure CSS, browser layout, screen-reader behaviour or tax-law correctness.

See [tests/README.md](tests/README.md) for test provenance, coverage scope and the manual browser checklist. Automated checks do not replace browser QA: verify desktop/mobile layout, keyboard access, native number-input behaviour, error announcements and chart rendering before release.
