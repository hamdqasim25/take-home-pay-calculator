// Import the necessary functions and tax rules

import {
    calculateAnnualSalary,
    calculateTaxableIncome,
    calculateIncomeTax,
    calculateNationalInsurance,
    calculateTakeHomePay,
    calculatePayBreakdown
} from "./calculators/uk.js";

import { uk2026TaxRules } from "./tax-rules/uk-2026-27.js";

// Log a message to the console to indicate that the script has loaded
console.log("Pay Calc JavaScript loaded successfully!");

// Get references to the form and its input elements

const salaryForm = document.getElementById("salary-form");
const salaryInput = document.getElementById("salary");
const countrySelect = document.getElementById("country");
const taxYearSelect = document.getElementById("tax-year");
const payFrequencySelect = document.getElementById("pay-frequency");
const errorMessage = document.getElementById("error-message");

// Add an event listener to the form submission

salaryForm.addEventListener("submit", function(event) {
    event.preventDefault();

    // Get the values from the form inputs
    const salary = Number(salaryInput.value);
    const country = countrySelect.value;
    const taxYear = taxYearSelect.value;
    const payFrequency = payFrequencySelect.value;

    // Clear any previous error message
    errorMessage.textContent = "";

    // Validate salary
    if (!Number.isFinite(salary) || salary <= 0) {
        errorMessage.textContent = "Please enter a valid salary greater than zero.";
        return;
    }

    // Validate the selected country and tax year
    if (
        country !== uk2026TaxRules.country || taxYear !== uk2026TaxRules.taxYear) {
        errorMessage.textContent ="This country or tax year is not supported yet.";
        return;
    }

    // Calculate the annual salary based on the pay frequency
    const annualSalary = calculateAnnualSalary(salary, payFrequency);

    // Calculate the taxable income based on the annual salary and tax rules
    const taxableIncome = calculateTaxableIncome(annualSalary, uk2026TaxRules);

    // Calculate the income tax based on the taxable income and tax rules
    const incomeTax = calculateIncomeTax(taxableIncome, uk2026TaxRules);

    // Calculate the National Insurance based on the annual salary and tax rules
    const nationalInsurance = calculateNationalInsurance(annualSalary, uk2026TaxRules);

    // Calculate the take-home pay after deductions
    const takeHomePay = calculateTakeHomePay(annualSalary, incomeTax, nationalInsurance);

    // Calculate the take-home pay across different frequencies
    const payBreakdown = calculatePayBreakdown(takeHomePay);

    // Log the form values to the console for debugging
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
});