// 1. Imports and tax rules

import {
    calculateAnnualSalary,
    calculatePensionContribution,
    calculateTaxableIncome,
    calculateIncomeTax,
    calculateNationalInsurance,
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

// 5. DOM references - cache salary segments and legend labels for rendering and resets
const takeHomeSegment = document.querySelector(".salary-segment.breakdown-take-home");
const incomeTaxSegment = document.querySelector(".salary-segment.breakdown-income-tax");
const nationalInsuranceSegment = document.querySelector(".salary-segment.breakdown-national-insurance");
const pensionSegment = document.querySelector(".salary-segment.breakdown-pension");
const salaryBar = document.querySelector(".salary-bar");
const breakdownNote = document.querySelector(".breakdown-note");
const defaultBreakdownNote = breakdownNote.textContent;

const takeHomePercentageLabel = document.querySelector(".take-home-percentage");
const incomeTaxPercentageLabel = document.querySelector(".income-tax-percentage");
const nationalInsurancePercentageLabel = document.querySelector(".national-insurance-percentage");
const pensionPercentageLabel = document.querySelector(".pension-percentage");

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
    pensionPercentageLabel.textContent = "0%";
    pensionSegment.style.setProperty("--share", 0);
    salaryBar.hidden = false;
    breakdownNote.textContent = defaultBreakdownNote;
    takeHomePercentageLabel.textContent = "0%";
    incomeTaxPercentageLabel.textContent = "0%";
    nationalInsurancePercentageLabel.textContent = "0%";

    takeHomeSegment.style.setProperty("--share", 0);
    incomeTaxSegment.style.setProperty("--share", 0);
    nationalInsuranceSegment.style.setProperty("--share", 0);
}

function resetResults() {
    errorMessage.textContent = "";
    clearPensionError();
    clearResults(currencyFormatter.format(0));
}

function clearPensionError() {
    pensionError.textContent = "";
    pensionRateInput.setAttribute("aria-invalid", "false");
}

// 8. Input listeners - discard stale results when salary details change
salaryInput.addEventListener("input", resetResults);
salaryInput.addEventListener("change", resetResults);
countrySelect.addEventListener("change", resetResults);
taxYearSelect.addEventListener("change", resetResults);
payFrequencySelect.addEventListener("change", resetResults);
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

    // Clear any previous error message
    errorMessage.textContent = "";
    clearPensionError();

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

        // Calculate the take-home pay after deductions
        const takeHomePay = calculateTakeHomePay(annualSalary, incomeTax, nationalInsurance, pensionContribution);

        // Calculate the take-home pay across different frequencies
        const payBreakdown = calculatePayBreakdown(takeHomePay, pensionContribution, {
            annualSalary, incomeTax, nationalInsurance
        });

        // Calculate the total deductions for display
        const totalDeductions = payBreakdown.pension.annual + incomeTax + nationalInsurance;

        // 11. Salary percentages - use the same annual amounts as the results
        const takeHomePayPercentage = calculatePercentage(takeHomePay, annualSalary);
        const incomeTaxPercentage = calculatePercentage(incomeTax, annualSalary);
        const nationalInsurancePercentage = calculatePercentage(nationalInsurance, annualSalary);
        const pensionPercentage = calculatePercentage(payBreakdown.pension.annual, annualSalary);

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

        // Very high pension rates can leave negative take-home pay because NI still applies.
        // A stacked bar cannot represent negative amounts; retain the numeric breakdown.
        salaryBar.hidden = takeHomePay < 0;
        breakdownNote.textContent = takeHomePay < 0
            ? "Deductions exceed gross salary. The chart is unavailable for negative take-home pay; see the amounts above and percentages below."
            : defaultBreakdownNote;
        takeHomeSegment.style.setProperty("--share", Math.max(0, takeHomePayPercentage));
        incomeTaxSegment.style.setProperty("--share", incomeTaxPercentage);
        nationalInsuranceSegment.style.setProperty("--share", nationalInsurancePercentage);
        pensionSegment.style.setProperty("--share", pensionPercentage);

        takeHomePercentageLabel.textContent = `${takeHomePayPercentage.toFixed(2)}%`;
        incomeTaxPercentageLabel.textContent = `${incomeTaxPercentage.toFixed(2)}%`;
        nationalInsurancePercentageLabel.textContent = `${nationalInsurancePercentage.toFixed(2)}%`;
        pensionPercentageLabel.textContent = `${pensionPercentage.toFixed(2)}%`;

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
