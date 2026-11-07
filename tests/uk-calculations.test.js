import test from "node:test";
import assert from "node:assert/strict";

import {
    calculateAnnualSalary,
    calculatePensionContribution,
    calculateTaxableIncome,
    calculateIncomeTax,
    calculateNationalInsurance,
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
