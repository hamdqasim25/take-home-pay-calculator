import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Recovered from the original 30-check inline verification script.
// Each test now has an isolated DOM/module graph. Placeholder assertions reflect
// the later requested behaviour: £0.00 on edits, '-' on errors.
const outputIds = [
    "annual-take-home-pay", "monthly-take-home-pay", "weekly-take-home-pay",
    "daily-take-home-pay", "income-tax", "national-insurance"
];
const fourWeeklyIds = ["four-weekly-take-home-pay"];
const annualResults = ["£28,719.60", "£2,393.30", "£552.30", "£78.68", "£4,486.00", "£1,794.40"];
const monthlyResults = ["£25,119.60", "£2,093.30", "£483.07", "£68.82", "£3,486.00", "£1,394.40"];
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

async function createForm() {
    const elements = {};
    const logs = [];
    const context = vm.createContext({
        Intl,
        console: { log() {}, error(...args) { logs.push(args); } },
        document: {
            // Minimal chart DOM support so the existing form tests can load main.js.
            querySelector(selector) {
                return elements[selector] ??= {
                    textContent: "",
                    style: {
                        setProperty(name, value) { this[name] = String(value); }
                    }
                };
            },
            getElementById(id) {
                return elements[id] ??= {
                    value: ({ "pension-contribution": "0", "student-loan-plan": "none", "payroll-frequency": "Monthly" })[id] ?? "",
                    checked: false, disabled: id === "pension-contribution",
                    textContent: "", events: {}, attributes: {},
                    setAttribute(name, value) { this.attributes[name] = value; },
                    focus() { this.focused = true; },
                    addEventListener(name, fn) { this.events[name] = fn; }
                };
            }
        }
    });
    const modules = new Map();
    async function load(url) {
        if (modules.has(url.href)) return modules.get(url.href);
        const module = new vm.SourceTextModule(readFileSync(url, "utf8"), {
            context, identifier: url.href
        });
        modules.set(url.href, module);
        await module.link(specifier => load(new URL(specifier, url)));
        return module;
    }
    const main = await load(new URL("../js/main.js", import.meta.url));
    await main.evaluate();
    const set = (id, value) => { elements[id].value = value; };
    const values = () => outputIds.map(id => elements[id].textContent);
    const placeholders = value => {
        assert.deepEqual(values(), outputIds.map(() => value));
        for (const id of fourWeeklyIds) assert.equal(elements[id].textContent, value);
    };
    const error = () => elements["error-message"].textContent;
    const submit = () => {
        let prevented = false;
        elements["salary-form"].events.submit({ preventDefault() { prevented = true; } });
        assert.equal(prevented, true);
    };
    const valid = () => {
        set("salary", "35000");
        set("country", "UK");
        set("tax-year", "2026-27");
        set("pay-frequency", "Annual");
        submit();
        assert.equal(error(), "");
    };
    const rules = modules.get(new URL("../js/tax-rules/uk-2026-27.js", import.meta.url).href).namespace.uk2026TaxRules;
    return { elements, logs, set, values, placeholders, error, submit, valid, rules };
}

function togglePension(form, enabled) {
    form.elements["pension-enabled"].checked = enabled;
    form.elements["pension-enabled"].events.change();
}

function assertDashboardCleared(form, placeholder) {
    form.placeholders(placeholder);
    assert.equal(form.elements["salary-summary"].hidden, true);
    for (const id of ["pension-deduction", "total-deductions"]) {
        assert.equal(form.elements[id].textContent, placeholder);
    }
    for (const key of ["standard-loan", "postgraduate-loan", "combined-loans"]) {
        assert.equal(form.elements[`${key}-details`].hidden, true);
        for (const period of ["annual", "monthly", "fourWeekly", "weekly", "daily"]) {
            assert.equal(form.elements[`${key}-${period}`].textContent, placeholder);
        }
    }
    assert.equal(form.elements["results-status"].textContent, "");
    assert.equal(form.elements["loan-averages-note"].hidden, true);
    for (const category of ["take-home", "income-tax", "national-insurance", "pension", "student-loan", "postgraduate-loan"]) {
        assert.equal(form.elements[`salary-summary-${category}-row`].hidden, true);
        assert.equal(form.elements[`salary-summary-${category}-amount`].textContent, placeholder);
        assert.equal(form.elements[`.salary-segment.breakdown-${category}`].style["--share"], "0");
        assert.equal(form.elements[`.${category}-percentage`].textContent, "0%");
        assert.equal(form.elements[`.salary-segment.breakdown-${category}`].hidden, true);
    }
}

test("Pension defaults to disabled and preserves the original £35000 dashboard", async () => {
    const form = await createForm();
    assert.equal(form.elements["pension-enabled"].checked, false);
    assert.equal(form.elements["pension-contribution"].disabled, true);
    form.valid();
    assert.deepEqual(form.values(), annualResults);
    assert.equal(form.elements["pension-deduction"].textContent, "£0.00");
    assert.equal(form.elements["total-deductions"].textContent, "£6,280.40");
    assert.equal(form.elements[".pension-percentage"].textContent, "0.00%");
});

test("Enabling pension defaults to 5% and renders deductions and all chart shares", async () => {
    const form = await createForm();
    form.valid();
    togglePension(form, true);
    assert.equal(form.elements["pension-contribution"].disabled, false);
    assert.equal(form.elements["pension-contribution"].value, "5");
    assertDashboardCleared(form, "£0.00");
    form.submit();
    assert.deepEqual(form.values(), ["£27,319.60", "£2,276.63", "£525.38", "£74.85", "£4,136.00", "£1,794.40"]);
    assert.equal(form.elements["pension-deduction"].textContent, "£1,750.00");
    assert.equal(form.elements["total-deductions"].textContent, "£7,680.40");
    const amounts = { "take-home": 27319.6, "income-tax": 4136, "national-insurance": 1794.4, pension: 1750 };
    let totalShare = 0;
    for (const [category, amount] of Object.entries(amounts)) {
        const expected = amount / 35000 * 100;
        const share = Number(form.elements[`.salary-segment.breakdown-${category}`].style["--share"]);
        assert.ok(Math.abs(share - expected) < 1e-8);
        assert.equal(form.elements[`.${category}-percentage`].textContent, `${expected.toFixed(2)}%`);
        totalShare += share;
    }
    assert.ok(Math.abs(totalShare - 100) < 1e-8);
});

test("Disabling pension clears results and ignores an invalid stored rate", async () => {
    const form = await createForm();
    form.valid();
    togglePension(form, true);
    form.submit();
    togglePension(form, false);
    assert.equal(form.elements["pension-contribution"].disabled, true);
    assert.equal(form.elements["pension-contribution"].value, "0");
    assertDashboardCleared(form, "£0.00");
    form.set("pension-contribution", "invalid");
    form.submit();
    assert.deepEqual(form.values(), annualResults);
    assert.equal(form.elements["pension-error"].textContent, "");
    togglePension(form, true);
    assert.equal(form.elements["pension-contribution"].value, "5");
});

for (const rate of ["", " ", "abc", "NaN", "Infinity", "-Infinity", "1e309", "-0.1", "100.01"]) {
    test(`Invalid pension ${JSON.stringify(rate)} shows an accessible error and clears the dashboard`, async () => {
        const form = await createForm();
        form.valid();
        togglePension(form, true);
        form.submit();
        form.set("pension-contribution", rate);
        form.submit();
        assertDashboardCleared(form, "-");
        assert.match(form.elements["pension-error"].textContent, /between 0 and 100/);
        assert.equal(form.elements["pension-contribution"].attributes["aria-invalid"], "true");
        assert.equal(form.elements["pension-contribution"].focused, true);
        form.set("pension-contribution", "5");
        form.elements["pension-contribution"].events.input();
        assertDashboardCleared(form, "£0.00");
        assert.equal(form.elements["pension-error"].textContent, "");
        assert.equal(form.elements["pension-contribution"].attributes["aria-invalid"], "false");
        form.submit();
        assert.equal(form.values()[0], "£27,319.60");
    });
}

for (const event of ["input", "change"]) {
    test(`Pension ${event} clears results until resubmission`, async () => {
        const form = await createForm();
        form.valid();
        togglePension(form, true);
        form.submit();
        form.set("pension-contribution", "2.5");
        form.elements["pension-contribution"].events[event]();
        assertDashboardCleared(form, "£0.00");
        form.submit();
        assert.equal(form.elements["pension-deduction"].textContent, "£875.00");
        assert.equal(form.values()[0], "£28,019.60");
    });
}

test("Enabled pensions accept 0% and 100%, including negative take-home display", async () => {
    const form = await createForm();
    form.valid();
    togglePension(form, true);
    form.set("pension-contribution", "0");
    form.submit();
    assert.deepEqual(form.values(), annualResults);
    form.set("pension-contribution", "100");
    form.submit();
    assert.equal(form.elements["pension-error"].textContent, "");
    assert.equal(form.elements["pension-deduction"].textContent, "£35,000.00");
    assert.equal(form.values()[0], "-£1,794.40");
    assert.equal(form.values()[4], "£0.00");
    assert.equal(form.values()[5], "£1,794.40");
    assert.equal(form.elements[".salary-bar"].hidden, true);
    assert.match(form.elements[".breakdown-note"].textContent, /negative take-home/);
    togglePension(form, false);
    form.submit();
    assert.equal(form.elements[".salary-bar"].hidden, false);
});

test("Monthly pension input produces the same dashboard as equivalent annual salary", async () => {
    const form = await createForm();
    form.valid();
    togglePension(form, true);
    form.set("salary", "36000");
    form.submit();
    const annualValues = form.values();
    form.set("salary", "3000");
    form.set("pay-frequency", "Monthly");
    form.submit();
    assert.deepEqual(form.values(), annualValues);
    assert.equal(form.elements["pension-deduction"].textContent, "£1,800.00");
});

test("Pension controls and dashboard have labels, help, errors and disabled defaults", () => {
    assert.match(html, /<legend>Workplace Pension<\/legend>/);
    const checkbox = html.match(/<input[^>]*id="pension-enabled"[^>]*>/)[0];
    assert.doesNotMatch(checkbox, /\bchecked\b/);
    const input = html.match(/<input[^>]*id="pension-contribution"[^>]*>/)[0];
    for (const attribute of ['min="0"', 'max="100"', 'value="0"', 'disabled', 'aria-describedby="pension-help pension-error"']) {
        assert.ok(input.includes(attribute));
    }
    assert.match(html, /id="pension-error" role="alert" aria-live="polite"/);
    assert.match(html, /<label[^>]*for="pension-enabled"/);
    assert.match(html, /<label[^>]*for="pension-contribution"/);
    assert.match(html, /net pay pension arrangement/);
    assert.match(html, /full gross salary/);
    assert.ok(html.includes('<output id="pension-deduction">£0.00</output>'));
    assert.match(html, /salary-segment breakdown-pension/);
    assert.match(html, /legend-swatch breakdown-pension/);
});

test("£35000 annual updates all six results", async () => {
    const form = await createForm();
    form.valid();
    assert.deepEqual(form.values(), annualResults);
});

test("£2500 monthly updates all six results", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "2500");
    form.set("pay-frequency", "Monthly");
    form.submit();
    assert.deepEqual(form.values(), monthlyResults);
});

for (const salary of ["0", "-1", "", "abc", "NaN", "Infinity", "-Infinity", "1e309", " "]) {
    test(`Invalid salary ${JSON.stringify(salary)} clears prior results`, async () => {
        const form = await createForm();
        form.valid();
        form.set("salary", salary);
        form.submit();
        form.placeholders("-");
        assert.match(form.error(), /valid salary/);
    });
}

for (const frequency of ["", "Weekly", "annual", "monthly"]) {
    test(`Unsupported frequency ${JSON.stringify(frequency)} is rejected`, async () => {
        const form = await createForm();
        form.valid();
        form.set("pay-frequency", frequency);
        form.submit();
        form.placeholders("-");
        assert.match(form.error(), /Annual or Monthly/);
    });
}

for (const [id, value] of [["country", "US"], ["tax-year", "2025-26"]]) {
    test(`Unsupported ${id} is rejected`, async () => {
        const form = await createForm();
        form.valid();
        form.set(id, value);
        form.submit();
        form.placeholders("-");
        assert.match(form.error(), /not supported/);
    });
}

for (const [id, event, value] of [
    ["salary", "input", "40000"], ["salary", "change", "40000"],
    ["country", "change", "US"], ["tax-year", "change", "2025-26"],
    ["pay-frequency", "change", "Monthly"]
]) {
    test(`${id} ${event} resets results without recalculating`, async () => {
        const form = await createForm();
        form.valid();
        form.set(id, value);
        form.elements[id].events[event]({ type: event });
        form.placeholders("£0.00");
    });
}

test("Correcting invalid input clears the error and recalculates", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "0");
    form.submit();
    assert.notEqual(form.error(), "");
    form.valid();
    assert.deepEqual(form.values(), annualResults);
});

test("Repeated valid submissions update all six results", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "2500");
    form.set("pay-frequency", "Monthly");
    form.submit();
    assert.deepEqual(form.values(), monthlyResults);
    form.valid();
    assert.deepEqual(form.values(), annualResults);
});

test("Positive decimal salary is accepted", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "35000.25");
    form.submit();
    assert.equal(form.error(), "");
    assert.equal(form.values()[0], "£28,719.78");
});

test("Monthly numeric overflow is rejected", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "1e308");
    form.set("pay-frequency", "Monthly");
    form.submit();
    form.placeholders("-");
    assert.match(form.error(), /too large/);
});

test("Large finite annual salary is accepted without an arbitrary cap", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "1e308");
    form.submit();
    assert.equal(form.error(), "");
    assert.ok(form.values().every(value => value.startsWith("£") && !/NaN|∞/.test(value)));
});

test("Unexpected calculation exception clears results and logs technical details", async () => {
    const form = await createForm();
    form.valid();
    const original = form.rules.incomeTaxBands;
    try {
        form.rules.incomeTaxBands = null;
        form.submit();
    } finally {
        form.rules.incomeTaxBands = original;
    }
    form.placeholders("-");
    assert.match(form.error(), /Please try again/);
    assert.equal(form.logs.length, 1);
    assert.equal(form.logs[0][1].name, "TypeError");
    form.valid();
    assert.deepEqual(form.values(), annualResults);
});

test("Rendering exception clears partially updated results and allows recovery", async () => {
    const form = await createForm();
    form.valid();
    const element = form.elements["monthly-take-home-pay"];
    let value = element.textContent;
    let fail = true;
    const failure = new Error("render failure");
    Object.defineProperty(element, "textContent", {
        configurable: true,
        get() { return value; },
        set(next) {
            if (fail) { fail = false; throw failure; }
            value = next;
        }
    });
    form.submit();
    form.placeholders("-");
    assert.match(form.error(), /Please try again/);
    assert.equal(form.logs.length, 1);
    assert.equal(form.logs[0][1], failure);
    form.valid();
    assert.deepEqual(form.values(), annualResults);
});

test("HTML enables inline validation with one accessible error region", () => {
    assert.match(html, /<form[^>]*id="salary-form"[^>]*novalidate/);
    assert.match(html, /<p\s+class="error-message"\s+id="error-message"\s+role="alert"/);
    assert.equal((html.match(/id="error-message"/g) || []).length, 1);
});

// Additional regression checks for the subsequent placeholder change.
test("All six initial HTML placeholders are £0.00", () => {
    for (const id of outputIds) {
        assert.ok(html.includes(`<output id="${id}">£0.00</output>`));
    }
});

test("Editing after an error clears the message and restores £0.00", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "0");
    form.submit();
    form.placeholders("-");
    form.set("salary", "35000");
    form.elements.salary.events.input({ type: "input" });
    form.placeholders("£0.00");
    assert.equal(form.error(), "");
    form.submit();
    assert.deepEqual(form.values(), annualResults);
});

for (const enabled of [false, true]) {
    test(`Four-weekly dashboard renders take-home pay with pension ${enabled ? "enabled" : "disabled"}`, async () => {
        const form = await createForm();
        form.valid();
        togglePension(form, enabled);
        form.submit();
        assert.deepEqual(fourWeeklyIds.map(id => form.elements[id].textContent), enabled
            ? ["£2,101.51"]
            : ["£2,209.20"]);
    });
}

test("Four-weekly dashboard agrees for monthly and annual decimal salaries", async () => {
    const form = await createForm();
    form.valid();
    togglePension(form, true);
    form.set("salary", "30003");
    form.submit();
    const annual = fourWeeklyIds.map(id => form.elements[id].textContent);
    form.set("salary", "2500.25");
    form.set("pay-frequency", "Monthly");
    form.submit();
    assert.deepEqual(fourWeeklyIds.map(id => form.elements[id].textContent), annual);
    assert.equal(annual[0], "£1,840.13");
});

test("Four-weekly outputs have initial placeholders, labels and no input option", () => {
    for (const id of fourWeeklyIds) assert.ok(html.includes(`<output id="${id}">£0.00</output>`));
    const details = html.match(/<div class="take-home-details">[\s\S]*?<\/div>/)[0];
    assert.match(details, /4-Weekly Take-Home Pay:/);
    for (const id of ["four-weekly-take-home-pay", "weekly-take-home-pay", "daily-take-home-pay"]) {
        assert.ok(details.includes(`id="${id}"`));
    }
    assert.doesNotMatch(html, /four-weekly-(gross|income-tax|national-insurance|pension|summary)/);
    const frequencySelect = html.match(/<select id="pay-frequency"[\s\S]*?<\/select>/)[0];
    assert.equal((frequencySelect.match(/<option/g) || []).length, 2);
    assert.doesNotMatch(frequencySelect, /four|4 Weeks/i);
});

// Phase 4.4.2: real module integration with independent expected payroll amounts.
const formatGBP = amount => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

test("Default loan controls preserve no-loan results at every payroll frequency", async () => {
    const form = await createForm();
    assert.equal(form.elements["student-loan-plan"].value, "none");
    assert.equal(form.elements["postgraduate-loan"].checked, false);
    assert.equal(form.elements["payroll-frequency"].value, "Monthly");
    for (const frequency of ["Monthly", "FourWeekly", "Weekly"]) {
        form.set("payroll-frequency", frequency);
        form.valid();
        assert.deepEqual(form.values(), annualResults);
        assert.equal(form.elements["total-deductions"].textContent, "£6,280.40");
        assert.equal(form.elements[".salary-bar"].hidden, false);
    }
});

for (const [plan, annualLoan] of [["plan1", 720], ["plan2", 504], ["plan4", 108], ["plan5", 900]]) {
    test(`${plan} monthly payroll deducts the configured loan from gross earnings`, async () => {
        const form = await createForm();
        form.valid();
        form.set("student-loan-plan", plan);
        form.submit();
        assert.equal(form.values()[0], formatGBP(28719.6 - annualLoan));
        assert.equal(form.values()[4], "£4,486.00");
        assert.equal(form.values()[5], "£1,794.40");
        assert.equal(form.elements["total-deductions"].textContent, formatGBP(6280.4 + annualLoan));
    });
}

test("Postgraduate alone works without selecting a standard plan", async () => {
    const form = await createForm();
    form.valid();
    form.elements["postgraduate-loan"].checked = true;
    form.submit();
    assert.equal(form.values()[0], "£27,879.60");
    assert.equal(form.elements["total-deductions"].textContent, "£7,120.40");
});

for (const [frequency, annualLoan] of [["Monthly", 1344], ["Weekly", 1300], ["FourWeekly", 1300]]) {
    test(`Combined loans use ${frequency} payroll and preserve averaged display periods`, async () => {
        const form = await createForm();
        form.valid();
        form.set("student-loan-plan", "plan2");
        form.elements["postgraduate-loan"].checked = true;
        form.set("payroll-frequency", frequency);
        form.submit();
        const takeHome = 28719.6 - annualLoan;
        for (const [id, divisor] of [["annual-take-home-pay", 1], ["monthly-take-home-pay", 12], ["four-weekly-take-home-pay", 13], ["weekly-take-home-pay", 52], ["daily-take-home-pay", 365]]) {
            assert.equal(form.elements[id].textContent, formatGBP(takeHome / divisor));
        }
        assert.equal(form.elements["total-deductions"].textContent, formatGBP(6280.4 + annualLoan));
        // Phase 4.4.3 replaces temporary hiding with complete loan segments.
        assert.equal(form.elements[".salary-bar"].hidden, false);
        assert.equal(form.elements[".salary-segment.breakdown-student-loan"].hidden, false);
        assert.equal(form.elements[".salary-segment.breakdown-postgraduate-loan"].hidden, false);
        form.set("student-loan-plan", "none");
        form.elements["postgraduate-loan"].checked = false;
        form.submit();
        assert.equal(form.elements[".salary-bar"].hidden, false);
        assert.deepEqual(form.values(), annualResults);
    });
}

test("Net pay pension reduces Income Tax but not either loan, even at 100%", async () => {
    const form = await createForm();
    form.valid();
    form.set("student-loan-plan", "plan2");
    form.elements["postgraduate-loan"].checked = true;
    togglePension(form, true);
    form.submit();
    assert.equal(form.values()[0], "£25,975.60");
    assert.equal(form.values()[4], "£4,136.00");
    assert.equal(form.values()[5], "£1,794.40");
    assert.equal(form.elements["total-deductions"].textContent, "£9,024.40");
    form.set("pension-contribution", "100");
    form.submit();
    assert.equal(form.values()[0], "-£3,138.40");
    assert.equal(form.values()[4], "£0.00");
    assert.match(form.elements[".breakdown-note"].textContent, /negative take-home/);
});

test("Salary entry frequency does not change selected four-weekly payroll", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "36000");
    form.set("student-loan-plan", "plan2");
    form.set("payroll-frequency", "FourWeekly");
    form.submit();
    const annualInput = form.values();
    assert.equal(annualInput[0], "£28,867.60"); // 29,439.60 minus 11 * 52.
    form.set("salary", "3000");
    form.set("pay-frequency", "Monthly");
    form.submit();
    assert.deepEqual(form.values(), annualInput);
});

for (const id of ["student-loan-plan", "postgraduate-loan", "payroll-frequency"]) {
    for (const event of ["input", "change"]) {
        test(`${id} ${event} clears loan results, totals and chart shares`, async () => {
            const form = await createForm();
            form.valid();
            form.set("student-loan-plan", "plan2");
            form.submit();
            form.elements[id].events[event]();
            assertDashboardCleared(form, "£0.00");
            assert.equal(form.elements["student-loan-error"].textContent, "");
            assert.equal(form.elements["payroll-error"].textContent, "");
        });
    }
}

for (const [id, errorId, invalidValues, valid] of [
    ["student-loan-plan", "student-loan-error", ["", "plan3", "plan1,plan2", "postgraduate"], "plan2"],
    ["payroll-frequency", "payroll-error", ["", "Annual", "Fortnightly", "monthly", "toString"], "Monthly"]
]) {
    test(`${id} invalid selections show associated errors, focus and recover`, async () => {
        const form = await createForm();
        form.valid();
        for (const value of invalidValues) {
            form.set(id, value);
            form.submit();
            assertDashboardCleared(form, "-");
            assert.match(form.elements[errorId].textContent, /Please select/);
            assert.equal(form.elements[id].attributes["aria-invalid"], "true");
            assert.equal(form.elements[id].focused, true);
            form.set(id, valid);
            form.elements[id].events.change();
            assertDashboardCleared(form, "£0.00");
            assert.equal(form.elements[errorId].textContent, "");
            assert.equal(form.elements[id].attributes["aria-invalid"], "false");
            form.submit();
            assert.equal(form.error(), "");
        }
    });
}

test("Invalid postgraduate state is rejected without coercion", async () => {
    const form = await createForm();
    form.valid();
    form.elements["postgraduate-loan"].checked = "true";
    form.submit();
    assertDashboardCleared(form, "-");
    assert.match(form.elements["student-loan-error"].textContent, /checkbox/);
    assert.equal(form.elements["postgraduate-loan"].attributes["aria-invalid"], "true");
    assert.equal(form.elements["postgraduate-loan"].focused, true);
});

test("Selected loans below their thresholds preserve zero deductions and chart", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "21000");
    form.submit();
    const withoutLoans = form.values();
    form.set("student-loan-plan", "plan5");
    form.elements["postgraduate-loan"].checked = true;
    form.submit();
    assert.deepEqual(form.values(), withoutLoans);
    assert.equal(form.elements[".salary-bar"].hidden, false);
});

test("Loan engine errors clear partial results and recover after rules are restored", async () => {
    const form = await createForm();
    form.valid();
    form.set("student-loan-plan", "plan2");
    const original = form.rules.studentLoans;
    form.rules.studentLoans = {};
    form.submit();
    assertDashboardCleared(form, "-");
    assert.match(form.error(), /Please try again/);
    assert.equal(form.logs[0][1].name, "RangeError");
    form.rules.studentLoans = original;
    form.submit();
    assert.equal(form.values()[0], "£28,215.60");
});

test("Loan and payroll HTML controls have defaults, labels, help and accessible errors", () => {
    const loanSection = html.match(/<fieldset class="student-loan-section">[\s\S]*?<\/fieldset>/)[0];
    assert.ok(html.indexOf(loanSection) > html.indexOf('id="pension-contribution"'));
    assert.match(loanSection, /<legend>Student Loan \(optional\)<\/legend>/);
    const plans = loanSection.match(/<select[^>]*id="student-loan-plan"[\s\S]*?<\/select>/)[0];
    assert.deepEqual([...plans.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]), ["none", "plan1", "plan2", "plan4", "plan5"]);
    assert.match(plans, /value="none" selected/);
    const payroll = html.match(/<select[^>]*id="payroll-frequency"[\s\S]*?<\/select>/)[0];
    assert.deepEqual([...payroll.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]), ["Monthly", "FourWeekly", "Weekly"]);
    assert.match(payroll, /value="Monthly" selected/);
    assert.doesNotMatch(loanSection.match(/<input[^>]*id="postgraduate-loan"[^>]*>/)[0], /\bchecked\b/);
    for (const [id, help, error] of [["student-loan-plan", "student-loan-help", "student-loan-error"], ["postgraduate-loan", "postgraduate-help", "student-loan-error"], ["payroll-frequency", "payroll-help", "payroll-error"]]) {
        assert.ok(html.includes(`for="${id}"`));
        const tag = html.match(new RegExp(`<(?:select|input)[^>]*id="${id}"[^>]*>`))[0];
        assert.ok(tag.includes(`aria-describedby="${help} ${error}"`));
        assert.ok(tag.includes('aria-invalid="false"'));
        assert.ok(html.includes(`id="${help}"`));
        assert.ok(html.includes(`id="${error}" role="alert" aria-live="polite"`));
    }
    assert.match(html, /annualised averages, not exact payslip amounts/);
    assert.match(html, /Salary Input Frequency:/);
    assert.match(html, /salary-segment breakdown-student-loan/);
});

// Phase 4.4.3: dashboard amounts and chart components use the same annual values.
const dashboardPeriods = [["annual", 1], ["monthly", 12], ["fourWeekly", 13], ["weekly", 52], ["daily", 365]];
function assertLoanPeriods(form, key, annual, selected) {
    assert.equal(form.elements[`${key}-details`].hidden, !selected);
    for (const [period, divisor] of dashboardPeriods) {
        assert.equal(form.elements[`${key}-${period}`].textContent, formatGBP(annual / divisor));
    }
}
function assertChart(form, amounts, gross) {
    let sum = 0;
    for (const [category, amount] of Object.entries(amounts)) {
        assert.equal(form.elements[`salary-summary-${category}-row`].hidden, amount === 0);
        assert.equal(form.elements[`salary-summary-${category}-amount`].textContent, formatGBP(amount));
        const share = amount / gross * 100;
        const segment = form.elements[`.salary-segment.breakdown-${category}`];
        assert.ok(Math.abs(Number(segment.style["--share"]) - Math.max(0, share)) < 1e-8);
        assert.ok(Number.isFinite(Number(segment.style["--share"])));
        assert.equal(segment.hidden, amount <= 0);
        assert.equal(form.elements[`.${category}-percentage`].textContent, `${share.toFixed(2)}%`);
        assert.equal(form.elements[`.salary-legend li[data-category="${category}"]`].hidden, amount === 0);
        sum += amount;
    }
    assert.ok(Math.abs(sum - gross) < 1e-8);
}

for (const [plan, postgraduate, standard, postgrad] of [
    ["none", false, 0, 0], ["plan1", false, 720, 0], ["plan2", false, 504, 0],
    ["plan4", false, 108, 0], ["plan5", false, 900, 0],
    ["none", true, 0, 840], ["plan2", true, 504, 840]
]) {
    test(`Dashboard ${plan}, postgraduate ${postgraduate}: selected rows, all periods and six chart shares reconcile`, async () => {
        const form = await createForm();
        form.valid();
        form.set("student-loan-plan", plan);
        form.elements["postgraduate-loan"].checked = postgraduate;
        togglePension(form, true);
        form.submit();
        assertLoanPeriods(form, "standard-loan", standard, plan !== "none");
        assertLoanPeriods(form, "postgraduate-loan", postgrad, postgraduate);
        assertLoanPeriods(form, "combined-loans", standard + postgrad, plan !== "none" && postgraduate);
        const takeHome = 27319.6 - standard - postgrad;
        assert.equal(form.values()[0], formatGBP(takeHome));
        assert.equal(form.elements["total-deductions"].textContent, formatGBP(7680.4 + standard + postgrad));
        assertChart(form, { "take-home": takeHome, "income-tax": 4136, "national-insurance": 1794.4,
            pension: 1750, "student-loan": standard, "postgraduate-loan": postgrad }, 35000);
        assert.equal(form.elements[".salary-bar"].hidden, false);
        if (plan !== "none") {
            assert.equal(form.elements["standard-loan-label"].textContent, `Student Loan — Plan ${plan.slice(-1)} (annual)`);
            assert.equal(form.elements["student-loan-legend-label"].textContent, `Student Loan — Plan ${plan.slice(-1)}`);
        }
        assert.ok(form.elements["results-status"].textContent.includes(formatGBP(takeHome)));
        assert.ok(form.elements["results-status"].textContent.includes(formatGBP(7680.4 + standard + postgrad)));
    });
}

for (const frequency of ["Weekly", "FourWeekly"]) {
    test(`${frequency} dashboard uses existing weekly-floor repayments for every average`, async () => {
        const form = await createForm();
        form.valid();
        form.set("student-loan-plan", "plan2");
        form.elements["postgraduate-loan"].checked = true;
        form.set("payroll-frequency", frequency);
        form.submit();
        assertLoanPeriods(form, "standard-loan", 468, true);
        assertLoanPeriods(form, "postgraduate-loan", 832, true);
        assertLoanPeriods(form, "combined-loans", 1300, true);
        assert.equal(form.elements["combined-loans-fourWeekly"].textContent, "£100.00");
        assert.equal(form.values()[0], "£27,419.60");
    });
}

test("Selected below-threshold loans show zero rows but no zero chart segments or legends", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "21000");
    form.set("student-loan-plan", "plan1");
    form.elements["postgraduate-loan"].checked = true;
    form.submit();
    for (const key of ["standard-loan", "postgraduate-loan", "combined-loans"]) assertLoanPeriods(form, key, 0, true);
    for (const key of ["student-loan", "postgraduate-loan", "pension"]) {
        assert.equal(form.elements[`.salary-segment.breakdown-${key}`].hidden, true);
        assert.equal(form.elements[`.salary-legend li[data-category="${key}"]`].hidden, true);
    }
});

test("Zero take-home retains a valid chart and hides its zero-width take-home segment", async () => {
    const form = await createForm();
    form.valid();
    form.set("salary", "10000");
    togglePension(form, true);
    form.set("pension-contribution", "100");
    form.submit();
    assert.equal(form.values()[0], "£0.00");
    assert.equal(form.elements[".salary-bar"].hidden, false);
    assertChart(form, { "take-home": 0, "income-tax": 0, "national-insurance": 0, pension: 10000,
        "student-loan": 0, "postgraduate-loan": 0 }, 10000);
});

test("Negative take-home keeps signed figures and loan details with safe hidden chart widths", async () => {
    const form = await createForm();
    form.valid();
    form.set("student-loan-plan", "plan2");
    form.elements["postgraduate-loan"].checked = true;
    togglePension(form, true);
    form.set("pension-contribution", "100");
    form.submit();
    assert.equal(form.values()[0], "-£3,138.40");
    assert.equal(form.elements["total-deductions"].textContent, "£38,138.40");
    assert.equal(form.elements[".salary-bar"].hidden, true);
    assert.match(form.elements[".breakdown-note"].textContent, /negative take-home/);
    assertChart(form, { "take-home": -3138.4, "income-tax": 0, "national-insurance": 1794.4, pension: 35000,
        "student-loan": 504, "postgraduate-loan": 840 }, 35000);
    assertLoanPeriods(form, "combined-loans", 1344, true);
});

test("Expanded loan details survive recalculation while edits clear stale plans and deductions", async () => {
    const form = await createForm();
    form.valid();
    form.set("student-loan-plan", "plan2");
    form.elements["postgraduate-loan"].checked = true;
    form.submit();
    form.elements["standard-loan-details"].open = true;
    form.elements["combined-loans-details"].open = true;
    form.set("student-loan-plan", "plan5");
    form.elements["student-loan-plan"].events.change();
    assertDashboardCleared(form, "£0.00");
    assert.equal(form.elements["standard-loan-label"].textContent, "Student Loan (annual)");
    form.submit();
    assert.equal(form.elements["standard-loan-details"].open, true);
    assert.equal(form.elements["combined-loans-details"].open, true);
    assert.equal(form.elements["standard-loan-label"].textContent, "Student Loan — Plan 5 (annual)");
    assertLoanPeriods(form, "standard-loan", 900, true);
    form.set("student-loan-plan", "none");
    form.elements["postgraduate-loan"].checked = false;
    form.submit();
    assertLoanPeriods(form, "standard-loan", 0, false);
    assertLoanPeriods(form, "postgraduate-loan", 0, false);
    assertLoanPeriods(form, "combined-loans", 0, false);
    assert.equal(form.elements[".salary-bar"].hidden, false);
});

test("Invalid zero salary clears loan outputs and avoids non-finite percentages", async () => {
    const form = await createForm();
    form.valid();
    form.set("student-loan-plan", "plan2");
    form.submit();
    form.set("salary", "0");
    form.submit();
    assertDashboardCleared(form, "-");
    assert.match(form.error(), /valid salary/);
});

test("Loan details have native expansion, explicit output labels, estimate caveats and live totals", () => {
    for (const key of ["standard-loan", "postgraduate-loan", "combined-loans"]) {
        const details = html.match(new RegExp(`<details id="${key}-details"[\\s\\S]*?<\\/details>`))[0];
        assert.match(details, /aria-describedby="loan-averages-note" hidden/);
        assert.match(details, /<summary>/);
        for (const [period] of dashboardPeriods) {
            const output = details.match(new RegExp(`<output id="${key}-${period}"[^>]*>`))[0];
            assert.ok(output.includes(`aria-labelledby="${key}-label`));
        }
    }
    assert.match(html, /may differ from actual payslip deductions/);
    assert.match(html, /counted once in Total Deductions/);
    assert.match(html, /id="results-status"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
    assert.match(html, /id="total-deductions" aria-labelledby="total-deductions-label"/);
    assert.match(html, /class="salary-bar" aria-hidden="true"/);
    const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
    assert.match(css, /\.results-section \[hidden\] \{ display: none !important; \}/);
    assert.match(css, /summary:focus-visible/);
    assert.notEqual(css.match(/\.breakdown-student-loan \{ background-color: ([^;]+);/)[1],
        css.match(/\.breakdown-postgraduate-loan \{ background-color: ([^;]+);/)[1]);
});

for (const pension of [false, true]) {
    for (const [plan, postgraduate, loan] of [["none", false, 0], ["plan2", false, 504], ["none", true, 840], ["plan2", true, 1344]]) {
        test(`Vertical summary: pension ${pension}, ${plan}, postgraduate ${postgraduate}`, async () => {
            const form = await createForm();
            form.valid();
            togglePension(form, pension);
            form.set("student-loan-plan", plan);
            form.elements["postgraduate-loan"].checked = postgraduate;
            form.submit();
            const amounts = {
                "take-home": (pension ? 27319.6 : 28719.6) - loan,
                "income-tax": pension ? 4136 : 4486,
                "national-insurance": 1794.4,
                pension: pension ? 1750 : 0,
                "student-loan": plan === "none" ? 0 : 504,
                "postgraduate-loan": postgraduate ? 840 : 0
            };
            assert.equal(form.elements["salary-summary"].hidden, false);
            assertChart(form, amounts, 35000);
            assert.equal(form.elements["salary-summary-student-loan-label"].textContent,
                plan === "none" ? "Standard student loan" : "Standard student loan — Plan 2");
            assert.equal(form.elements[".salary-bar"].hidden, false);
        });
    }
}

test("Vertical summary clears stale amounts and plan labels after input edits and validation errors", async () => {
    const form = await createForm();
    form.valid();
    form.set("student-loan-plan", "plan1");
    form.submit();
    assert.equal(form.elements["salary-summary-student-loan-label"].textContent, "Standard student loan — Plan 1");
    form.set("student-loan-plan", "plan5");
    form.elements["student-loan-plan"].events.change();
    assertDashboardCleared(form, "£0.00");
    assert.equal(form.elements["salary-summary-student-loan-label"].textContent, "Standard student loan");
    form.submit();
    assert.equal(form.elements["salary-summary-student-loan-label"].textContent, "Standard student loan — Plan 5");
    assert.equal(form.elements["salary-summary-student-loan-amount"].textContent, "£900.00");
    form.set("salary", "0");
    form.submit();
    assertDashboardCleared(form, "-");
});

test("Vertical summary follows the bar and legend with accessible labels and matching colour classes", () => {
    const summary = html.match(/<section id="salary-summary"[\s\S]*?<\/section>/)[0];
    assert.ok(html.indexOf(summary) > html.indexOf('<ul class="salary-legend"'));
    assert.match(summary, /aria-labelledby="salary-summary-title" hidden/);
    assert.match(summary, /Annual salary summary/);
    const categories = ["take-home", "income-tax", "national-insurance", "pension", "student-loan", "postgraduate-loan"];
    assert.deepEqual([...summary.matchAll(/id="salary-summary-([^"]+)-row"/g)].map(match => match[1]), categories);
    for (const category of categories) {
        assert.ok(summary.includes(`class="legend-swatch breakdown-${category}" aria-hidden="true"`));
        assert.ok(summary.includes(`aria-labelledby="salary-summary-title salary-summary-${category}-label"`));
    }
    for (const label of ["Take-home pay", "Income Tax", "National Insurance", "Workplace pension", "Standard student loan", "Postgraduate loan"]) {
        assert.ok(summary.includes(`>${label}</span>`));
    }
    assert.equal((summary.match(/<dt>/g) || []).length, 6);
    assert.equal((summary.match(/<dd>/g) || []).length, 6);
});
