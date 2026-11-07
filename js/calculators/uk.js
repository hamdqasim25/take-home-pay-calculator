
// STEP 1: Convert salary to annual gross income
/**
 * Convert the entered salary to annual gross income.
 * @param {number} salary Gross salary for the selected frequency.
 * @param {string} payFrequency "Annual" or "Monthly".
 * @returns {number} Annual gross salary.
 */
export function calculateAnnualSalary(salary, payFrequency) {
    if (payFrequency === "Annual") {
        return salary;
    } else if (payFrequency === "Monthly") {
        return salary * 12;
    }

    // Handle unsupported pay frequencies
    throw new Error("Unsupported pay frequency");
}


// STEP 2: Calculate pension contributions
/**
 * Calculate net pay employee contributions on the full gross salary.
 * @param {number} annualSalary Annual gross salary before deductions.
 * @param {number} [pensionRate=0] Percentage from 0 to 100 (5 means 5%).
 * @returns {number} Annual pension contribution, without intermediate rounding.
 * @throws {RangeError} If the rate is not a finite number from 0 to 100.
 */
export function calculatePensionContribution(annualSalary, pensionRate = 0) {
    if (!Number.isFinite(pensionRate) || pensionRate < 0 || pensionRate > 100) {
        throw new RangeError("Pension rate must be a finite number between 0 and 100.");
    }

    return annualSalary * (pensionRate / 100);
}

// STEP 3: Calculate taxable income
/**
 * Deduct the Personal Allowance, including its higher-income taper.
 * @param {number} annualSalary Salary after net pay pension contributions.
 *   Pass gross salary when there is no pension. Do not deduct the pension again.
 * @param {object} taxRules Selected tax year's allowance and taper rules.
 * @returns {number} Non-negative taxable income after the adjusted allowance.
 */
export function calculateTaxableIncome(annualSalary, taxRules) {
    let adjustedPersonalAllowance = taxRules.personalAllowance;

    // Reduce the Personal Allowance for higher earners
    if (annualSalary > taxRules.personalAllowanceTaperThreshold) {
        const taperAmount = (annualSalary - taxRules.personalAllowanceTaperThreshold) * taxRules.personalAllowanceTaperRate;
        adjustedPersonalAllowance = Math.max(0, adjustedPersonalAllowance - taperAmount);
    }

    // Taxable income cannot be negative
    return Math.max(0, annualSalary - adjustedPersonalAllowance);
}


// STEP 4: Calculate Income Tax
/**
 * Apply progressive tax bands to income after pension and allowance deductions.
 * @param {number} taxableIncome Annual taxable income from step 3.
 * @param {object} taxRules Selected tax year's Income Tax bands.
 * @returns {number} Annual Income Tax.
 */
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


// STEP 5: Calculate National Insurance
/**
 * Calculate employee NI using gross earnings: net pay pensions do not reduce NI.
 * @param {number} annualSalary Original annual gross salary before pension.
 * @param {object} taxRules Selected tax year's National Insurance bands.
 * @returns {number} Annual employee National Insurance.
 */
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

// STEP 6: Calculate take-home pay and salary breakdown
/**
 * Subtract employee pension, Income Tax and NI from gross salary.
 * @param {number} annualSalary Original annual gross salary.
 * @param {number} incomeTax Annual Income Tax after pension relief.
 * @param {number} nationalInsurance Annual NI on original gross salary.
 * @param {number} [pensionContribution=0] Annual pension amount, not a percentage.
 * @returns {number} Annual take-home pay.
 */
export function calculateTakeHomePay(annualSalary, incomeTax, nationalInsurance, pensionContribution = 0) {
    return annualSalary - pensionContribution - incomeTax - nationalInsurance;
}


/**
 * Split salary amounts into periods; round only when displaying money.
 * @param {number} annualTakeHomePay Annual take-home pay from step 6.
 * @param {number} [pensionContribution=0] Annual employee pension amount.
 * @param {{annualSalary: number, incomeTax: number, nationalInsurance: number}} [details]
 *   Optional annual gross and tax amounts, already calculated in earlier steps.
 * @returns {object} Take-home period fields and nested pension periods. When
 *   details are supplied, also includes gross, incomeTax and nationalInsurance
 *   period objects. Every period object uses annual, monthly, fourWeekly,
 *   weekly and daily keys. Existing one- and two-argument calls remain valid.
 */
export function calculatePayBreakdown(annualTakeHomePay, pensionContribution = 0, details) {
    return {
        ...splitAnnualAmount(annualTakeHomePay),
        pension: splitAnnualAmount(pensionContribution),
        ...(details === undefined ? {} : {
            gross: splitAnnualAmount(details.annualSalary),
            incomeTax: splitAnnualAmount(details.incomeTax),
            nationalInsurance: splitAnnualAmount(details.nationalInsurance)
        })
    };
}

/**
 * Convert one unrounded annual amount to average amounts for each output period.
 * @param {number} annualAmount Annual gross pay, deduction or take-home amount.
 * @returns {object} Annual, monthly, four-weekly, weekly and daily amounts.
 */
function splitAnnualAmount(annualAmount) {
    return {
        annual: annualAmount,
        monthly: annualAmount / 12,
        fourWeekly: annualAmount / 13,
        weekly: annualAmount / 52,
        daily: annualAmount / 365
    };
}

// Display helper: express deductions and take-home pay as shares of gross salary.
/**
 * Calculate an amount's percentage share, returning zero for a zero total.
 * @param {number} amount Amount to express as a percentage.
 * @param {number} total Total against which to compare the amount.
 * @returns {number} Percentage share.
 */
export function calculatePercentage(amount, total) {
    if (total === 0) {
        return 0; // Avoid division by zero
    }
    return (amount / total) * 100;
}
