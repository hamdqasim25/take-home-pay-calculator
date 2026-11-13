import test from "node:test";
import assert from "node:assert/strict";

import {
    calculateAnnualSalary,
    calculatePensionContribution,
    calculateTaxableIncome,
    calculateIncomeTax,
    calculateNationalInsurance,
    calculateStudentLoanRepayment,
    calculateTakeHomePay,
    calculatePayBreakdown
} from "../js/calculators/uk.js";

import { uk2026TaxRules } from "../js/tax-rules/uk-2026-27.js";

test("Monthly salary converts to annual", () => {
    assert.equal(
        calculateAnnualSalary(2500, "Monthly"),
        30000
    );
});

test("Personal Allowance is deducted correctly", () => {
    assert.equal(
        calculateTaxableIncome(35000, uk2026TaxRules),
        22430
    );
});

test("Income Tax is calculated progressively", () => {
    assert.equal(
        calculateIncomeTax(22430, uk2026TaxRules),
        4486
    );
});

// Additional unit coverage requested when persisting the original form checks.
test("Annual salary is unchanged and monthly decimals are annualised", () => {
    assert.equal(calculateAnnualSalary(35000, "Annual"), 35000);
    assert.equal(calculateAnnualSalary(2500.25, "Monthly"), 30003);
});

test("Salary conversion throws for unsupported or incorrectly cased frequencies", () => {
    for (const frequency of ["", "Weekly", "annual", "monthly"]) {
        assert.throws(() => calculateAnnualSalary(2500, frequency), /Unsupported pay frequency/);
    }
});

test("Taxable income stays at zero up to the Personal Allowance", () => {
    for (const salary of [0, 12569, 12570]) {
        assert.equal(calculateTaxableIncome(salary, uk2026TaxRules), 0);
    }
    assert.equal(calculateTaxableIncome(12571, uk2026TaxRules), 1);
});

test("Personal Allowance tapers above £100000 and cannot become negative", () => {
    for (const [salary, taxable] of [
        [99999, 87429], [100000, 87430], [100002, 87433],
        [110000, 102430], [125140, 125140], [150000, 150000]
    ]) {
        assert.equal(calculateTaxableIncome(salary, uk2026TaxRules), taxable);
    }
});

test("Income Tax crosses each configured taxable-income band progressively", () => {
    // These are taxable-income inputs, preserving the existing engine/rules.
    for (const [taxable, expected] of [
        [0, 0], [37699, 7539.8], [37700, 7540], [37701, 7540.4],
        [125139, 42515.6], [125140, 42516], [125141, 42516.45],
        [150000, 53703]
    ]) {
        assert.ok(Math.abs(calculateIncomeTax(taxable, uk2026TaxRules) - expected) < 1e-8);
    }
});

test("National Insurance crosses the primary and upper thresholds", () => {
    for (const [salary, expected] of [
        [0, 0], [12569, 0], [12570, 0], [12571, 0.08],
        [35000, 1794.4], [50269, 3015.92], [50270, 3016],
        [50271, 3016.02], [60000, 3210.6]
    ]) {
        assert.ok(Math.abs(calculateNationalInsurance(salary, uk2026TaxRules) - expected) < 1e-8);
    }
});

test("Take-home pay subtracts Income Tax and National Insurance", () => {
    assert.equal(calculateTakeHomePay(35000, 4486, 1794.4), 28719.6);
    assert.equal(calculateTakeHomePay(30000, 3486, 1394.4), 25119.6);
});

test("Pay breakdown uses annual, monthly, weekly and daily frequencies", () => {
    assert.deepEqual(calculatePayBreakdown(227760), {
        annual: 227760, monthly: 18980, fourWeekly: 17520, weekly: 4380, daily: 624,
        pension: { annual: 0, monthly: 0, fourWeekly: 0, weekly: 0, daily: 0 }
    });
    assert.deepEqual(calculatePayBreakdown(0), {
        annual: 0, monthly: 0, fourWeekly: 0, weekly: 0, daily: 0,
        pension: { annual: 0, monthly: 0, fourWeekly: 0, weekly: 0, daily: 0 }
    });
});

// Exercise the six public calculation steps together, with no DOM dependencies.
function calculateWithPension(salary, payFrequency, pensionRate, taxRules = uk2026TaxRules) {
    const annualSalary = calculateAnnualSalary(salary, payFrequency);
    const pensionContribution = calculatePensionContribution(annualSalary, pensionRate);
    const salaryAfterPension = annualSalary - pensionContribution;
    const taxableIncome = calculateTaxableIncome(salaryAfterPension, taxRules);
    const incomeTax = calculateIncomeTax(taxableIncome, taxRules);
    const nationalInsurance = calculateNationalInsurance(annualSalary, taxRules);
    const takeHomePay = calculateTakeHomePay(annualSalary, incomeTax, nationalInsurance, pensionContribution);
    return {
        annualSalary, pensionContribution, salaryAfterPension, taxableIncome,
        incomeTax, nationalInsurance, takeHomePay,
        breakdown: calculatePayBreakdown(takeHomePay, pensionContribution, {
            annualSalary, incomeTax, nationalInsurance
        })
    };
}

test("Omitted and zero pension rates preserve existing salary calculations", () => {
    for (const salary of [0, 12570, 35000, 60000, 100000, 110000, 125140, 150000]) {
        const result = calculateWithPension(salary, "Annual");
        assert.deepEqual(result, calculateWithPension(salary, "Annual", 0));
        const tax = calculateIncomeTax(calculateTaxableIncome(salary, uk2026TaxRules), uk2026TaxRules);
        const ni = calculateNationalInsurance(salary, uk2026TaxRules);
        assert.equal(result.takeHomePay, calculateTakeHomePay(salary, tax, ni));
        assert.equal(result.pensionContribution, 0);
    }
});

test("5% of £35000 matches the net pay pension reference amounts", () => {
    const result = calculateWithPension(35000, "Annual", 5);
    assert.equal(result.pensionContribution, 1750);
    assert.equal(result.salaryAfterPension, 33250);
    assert.equal(result.taxableIncome, 20680);
    assert.equal(result.incomeTax, 4136);
    assert.equal(result.nationalInsurance, 1794.4);
    assert.equal(result.takeHomePay, 27319.6);
    const withoutPension = calculateWithPension(35000, "Annual");
    assert.equal(withoutPension.incomeTax - result.incomeTax, 350);
    assert.equal(result.nationalInsurance, withoutPension.nationalInsurance);
});

test("Pension restores tapered allowance without deducting contributions twice", () => {
    const result = calculateWithPension(110000, "Annual", 5);
    assert.equal(result.pensionContribution, 5500);
    assert.equal(result.salaryAfterPension, 104500);
    assert.equal(result.taxableIncome, 94180); // Allowance: 12570 - 2250 = 10320.
    assert.equal(result.incomeTax, 30132);
    const withoutPension = calculateWithPension(110000, "Annual");
    assert.equal(withoutPension.incomeTax - result.incomeTax, 3300);
    assert.equal(result.nationalInsurance, withoutPension.nationalInsurance);

    const restored = calculateWithPension(125000, "Annual", 20);
    assert.equal(restored.salaryAfterPension, 100000);
    assert.equal(restored.taxableIncome, 87430);
});

test("Pension supports fractional percentages and both inclusive rate limits", () => {
    assert.equal(calculatePensionContribution(35000), 0);
    assert.equal(calculatePensionContribution(35000, 0), 0);
    assert.equal(calculatePensionContribution(35000, 2.5), 875);
    assert.equal(calculatePensionContribution(35000, 100), 35000);
    assert.equal(calculateWithPension(35000, "Annual", 100).incomeTax, 0);
    assert.equal(calculateWithPension(35000, "Annual", 100).nationalInsurance, 1794.4);
    assert.equal(calculatePensionContribution(1e308, 100), 1e308);
});

test("Invalid pension percentages are rejected without coercion", () => {
    for (const rate of [-1, 100.01, NaN, Infinity, -Infinity, "5", "", null, true, {}, []]) {
        assert.throws(() => calculatePensionContribution(35000, rate), {
            name: "RangeError", message: /Pension rate/
        });
    }
});

test("Annual and monthly salary inputs produce identical pension results", () => {
    assert.deepEqual(
        calculateWithPension(3000, "Monthly", 5),
        calculateWithPension(36000, "Annual", 5)
    );
});

test("Take-home and pension breakdowns retain precision across all periods", () => {
    const result = calculateWithPension(35000.25, "Annual", 5.25);
    for (const [period, divisor] of [["annual", 1], ["monthly", 12], ["fourWeekly", 13], ["weekly", 52], ["daily", 365]]) {
        assert.equal(result.breakdown[period], result.takeHomePay / divisor);
        assert.equal(result.breakdown.pension[period], result.pensionContribution / divisor);
    }
    const reference = calculateWithPension(35000, "Annual", 5).breakdown;
    assert.equal(reference.monthly.toFixed(2), "2276.63");
    assert.equal(reference.weekly.toFixed(2), "525.38");
    assert.equal(reference.pension.monthly.toFixed(2), "145.83");
    assert.equal(reference.pension.weekly.toFixed(2), "33.65");
});

test("Pension flow continues to use the supplied tax-year rules", () => {
    const rules = {
        personalAllowance: 10000,
        personalAllowanceTaperThreshold: 100000,
        personalAllowanceTaperRate: 0.5,
        incomeTaxBands: [{ upTo: Infinity, rate: 0.1 }],
        nationalInsuranceBands: [{ upTo: Infinity, rate: 0.05 }]
    };
    const result = calculateWithPension(35000, "Annual", 5, rules);
    assert.equal(result.taxableIncome, 23250);
    assert.equal(result.incomeTax, 2325);
    assert.equal(result.nationalInsurance, 1750);
});

for (const pensionRate of [0, 5]) {
    test(`Four-weekly amounts use unrounded annual values with ${pensionRate}% pension`, () => {
        const result = calculateWithPension(35000, "Annual", pensionRate);
        const breakdown = result.breakdown;
        for (const [category, amount] of [
            ["gross", 35000], ["incomeTax", result.incomeTax],
            ["nationalInsurance", 1794.4], ["pension", result.pensionContribution]
        ]) {
            assert.equal(breakdown[category].fourWeekly, amount / 13);
            assert.equal(breakdown[category].monthly, amount / 12);
            assert.equal(breakdown[category].weekly, amount / 52);
            assert.equal(breakdown[category].daily, amount / 365);
        }
        assert.equal(breakdown.fourWeekly, result.takeHomePay / 13);
        assert.equal(breakdown.gross.fourWeekly.toFixed(2), "2692.31");
        assert.equal(breakdown.fourWeekly.toFixed(2), pensionRate === 0 ? "2209.20" : "2101.51");
        assert.equal(breakdown.incomeTax.fourWeekly.toFixed(2), pensionRate === 0 ? "345.08" : "318.15");
        assert.equal(breakdown.nationalInsurance.fourWeekly.toFixed(2), "138.03");
        assert.equal(breakdown.pension.fourWeekly.toFixed(2), pensionRate === 0 ? "0.00" : "134.62");
        const reconciled = breakdown.fourWeekly + breakdown.incomeTax.fourWeekly +
            breakdown.nationalInsurance.fourWeekly + breakdown.pension.fourWeekly;
        assert.ok(Math.abs(reconciled - breakdown.gross.fourWeekly) < 1e-8);
    });
}

test("Monthly decimal salary preserves precision in every four-weekly amount", () => {
    const monthly = calculateWithPension(2500.25, "Monthly", 5.25);
    const annual = calculateWithPension(30003, "Annual", 5.25);
    assert.deepEqual(monthly.breakdown, annual.breakdown);
    assert.equal(monthly.breakdown.gross.fourWeekly, 30003 / 13);
    assert.equal(monthly.breakdown.pension.fourWeekly, (30003 * 0.0525) / 13);
    assert.equal(monthly.breakdown.gross.fourWeekly.toFixed(2), "2307.92");
});

test("Four-weekly remains an output only and negative amounts retain their sign", () => {
    assert.throws(() => calculateAnnualSalary(2500, "FourWeekly"), /Unsupported/);
    const result = calculateWithPension(35000, "Annual", 100);
    assert.equal(result.breakdown.fourWeekly, -1794.4 / 13);
});

// Phase 4.4.1: student loans. Expected thresholds/rates are independent fixtures
// from HMRC's 2026-27 payroll specification, not copied from runtime config.
const loanCases = [
    ["plan1", 26900, 0.09], ["plan2", 29385, 0.09],
    ["plan4", 33795, 0.09], ["plan5", 25000, 0.09],
    ["postgraduate", 21000, 0.06]
];
const selectionFor = key => key === "postgraduate" ? { postgraduate: true } : { plan: key };

for (const [key, threshold, rate] of loanCases) {
    test(`${key}: 2026-27 rules and annual threshold boundaries`, () => {
        assert.deepEqual(uk2026TaxRules.studentLoans[key], { annualThreshold: threshold, rate });
        for (const earnings of [0, threshold - 0.01, threshold, threshold + 0.01, threshold + 1]) {
            assert.equal(calculateStudentLoanRepayment(earnings, uk2026TaxRules, selectionFor(key)), 0);
        }
        assert.equal(calculateStudentLoanRepayment(threshold + 10000, uk2026TaxRules, selectionFor(key)), rate * 10000);
        assert.equal(calculateStudentLoanRepayment(threshold + 1234.56, uk2026TaxRules, selectionFor(key)), Math.floor(1234.56 * rate));
    });

    test(`${key}: monthly threshold and first whole-pound deduction`, () => {
        const options = { ...selectionFor(key), repaymentFrequency: "Monthly" };
        const monthlyThreshold = Math.floor(threshold * 100 / 12) / 100;
        for (const monthly of [monthlyThreshold - 0.01, monthlyThreshold, monthlyThreshold + 0.01]) {
            assert.equal(calculateStudentLoanRepayment(monthly * 12, uk2026TaxRules, options), 0);
        }
        const penniesToFirstPound = Math.ceil(100 / rate);
        assert.equal(calculateStudentLoanRepayment((monthlyThreshold + (penniesToFirstPound - 1) / 100) * 12, uk2026TaxRules, options), 0);
        assert.equal(calculateStudentLoanRepayment((monthlyThreshold + penniesToFirstPound / 100) * 12, uk2026TaxRules, options), 12);
    });
}

test("No loan selection returns zero and does not require loan configuration", () => {
    assert.equal(calculateStudentLoanRepayment(50000, uk2026TaxRules), 0);
    assert.equal(calculateStudentLoanRepayment(50000, {}, { plan: null, postgraduate: false }), 0);
    assert.equal(calculateStudentLoanRepayment(0), 0);
});

test("One standard plan can coexist with postgraduate repayments, rounded separately", () => {
    for (const [plan] of loanCases.slice(0, 4)) {
        const combined = calculateStudentLoanRepayment(50000, uk2026TaxRules, { plan, postgraduate: true });
        assert.equal(combined, calculateStudentLoanRepayment(50000, uk2026TaxRules, { plan }) + 1740);
    }
    // Annual unrounded amounts 729.9 + 840.6 must become 729 + 840, not 1570.
    assert.equal(calculateStudentLoanRepayment(35010, uk2026TaxRules, { plan: "plan1", postgraduate: true }), 1569);
    // Monthly amounts 67.5 + 120 must be rounded before multiplying by 12.
    assert.equal(calculateStudentLoanRepayment(45000, uk2026TaxRules, {
        plan: "plan4", postgraduate: true, repaymentFrequency: "Monthly"
    }), 2448);
    assert.equal(calculateStudentLoanRepayment(25000, uk2026TaxRules, { plan: "plan2", postgraduate: true }), 240);
});

test("PAYE periods floor thresholds to pennies and repayments to pounds before annualising", () => {
    // Phase 4.4.2 corrects the former FourWeekly/Fortnightly expectation of 494:
    // HMRC SL3 requires weekly flooring before multiplying by 4 or 2.
    // Plan 2 at 35,000: annual 505; monthly 42*12; weekly 9*52.
    for (const [repaymentFrequency, expected] of [
        ["Annual", 505], ["Monthly", 504], ["FourWeekly", 468],
        ["Fortnightly", 468], ["Weekly", 468]
    ]) {
        assert.equal(calculateStudentLoanRepayment(35000, uk2026TaxRules, { plan: "plan2", repaymentFrequency }), expected);
    }
    // Plan 1 weekly threshold is 517.30, not 517.31 or unrounded 26900/52.
    assert.equal(calculateStudentLoanRepayment(617.30 * 52, uk2026TaxRules, { plan: "plan1", repaymentFrequency: "Weekly" }), 468);
    assert.equal(calculateStudentLoanRepayment(617.29 * 52, uk2026TaxRules, { plan: "plan1", repaymentFrequency: "Weekly" }), 416);
});

test("Whole-pound boundary resists floating-point subtraction noise", () => {
    // Plan 5 monthly threshold 2083.33; exactly 100 above gives 9 per month.
    const options = { plan: "plan5", repaymentFrequency: "Monthly" };
    assert.equal(calculateStudentLoanRepayment(2183.33 * 12, uk2026TaxRules, options), 108);
    assert.equal(calculateStudentLoanRepayment(2183.32 * 12, uk2026TaxRules, options), 96);
});

test("Selected loan calculations use supplied tax-year rules", () => {
    const rules = { studentLoans: { plan1: { annualThreshold: 10000, rate: 0.1 } } };
    assert.equal(calculateStudentLoanRepayment(20000, rules, { plan: "plan1" }), 1000);
});

test("Loan earnings reject negative, non-finite and non-numeric inputs without coercion", () => {
    for (const earnings of [-1, NaN, Infinity, -Infinity, "35000", "", null, undefined, true, {}, []]) {
        assert.throws(() => calculateStudentLoanRepayment(earnings, uk2026TaxRules), /earnings/);
    }
});

test("Invalid options, multiple plans, postgraduate flags and frequencies are rejected", () => {
    for (const options of [null, [], "plan1", 1, true]) {
        assert.throws(() => calculateStudentLoanRepayment(35000, uk2026TaxRules, options), /options/);
    }
    for (const plan of [1, "Plan1", "plan3", "postgraduate", "", "none", false, {}, ["plan1", "plan2"]]) {
        assert.throws(() => calculateStudentLoanRepayment(35000, uk2026TaxRules, { plan }), /plan/);
    }
    for (const postgraduate of [null, "true", 1, 0, [], {}]) {
        assert.throws(() => calculateStudentLoanRepayment(35000, uk2026TaxRules, { postgraduate }), /boolean/);
    }
    for (const repaymentFrequency of [null, "monthly", "Daily", "", "toString", {}, 12]) {
        assert.throws(() => calculateStudentLoanRepayment(35000, uk2026TaxRules, { repaymentFrequency }), /frequency/);
    }
});

test("Missing or invalid selected tax-year loan rules are rejected", () => {
    for (const rules of [undefined, null, {}, { studentLoans: {} }, { studentLoans: { plan1: null } }]) {
        assert.throws(() => calculateStudentLoanRepayment(35000, rules, { plan: "plan1" }), /threshold or rate/);
    }
    for (const annualThreshold of [-1, NaN, Infinity, "26900", null, 1e308]) {
        assert.throws(() => calculateStudentLoanRepayment(35000, {
            studentLoans: { plan1: { annualThreshold, rate: 0.09 } }
        }, { plan: "plan1" }), /threshold or rate/);
    }
    for (const rate of [-0.01, 1.01, NaN, Infinity, "0.09", null, undefined]) {
        assert.throws(() => calculateStudentLoanRepayment(35000, {
            studentLoans: { postgraduate: { annualThreshold: 21000, rate } }
        }, { postgraduate: true }), /threshold or rate/);
    }
    const rule = { annualThreshold: 0, rate: 1 };
    assert.throws(() => calculateStudentLoanRepayment(1e308, {
        studentLoans: { plan1: rule, postgraduate: rule }
    }, { plan: "plan1", postgraduate: true }), /numeric range/);
});

test("Net pay pensions and Personal Allowance taper never reduce student loan earnings", () => {
    for (const salary of [35000, 110000, 125140]) {
        for (const pensionRate of [0, 5, 100]) {
            const result = calculateWithPension(salary, "Annual", pensionRate);
            const repayment = calculateStudentLoanRepayment(result.annualSalary, uk2026TaxRules, { plan: "plan2", postgraduate: true });
            assert.equal(repayment, Math.floor((salary - 29385) * 0.09) + Math.floor((salary - 21000) * 0.06));
            const takeHome = calculateTakeHomePay(salary, result.incomeTax, result.nationalInsurance, result.pensionContribution, repayment);
            assert.equal(takeHome, result.takeHomePay - repayment);
            if (pensionRate === 100) {
                assert.equal(result.taxableIncome, 0);
                assert.ok(repayment > 0);
                assert.ok(takeHome < 0);
            }
        }
    }
});

test("Loan deductions integrate with take-home and reconcile every breakdown period", () => {
    const result = calculateWithPension(35000, "Annual", 5);
    const repayment = calculateStudentLoanRepayment(result.annualSalary, uk2026TaxRules, { plan: "plan2", postgraduate: true, repaymentFrequency: "Monthly" });
    assert.equal(repayment, 1344);
    const takeHome = calculateTakeHomePay(35000, result.incomeTax, result.nationalInsurance, result.pensionContribution, repayment);
    assert.equal(takeHome, 25975.6);
    const breakdown = calculatePayBreakdown(takeHome, result.pensionContribution, { ...result, studentLoanRepayment: repayment });
    for (const [period, divisor] of [["annual", 1], ["monthly", 12], ["fourWeekly", 13], ["weekly", 52], ["daily", 365]]) {
        assert.equal(breakdown.studentLoan[period], repayment / divisor);
        assert.ok(Math.abs(breakdown[period] + breakdown.pension[period] + breakdown.incomeTax[period] +
            breakdown.nationalInsurance[period] + breakdown.studentLoan[period] - breakdown.gross[period]) < 1e-8);
    }
});

test("Old signatures and shapes remain unchanged; explicit zero adds a zero loan breakdown", () => {
    assert.equal(calculateTakeHomePay(35000, 4486, 1794.4), calculateTakeHomePay(35000, 4486, 1794.4, 0, 0));
    const details = { annualSalary: 35000, incomeTax: 4486, nationalInsurance: 1794.4 };
    const old = calculatePayBreakdown(28719.6, 0, details);
    assert.equal(Object.hasOwn(old, "studentLoan"), false);
    const current = calculatePayBreakdown(28719.6, 0, { ...details, studentLoanRepayment: 0 });
    assert.deepEqual(current.studentLoan, { annual: 0, monthly: 0, fourWeekly: 0, weekly: 0, daily: 0 });
    delete current.studentLoan;
    assert.deepEqual(current, old);
});

test("Salary input frequency is independent of the actual loan repayment period", () => {
    const options = { plan: "plan1", repaymentFrequency: "Monthly" };
    assert.equal(calculateStudentLoanRepayment(calculateAnnualSalary(3000, "Monthly"), uk2026TaxRules, options),
        calculateStudentLoanRepayment(calculateAnnualSalary(36000, "Annual"), uk2026TaxRules, options));
});

// Phase 4.4.2: HMRC SL3 multiple-week deductions use average-week flooring.
for (const [key, weeklyDeduction] of [["plan1", 14], ["plan2", 9], ["plan4", 2], ["plan5", 17], ["postgraduate", 16]]) {
    test(`${key}: four-weekly and fortnightly payroll multiply the rounded weekly deduction`, () => {
        for (const [repaymentFrequency, weeks, periods] of [["FourWeekly", 4, 13], ["Fortnightly", 2, 26]]) {
            const annual = calculateStudentLoanRepayment(35000, uk2026TaxRules, { ...selectionFor(key), repaymentFrequency });
            assert.equal(annual, weeklyDeduction * weeks * periods);
            assert.equal(annual / periods, weeklyDeduction * weeks);
        }
    });
}

test("Four-weekly combined loans floor each average-week repayment independently", () => {
    const annual = calculateStudentLoanRepayment(35000, uk2026TaxRules, {
        plan: "plan2", postgraduate: true, repaymentFrequency: "FourWeekly"
    });
    assert.equal(annual, 1300); // (9 + 16) * 4 * 13, not floor(total raw excess).
    assert.equal(annual / 13, 100); // Old whole-period method produced 103 per payroll.
    const options = { plan: "plan1", repaymentFrequency: "FourWeekly" };
    assert.equal(calculateStudentLoanRepayment(617.30 * 52, uk2026TaxRules, options), 468);
    assert.equal(calculateStudentLoanRepayment(617.29 * 52, uk2026TaxRules, options), 416);
    assert.equal(calculateStudentLoanRepayment(26900, uk2026TaxRules, options), 0);
});

test("Separate loan breakdowns preserve all period averages and the combined subtotal", () => {
    const breakdown = calculatePayBreakdown(25975.6, 1750, {
        annualSalary: 35000, incomeTax: 4136, nationalInsurance: 1794.4,
        standardLoanRepayment: 504, postgraduateLoanRepayment: 840, studentLoanRepayment: 1344
    });
    for (const [period, divisor] of [["annual", 1], ["monthly", 12], ["fourWeekly", 13], ["weekly", 52], ["daily", 365]]) {
        assert.equal(breakdown.standardStudentLoan[period], 504 / divisor);
        assert.equal(breakdown.postgraduateLoan[period], 840 / divisor);
        assert.ok(Math.abs(breakdown.studentLoan[period] - breakdown.standardStudentLoan[period] - breakdown.postgraduateLoan[period]) < 1e-8);
        assert.ok(Math.abs(breakdown[period] + breakdown.incomeTax[period] + breakdown.nationalInsurance[period] +
            breakdown.pension[period] + breakdown.standardStudentLoan[period] + breakdown.postgraduateLoan[period] - breakdown.gross[period]) < 1e-8);
    }
    const old = calculatePayBreakdown(1, 0, { annualSalary: 1, incomeTax: 0, nationalInsurance: 0 });
    assert.equal(Object.hasOwn(old, "standardStudentLoan"), false);
    assert.equal(Object.hasOwn(old, "postgraduateLoan"), false);
});
