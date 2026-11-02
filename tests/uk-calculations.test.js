import test from "node:test";
import assert from "node:assert/strict";

import {
    calculateAnnualSalary,
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
        annual: 227760, monthly: 18980, weekly: 4380, daily: 624
    });
    assert.deepEqual(calculatePayBreakdown(0), {
        annual: 0, monthly: 0, weekly: 0, daily: 0
    });
});
