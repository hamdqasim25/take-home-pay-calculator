# Student loan calculation engine, form and dashboard — Phases 4.4.1–4.4.3

The engine uses the [HMRC 2026-27 payroll technical specification](https://www.gov.uk/government/publications/payroll-technical-specifications-student-loans/collection-of-student-loans-from-6-april-2026)
and [employer repayment guidance](https://www.gov.uk/guidance/special-rules-for-student-loans).
Multiple-week payroll follows the [2026-27 deduction tables, “Pay periods other
than weekly or monthly”](https://www.gov.uk/government/publications/sl3-student-loan-deduction-tables/2026-to-2027-student-and-postgraduate-loan-deduction-tables).

| Configuration key | Annual threshold | Repayment rate above threshold |
| --- | ---: | ---: |
| plan1 | £26,900 | 9% |
| plan2 | £29,385 | 9% |
| plan4 | £33,795 | 9% |
| plan5 | £25,000 | 9% |
| postgraduate | £21,000 | 6% |

## Calculation flow

1. Convert the entered salary to annual gross earnings.
2. Calculate the net pay pension contribution. Deduct it before calculating the
   Personal Allowance, its taper and Income Tax.
3. Calculate NI and student loan repayments using gross Class 1 NI earnings
   **before** net pay pension deductions. Do not use taxable income or NI payable.
4. Select one standard plan (or `null`) and optionally a postgraduate loan.
   Multiple standard plans are rejected; callers must supply the applicable payroll
   plan. No loan selection returns zero, including with older tax rules without
   loan configuration. Selected plans require valid threshold/rate configuration.
5. For monthly or weekly payroll, divide annual earnings by 12 or 52. Divide each selected
   annual threshold by that number and round the threshold down to pennies.
   Apply the loan's rate to positive earnings above its threshold, then round
   each loan's deduction down to whole pounds **separately**.
6. For four-weekly or fortnightly payroll, use average weekly earnings and weekly
   thresholds, round each loan down separately, then multiply by four or two.
   Sum those payroll deductions and multiply by 13 or 26 for the annual estimate.
   For monthly/weekly payroll, sum rounded deductions and multiply by 12/52.
   Subtract the combined amount once in take-home pay, alongside pension, tax and NI.
7. Pass that amount into the optional breakdown detail to expose `studentLoan`
   annual/monthly/fourWeekly/weekly/daily averages.

## Engine usage (no DOM required)

```js
import {
    calculateAnnualSalary, calculatePensionContribution, calculateTaxableIncome,
    calculateIncomeTax, calculateNationalInsurance, calculateStudentLoanRepayment,
    calculateTakeHomePay, calculatePayBreakdown
} from "./js/calculators/uk.js";
import { uk2026TaxRules as rules } from "./js/tax-rules/uk-2026-27.js";

const annualSalary = calculateAnnualSalary(35000, "Annual");
const pension = calculatePensionContribution(annualSalary, 5);
const incomeTax = calculateIncomeTax(calculateTaxableIncome(annualSalary - pension, rules), rules);
const nationalInsurance = calculateNationalInsurance(annualSalary, rules);
const studentLoanRepayment = calculateStudentLoanRepayment(annualSalary, rules, {
    plan: "plan2",
    postgraduate: true,
    repaymentFrequency: "Monthly"
}); // £1,344: (floor(£42.1125) + floor(£70)) * 12
const takeHome = calculateTakeHomePay(annualSalary, incomeTax, nationalInsurance, pension, studentLoanRepayment);
const breakdown = calculatePayBreakdown(takeHome, pension, {
    annualSalary, incomeTax, nationalInsurance, studentLoanRepayment
}); // takeHome: £25,975.60; breakdown.studentLoan.monthly: £112
```

Omitted options mean `{ plan: null, postgraduate: false, repaymentFrequency: "Annual" }`.
`repaymentFrequency` supports `Annual` (1), `Monthly` (12), `FourWeekly` (13),
`Fortnightly` (26) and `Weekly` (52). It is independent of salary-entry frequency;
the existing salary conversion still supports only Annual and Monthly.
Invalid inputs throw `RangeError` without string/boolean coercion.

Existing take-home calls keep their original arguments and results. The new fifth
argument defaults to zero. Existing breakdown calls retain their exact shape;
`studentLoan` is added only when `details.studentLoanRepayment` is supplied,
including an explicit zero. It combines the standard and postgraduate amounts.

## Estimate limitations

The annual estimate assumes equal earnings for every pay period throughout the
year. `Annual` means one annual pay period; it is not interchangeable with twelve
monthly payroll deductions. At £35,000, Plan 2 gives £505 with Annual versus £504
with Monthly and £468 with FourWeekly/Fortnightly/Weekly. Phase 4.4.2 corrects the
earlier £494 four-weekly/fortnightly estimate, which incorrectly rounded once over
the whole payroll period. Annual mode retains its existing single-period behaviour
for API compatibility; it is not offered by the payroll selector.

For example, £35,000 on Plan 2 plus postgraduate gives weekly deductions of £9
and £16. Four-weekly payroll deducts (£9 + £16) × 4 = £100, annualised to £1,300.
The former whole-period method gave £103 per four weeks. Dividing a monthly-based
annual estimate of £1,344 by 13 also does not give the four-weekly payroll deduction.
With equal earnings and the corrected four-weekly mode, its £1,300 annual estimate
divided by 13 does equal £100; this does not generalise to variable earnings.

Breakdown amounts are averages of the calculated annual total. Weekly and daily
display values are not fresh PAYE calculations and can contain fractional pounds.
No rounding is applied to other existing calculation steps.

Bonuses, variable pay, partial years, irregular intervals, extra weekly paydays,
multiple employments, loan balances/repayment caps, start/stop notices, protected
earnings orders and Self Assessment reconciliation are not modelled. The current
pension model is net pay, not salary sacrifice. If salary sacrifice is introduced,
the caller must provide the resulting Class 1 NI earnings basis.

## Form and dashboard integration

The optional student loan section follows the pension controls. It defaults to
None and an unchecked postgraduate checkbox. Payroll Frequency defaults to Monthly
and also offers Every 4 Weeks and Weekly. Salary Input Frequency still describes
only the entered salary amount, independently of payroll. Changing loan/payroll
settings clears results and errors; invalid selections receive associated errors,
`aria-invalid` and focus. The form calls the engine using original annual gross pay.

Take-home amounts and Total Deductions include loans. Income Tax, NI, pension and
student loan repayment logic are unchanged in Phase 4.4.3. The form calls the loan
engine separately for standard and postgraduate using identical earnings/frequency,
then sums the results once. Optional `standardLoanRepayment` and
`postgraduateLoanRepayment` breakdown details expose `standardStudentLoan` and
`postgraduateLoan` period objects alongside the existing combined `studentLoan`.

Selected loans appear as native expandable rows, with the standard plan name and
all five period averages. Both selections show a clearly labelled combined subtotal.
Unselected rows are hidden; selected below-threshold loans retain zero amounts.
Expanded state survives recalculation, but changes clear stale amounts and labels.
Displayed monthly, four-weekly, weekly and daily figures remain annualised estimates
and may differ from actual payslip deductions. Display rounding can cause a penny
difference when adding formatted averages; underlying amounts reconcile unrounded.

The chart has six components: take-home, tax, NI, pension, standard loan and
postgraduate loan. Zero components are hidden. The combined subtotal is never an
extra segment. Negative take-home hides the bar with an explanation while retaining
signed textual amounts and percentages; zero take-home simply hides that segment.
Loan amounts and totals have accessible text labels, and a polite live summary
announces annual take-home and deductions. Native browser layout, keyboard and
screen-reader checks remain manual; automated DOM tests do not emulate a browser.
