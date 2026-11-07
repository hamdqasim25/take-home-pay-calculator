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
                    value: id === "pension-contribution" ? "0" : "",
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
    for (const id of ["pension-deduction", "total-deductions"]) {
        assert.equal(form.elements[id].textContent, placeholder);
    }
    for (const category of ["take-home", "income-tax", "national-insurance", "pension"]) {
        assert.equal(form.elements[`.salary-segment.breakdown-${category}`].style["--share"], "0");
        assert.equal(form.elements[`.${category}-percentage`].textContent, "0%");
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
