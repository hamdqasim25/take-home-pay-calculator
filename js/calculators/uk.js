
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

// STEP 6: Calculate student loan repayments
/**
 * Estimate annual PAYE repayments from gross earnings subject to Class 1 NI.
 * Net pay pension contributions and the Personal Allowance must NOT be deducted
 * from these earnings. This is the NI earnings basis, not the amount of NI due.
 *
 * Assumes equal earnings in every repayment period for a full year. Thresholds
 * are rounded down to pennies; each loan deduction is rounded down separately
 * to whole pounds per base period before annualising. FourWeekly and Fortnightly
 * use average weekly earnings, floor each weekly loan, then multiply by 4 or 2.
 * Annual is a single annual pay
 * period, not a prediction of monthly payroll. Salary input frequency and actual
 * repayment frequency are independent. Bonuses, irregular/partial years, extra
 * paydays, loan balances, start/stop notices and protected earnings are not modelled.
 *
 * @param {number} annualNIEarnings Annual Class 1 NI gross earnings, before net pay pension.
 * @param {object} taxRules Selected tax year's studentLoans configuration.
 * @param {object} [options={}] Loan selection and actual repayment frequency.
 * @param {null|"plan1"|"plan2"|"plan4"|"plan5"} [options.plan=null] One standard plan.
 * @param {boolean} [options.postgraduate=false] Also repay a postgraduate loan.
 * @param {string} [options.repaymentFrequency="Annual"] Annual, Monthly,
 *   FourWeekly, Fortnightly or Weekly (1, 12, 13, 26 or 52 periods).
 * @returns {number} Combined annual repayment estimate in whole pounds; zero
 *   when no loan is selected or no repayment is due.
 * @throws {RangeError} For invalid earnings, selection, frequency or selected rules.
 */
export function calculateStudentLoanRepayment(annualNIEarnings, taxRules, options = {}) {
    // 1. Validate inputs without coercion or silently accepting multiple plans.
    if (!Number.isFinite(annualNIEarnings) || annualNIEarnings < 0) {
        throw new RangeError("Student loan earnings must be a finite non-negative number.");
    }
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
        throw new RangeError("Student loan options must be an object.");
    }
    const { plan = null, postgraduate = false, repaymentFrequency = "Annual" } = options;
    if (plan !== null && !["plan1", "plan2", "plan4", "plan5"].includes(plan)) {
        throw new RangeError("Student loan plan must be null or one of plan1, plan2, plan4, plan5.");
    }
    if (typeof postgraduate !== "boolean") {
        throw new RangeError("Postgraduate selection must be a boolean.");
    }
    const periodsByFrequency = { Annual: 1, Monthly: 12, FourWeekly: 13, Fortnightly: 26, Weekly: 52 };
    if (typeof repaymentFrequency !== "string" || !Object.hasOwn(periodsByFrequency, repaymentFrequency)) {
        throw new RangeError("Unsupported student loan repayment frequency.");
    }

    // 2. Select at most one 9% loan and the optional independent postgraduate loan.
    const selected = [];
    if (plan !== null) selected.push(plan);
    if (postgraduate) selected.push("postgraduate");
    const periods = periodsByFrequency[repaymentFrequency];
    // HMRC SL3: multiples of a week use the rounded average-week deduction.
    // https://www.gov.uk/government/publications/sl3-student-loan-deduction-tables/2026-to-2027-student-and-postgraduate-loan-deduction-tables
    const weeksPerPeriod = repaymentFrequency === "FourWeekly" ? 4 : repaymentFrequency === "Fortnightly" ? 2 : 1;
    const basePeriods = periods * weeksPerPeriod;
    const periodEarnings = annualNIEarnings / basePeriods;
    let annualRepayment = 0;

    // 3. Apply each selected threshold and rate, then annualise rounded deductions.
    for (const key of selected) {
        const rule = taxRules?.studentLoans?.[key];
        if (!rule || !Number.isFinite(rule.annualThreshold) || rule.annualThreshold < 0 ||
            !Number.isSafeInteger(Math.round(rule.annualThreshold * 100)) ||
            !Number.isFinite(rule.rate) || rule.rate < 0 || rule.rate > 1) {
            throw new RangeError("Invalid student loan threshold or rate for " + key + ".");
        }
        const periodThreshold = Math.floor(Math.round(rule.annualThreshold * 100) / basePeriods) / 100;
        const unrounded = Math.max(0, periodEarnings - periodThreshold) * rule.rate;
        // Correct only floating-point noise at an exact whole-pound boundary.
        const periodRepayment = Math.floor(unrounded + Number.EPSILON * Math.max(1, unrounded) * 4);
        annualRepayment += (periodRepayment * weeksPerPeriod) * periods;
    }

    // 4. Return the combined annual deduction for take-home pay and breakdowns.
    if (!Number.isFinite(annualRepayment)) {
        throw new RangeError("Student loan repayment exceeds the supported numeric range.");
    }
    return annualRepayment;
}

// STEP 7: Calculate take-home pay and salary breakdown
/**
 * Subtract employee pension, Income Tax, NI and loan repayments from gross salary.
 * @param {number} annualSalary Original annual gross salary.
 * @param {number} incomeTax Annual Income Tax after pension relief.
 * @param {number} nationalInsurance Annual NI on original gross salary.
 * @param {number} [pensionContribution=0] Annual pension amount, not a percentage.
 * @param {number} [studentLoanRepayment=0] Combined annual standard/postgraduate repayment.
 * @returns {number} Annual take-home pay.
 */
export function calculateTakeHomePay(annualSalary, incomeTax, nationalInsurance, pensionContribution = 0, studentLoanRepayment = 0) {
    return annualSalary - pensionContribution - incomeTax - nationalInsurance - studentLoanRepayment;
}


/**
 * Split salary amounts into periods; round only when displaying money.
 * @param {number} annualTakeHomePay Annual take-home pay from step 7.
 * @param {number} [pensionContribution=0] Annual employee pension amount.
 * @param {{annualSalary: number, incomeTax: number, nationalInsurance: number, studentLoanRepayment?: number, standardLoanRepayment?: number, postgraduateLoanRepayment?: number}} [details]
 *   Optional annual gross and tax amounts, already calculated in earlier steps.
 * @returns {object} Take-home period fields and nested pension periods. When
 *   details are supplied, also includes gross, incomeTax and nationalInsurance
 *   period objects. Every period object uses annual, monthly, fourWeekly,
 *   weekly and daily keys. Optional details.studentLoanRepayment adds studentLoan
 *   periods (combined standard/postgraduate). These are averages of the annual
 *   estimate, not recalculated payroll deductions at each displayed frequency.
 *   Optional standardLoanRepayment and postgraduateLoanRepayment add separate
 *   standardStudentLoan and postgraduateLoan period objects; no repayments are
 *   recalculated here and the combined subtotal is not an additional deduction.
 *   Omitting it preserves the existing return shape and all earlier calls.
 */
export function calculatePayBreakdown(annualTakeHomePay, pensionContribution = 0, details) {
    return {
        ...splitAnnualAmount(annualTakeHomePay),
        pension: splitAnnualAmount(pensionContribution),
        ...(details === undefined ? {} : {
            gross: splitAnnualAmount(details.annualSalary),
            incomeTax: splitAnnualAmount(details.incomeTax),
            nationalInsurance: splitAnnualAmount(details.nationalInsurance),
            ...(details.studentLoanRepayment === undefined ? {} : {
                studentLoan: splitAnnualAmount(details.studentLoanRepayment)
            }),
            ...(details.standardLoanRepayment === undefined ? {} : {
                standardStudentLoan: splitAnnualAmount(details.standardLoanRepayment)
            }),
            ...(details.postgraduateLoanRepayment === undefined ? {} : {
                postgraduateLoan: splitAnnualAmount(details.postgraduateLoanRepayment)
            })
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
