// 1. Imports and tax rules

import {
    calculateAnnualSalary,
    calculatePensionContribution,
    calculateTaxableIncome,
    calculateIncomeTax,
    calculateNationalInsurance,
    calculateStudentLoanRepayment,
    calculateTakeHomePay,
    calculatePayBreakdown,
    calculatePercentage
} from "./calculators/uk.js";

import { uk2026TaxRules } from "./tax-rules/uk-2026-27.js";

// 2. Currency formatter - keep monetary outputs consistent

const currencyFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

// 3. DOM references - form inputs

const salaryForm = document.getElementById("salary-form");
const salaryInput = document.getElementById("salary");
const countrySelect = document.getElementById("country");
const taxYearSelect = document.getElementById("tax-year");
const payFrequencySelect = document.getElementById("pay-frequency");
const pensionEnabledInput = document.getElementById("pension-enabled");
const pensionRateInput = document.getElementById("pension-contribution");
const pensionError = document.getElementById("pension-error");
const studentLoanPlanSelect = document.getElementById("student-loan-plan");
const postgraduateLoanInput = document.getElementById("postgraduate-loan");
const payrollFrequencySelect = document.getElementById("payroll-frequency");
const studentLoanError = document.getElementById("student-loan-error");
const payrollError = document.getElementById("payroll-error");

// 4. DOM references - salary outputs

const annualPayElement = document.getElementById("annual-take-home-pay");
const monthlyPayElement = document.getElementById("monthly-take-home-pay");
const weeklyPayElement = document.getElementById("weekly-take-home-pay");
const dailyPayElement = document.getElementById("daily-take-home-pay");
const incomeTaxElement = document.getElementById("income-tax");
const nationalInsuranceElement = document.getElementById("national-insurance");
const totalDeductionsElement = document.getElementById("total-deductions");
const pensionElement = document.getElementById("pension-deduction");
const fourWeeklyPayElement = document.getElementById("four-weekly-take-home-pay");
const loanPeriods = ["annual", "monthly", "fourWeekly", "weekly", "daily"];
const loanViews = Object.fromEntries(["standard-loan", "postgraduate-loan", "combined-loans"].map(key => [key, {
    details: document.getElementById(`${key}-details`),
    outputs: Object.fromEntries(loanPeriods.map(period => [period, document.getElementById(`${key}-${period}`)]))
}]));
const standardLoanLabel = document.getElementById("standard-loan-label");
const studentLoanLegendLabel = document.getElementById("student-loan-legend-label");
const loanAveragesNote = document.getElementById("loan-averages-note");
const resultsStatus = document.getElementById("results-status");
const planLabels = { plan1: "Plan 1", plan2: "Plan 2", plan4: "Plan 4", plan5: "Plan 5" };

// 5. DOM references - cache salary segments and legend labels for rendering and resets
const chartViews = Object.fromEntries([
    "take-home", "income-tax", "national-insurance", "pension", "student-loan", "postgraduate-loan"
].map(key => [key, {
    segment: document.querySelector(`.salary-segment.breakdown-${key}`),
    percentage: document.querySelector(`.${key}-percentage`),
    legend: document.querySelector(`.salary-legend li[data-category="${key}"]`),
    summaryRow: document.getElementById(`salary-summary-${key}-row`),
    summaryAmount: document.getElementById(`salary-summary-${key}-amount`)
}]));
const salarySummary = document.getElementById("salary-summary");
const summaryLoanLabel = document.getElementById("salary-summary-student-loan-label");
const salaryBar = document.querySelector(".salary-bar");
const breakdownNote = document.querySelector(".breakdown-note");
const defaultBreakdownNote = breakdownNote.textContent;


// 6. DOM reference - validation error message
const errorMessage = document.getElementById("error-message");

// 7. Clear and reset results - errors use dashes; input edits restore zero amounts
function clearResults(placeholder = "-") {
    fourWeeklyPayElement.textContent = placeholder;
    annualPayElement.textContent = placeholder;
    monthlyPayElement.textContent = placeholder;
    weeklyPayElement.textContent = placeholder;
    dailyPayElement.textContent = placeholder;
    incomeTaxElement.textContent = placeholder;
    nationalInsuranceElement.textContent = placeholder;
    totalDeductionsElement.textContent = placeholder;
    pensionElement.textContent = placeholder;
    for (const view of Object.values(loanViews)) {
        view.details.hidden = true;
        // Preserve native expanded/collapsed state while clearing stale amounts.
        for (const output of Object.values(view.outputs)) output.textContent = placeholder;
    }
    standardLoanLabel.textContent = "Student Loan (annual)";
    studentLoanLegendLabel.textContent = "Student Loan";
    summaryLoanLabel.textContent = "Standard student loan";
    salarySummary.hidden = true;
    loanAveragesNote.hidden = true;
    resultsStatus.textContent = "";
    salaryBar.hidden = false;
    breakdownNote.textContent = defaultBreakdownNote;
    for (const view of Object.values(chartViews)) {
        view.segment.style.setProperty("--share", 0);
        view.segment.hidden = true;
        view.legend.hidden = true;
        view.percentage.textContent = "0%";
        view.summaryRow.hidden = true;
        view.summaryAmount.textContent = placeholder;
    }
}

function renderLoan(view, amounts, selected) {
    view.details.hidden = !selected;
    for (const period of loanPeriods) view.outputs[period].textContent = currencyFormatter.format(amounts[period]);
}

function resetResults() {
    errorMessage.textContent = "";
    clearPensionError();
    clearLoanErrors();
    clearResults(currencyFormatter.format(0));
}

function clearPensionError() {
    pensionError.textContent = "";
    pensionRateInput.setAttribute("aria-invalid", "false");
}

function clearLoanErrors() {
    studentLoanError.textContent = "";
    payrollError.textContent = "";
    for (const input of [studentLoanPlanSelect, postgraduateLoanInput, payrollFrequencySelect]) {
        input.setAttribute("aria-invalid", "false");
    }
}

// 8. Input listeners - discard stale results when salary details change
salaryInput.addEventListener("input", resetResults);
salaryInput.addEventListener("change", resetResults);
countrySelect.addEventListener("change", resetResults);
taxYearSelect.addEventListener("change", resetResults);
payFrequencySelect.addEventListener("change", resetResults);
for (const input of [studentLoanPlanSelect, postgraduateLoanInput, payrollFrequencySelect]) {
    input.addEventListener("input", resetResults);
    input.addEventListener("change", resetResults);
}
pensionRateInput.addEventListener("input", resetResults);
pensionRateInput.addEventListener("change", resetResults);
pensionEnabledInput.addEventListener("change", function () {
    pensionRateInput.disabled = !pensionEnabledInput.checked;
    pensionRateInput.value = pensionEnabledInput.checked ? "5" : "0";
    resetResults();
});

// 9. Form submission and validation

salaryForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // Get the values from the form inputs
    const salary = Number(salaryInput.value);
    const country = countrySelect.value;
    const taxYear = taxYearSelect.value;
    const payFrequency = payFrequencySelect.value;
    const loanPlan = studentLoanPlanSelect.value;
    const postgraduate = postgraduateLoanInput.checked;
    const repaymentFrequency = payrollFrequencySelect.value;

    // Clear any previous error message
    errorMessage.textContent = "";
    clearPensionError();
    clearLoanErrors();

    // Validate salary
    if (!Number.isFinite(salary) || salary <= 0) {
        errorMessage.textContent = "Please enter a valid salary greater than zero.";
        clearResults();
        return;
    }

    // Validate the selected pay frequency before calculating
    if (payFrequency !== "Annual" && payFrequency !== "Monthly") {
        errorMessage.textContent = "Please select Annual or Monthly pay frequency.";
        clearResults();
        return;
    }

    // Validate the selected country and tax year
    if (country !== uk2026TaxRules.country || taxYear !== uk2026TaxRules.taxYear) {
        errorMessage.textContent = "This country or tax year is not supported yet.";
        clearResults();
        return;
    }

    // Disabled pensions always contribute 0%, regardless of the field's value.
    const pensionRate = pensionEnabledInput.checked ? Number(pensionRateInput.value) : 0;
    if (pensionEnabledInput.checked && (
        pensionRateInput.value.trim() === "" || !Number.isFinite(pensionRate) ||
        pensionRate < 0 || pensionRate > 100
    )) {
        pensionError.textContent = "Please enter a pension percentage between 0 and 100.";
        pensionRateInput.setAttribute("aria-invalid", "true");
        clearResults();
        pensionRateInput.focus();
        return;
    }

    // Validate explicit selections before entering the calculation pipeline.
    if (!["none", "plan1", "plan2", "plan4", "plan5"].includes(loanPlan)) {
        studentLoanError.textContent = "Please select None, Plan 1, Plan 2, Plan 4 or Plan 5.";
        studentLoanPlanSelect.setAttribute("aria-invalid", "true");
        clearResults();
        studentLoanPlanSelect.focus();
        return;
    }
    if (typeof postgraduate !== "boolean") {
        studentLoanError.textContent = "Please select or clear the postgraduate loan checkbox.";
        postgraduateLoanInput.setAttribute("aria-invalid", "true");
        clearResults();
        postgraduateLoanInput.focus();
        return;
    }
    if (!["Monthly", "FourWeekly", "Weekly"].includes(repaymentFrequency)) {
        payrollError.textContent = "Please select Monthly, Every 4 Weeks or Weekly payroll.";
        payrollFrequencySelect.setAttribute("aria-invalid", "true");
        clearResults();
        payrollFrequencySelect.focus();
        return;
    }

    try {
        // 10. Salary and tax calculations - annualise before calculating deductions
        const annualSalary = calculateAnnualSalary(salary, payFrequency);

        // Monthly conversion must remain within JavaScript's numeric range
        if (!Number.isFinite(annualSalary)) {
            errorMessage.textContent = "This salary is too large to calculate. Please enter a smaller amount.";
            clearResults();
            return;
        }

        const pensionContribution = calculatePensionContribution(annualSalary, pensionRate);
        const salaryAfterPension = annualSalary - pensionContribution;

        // Use income after pension for both the allowance taper and taxable income.
        const taxableIncome = calculateTaxableIncome(salaryAfterPension, uk2026TaxRules);

        // Calculate the income tax based on the taxable income and tax rules
        const incomeTax = calculateIncomeTax(taxableIncome, uk2026TaxRules);

        // Net pay pensions do not reduce NI: use the original gross salary.
        const nationalInsurance = calculateNationalInsurance(annualSalary, uk2026TaxRules);

        // Use the same gross NI earnings, never income after net pay pension.
        const standardLoanRepayment = calculateStudentLoanRepayment(annualSalary, uk2026TaxRules, {
            plan: loanPlan === "none" ? null : loanPlan, repaymentFrequency
        });
        const postgraduateLoanRepayment = calculateStudentLoanRepayment(annualSalary, uk2026TaxRules, {
            postgraduate, repaymentFrequency
        });
        const studentLoanRepayment = standardLoanRepayment + postgraduateLoanRepayment;

        // Calculate the take-home pay after deductions
        const takeHomePay = calculateTakeHomePay(annualSalary, incomeTax, nationalInsurance, pensionContribution, studentLoanRepayment);

        // Calculate the take-home pay across different frequencies
        const payBreakdown = calculatePayBreakdown(takeHomePay, pensionContribution, {
            annualSalary, incomeTax, nationalInsurance, studentLoanRepayment,
            standardLoanRepayment, postgraduateLoanRepayment
        });

        // Calculate the total deductions for display
        const totalDeductions = payBreakdown.pension.annual + incomeTax + nationalInsurance + payBreakdown.studentLoan.annual;

        // 11. Chart components exclude the combined subtotal to avoid double counting.
        const chartAmounts = {
            "take-home": takeHomePay, "income-tax": incomeTax,
            "national-insurance": nationalInsurance, pension: pensionContribution,
            "student-loan": standardLoanRepayment, "postgraduate-loan": postgraduateLoanRepayment
        };

        // 12. Render monetary outputs, bar shares and rounded legend percentages

        annualPayElement.textContent = currencyFormatter.format(payBreakdown.annual);
        monthlyPayElement.textContent = currencyFormatter.format(payBreakdown.monthly);
        weeklyPayElement.textContent = currencyFormatter.format(payBreakdown.weekly);
        dailyPayElement.textContent = currencyFormatter.format(payBreakdown.daily);
        incomeTaxElement.textContent = currencyFormatter.format(incomeTax);
        nationalInsuranceElement.textContent = currencyFormatter.format(nationalInsurance);
        totalDeductionsElement.textContent = currencyFormatter.format(totalDeductions);
        pensionElement.textContent = currencyFormatter.format(payBreakdown.pension.annual);
        fourWeeklyPayElement.textContent = currencyFormatter.format(payBreakdown.fourWeekly);
        renderLoan(loanViews["standard-loan"], payBreakdown.standardStudentLoan, loanPlan !== "none");
        renderLoan(loanViews["postgraduate-loan"], payBreakdown.postgraduateLoan, postgraduate);
        renderLoan(loanViews["combined-loans"], payBreakdown.studentLoan, loanPlan !== "none" && postgraduate);
        const standardLabel = loanPlan === "none" ? "Student Loan" : `Student Loan — ${planLabels[loanPlan]}`;
        standardLoanLabel.textContent = `${standardLabel} (annual)`;
        studentLoanLegendLabel.textContent = standardLabel;
        summaryLoanLabel.textContent = loanPlan === "none"
            ? "Standard student loan" : `Standard student loan — ${planLabels[loanPlan]}`;
        loanAveragesNote.hidden = loanPlan === "none" && !postgraduate;

        // Very high pension rates can leave negative take-home pay because NI still applies.
        // A stacked bar cannot represent negative amounts; retain the numeric breakdown.
        salaryBar.hidden = takeHomePay < 0;
        breakdownNote.textContent = takeHomePay < 0
            ? "Deductions exceed gross salary. The chart is unavailable for negative take-home pay; see the amounts above and percentages below."
            : defaultBreakdownNote;
        salarySummary.hidden = false;
        for (const [key, amount] of Object.entries(chartAmounts)) {
            const view = chartViews[key];
            const percentage = calculatePercentage(amount, annualSalary);
            view.segment.style.setProperty("--share", Math.max(0, percentage));
            view.segment.hidden = amount <= 0;
            // Retain signed negative take-home in the textual legend when the bar is hidden.
            view.legend.hidden = amount === 0;
            view.percentage.textContent = `${percentage.toFixed(2)}%`;
            // Reuse the chart amounts, including signed negative take-home.
            view.summaryRow.hidden = amount === 0;
            view.summaryAmount.textContent = currencyFormatter.format(amount);
        }
        resultsStatus.textContent = `Annual take-home pay ${currencyFormatter.format(takeHomePay)}. ` +
            `Total annual deductions ${currencyFormatter.format(totalDeductions)}, including ` +
            `${currencyFormatter.format(studentLoanRepayment)} in student and postgraduate loans.`;

        // 13. Debugging and error handling - retain details for troubleshooting
        console.log("Form submitted!");
        console.log("Entered Salary:", salary);
        console.log("Country:", country);
        console.log("Tax Year:", taxYear);
        console.log("Pay Frequency:", payFrequency);
        console.log("Annual Gross Salary:", annualSalary);
        console.log("Taxable Income:", taxableIncome);
        console.log("Income Tax:", incomeTax);
        console.log("National Insurance:", nationalInsurance);
        console.log("Annual Net Salary:", takeHomePay);
        console.log("Annual Net Take-Home Pay:", payBreakdown.annual);
        console.log("Monthly Take-Home Pay:", payBreakdown.monthly);
        console.log("Weekly Take-Home Pay:", payBreakdown.weekly);
        console.log("Daily Take-Home Pay:", payBreakdown.daily);
    } catch (error) {
        // Clear partial results if calculation or rendering fails.
        clearResults();
        errorMessage.textContent = "Unable to calculate your take-home pay. Please try again.";
        console.error("Take-home pay calculation failed:", error);
    }
});

// Reaching this point confirms the module registered its event listeners.
console.log("Pay Calc JavaScript loaded successfully!");
