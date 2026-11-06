
// Convert the entered salary into an annual salary
export function calculateAnnualSalary(salary, payFrequency) {
    if (payFrequency === "Annual") {
        return salary;
    } else if (payFrequency === "Monthly") {
        return salary * 12;
    }

    // Handle unsupported pay frequencies
    throw new Error("Unsupported pay frequency");
}


// Calculate taxable income based on annual salary and tax rules
export function calculateTaxableIncome(annualSalary, taxRules) {
    let adjustedPersonalAllowance = taxRules.personalAllowance;

    // Reduce the Personal Allowance for higher earners
    if (annualSalary > taxRules.personalAllowanceTaperThreshold) {
        const taperAmount = (annualSalary - taxRules.personalAllowanceTaperThreshold)* taxRules.personalAllowanceTaperRate;
        adjustedPersonalAllowance = Math.max(0,adjustedPersonalAllowance - taperAmount);
    }

    // Taxable income cannot be negative
    return Math.max(0, annualSalary - adjustedPersonalAllowance);
}


// Calculate progressive Income Tax
export function calculateIncomeTax(taxableIncome, taxRules) {
    let totalTax = 0;
    let previousLimit = 0;

    // Calculate tax for each band
    for (const band of taxRules.incomeTaxBands) {
        const incomeInBand = Math.max(0, Math.min(taxableIncome, band.upTo) - previousLimit);
        const taxForBand = incomeInBand * band.rate;
        totalTax += taxForBand;
        previousLimit = band.upTo;
    }

    return totalTax;
}


// Calculate annual employee National Insurance
export function calculateNationalInsurance(annualSalary, taxRules) {
    let totalNI = 0;
    let previousLimit = 0;

    // Calculate National Insurance for each band
    for (const band of taxRules.nationalInsuranceBands) {
        const incomeInBand = Math.max(0, Math.min(annualSalary, band.upTo) - previousLimit);
        const niForBand = incomeInBand * band.rate;
        totalNI += niForBand;
        previousLimit = band.upTo;
    }

    return totalNI;
}


// Calculate take-home pay after deductions
export function calculateTakeHomePay(annualSalary, incomeTax, nationalInsurance) {
    return annualSalary - incomeTax - nationalInsurance;
}


// Calculate take-home pay across different frequencies
export function calculatePayBreakdown(annualTakeHomePay) {

    return {
        annual: annualTakeHomePay,
        monthly: annualTakeHomePay / 12,
        weekly: annualTakeHomePay / 52,
        daily: annualTakeHomePay / 365
    };
}


// Calculate the percentage of an amount relative to a total
export function calculatePercentage(amount, total) {
    if (total === 0) {
        return 0; // Avoid division by zero
    }
    return (amount / total) * 100;
}