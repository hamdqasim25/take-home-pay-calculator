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
            getElementById(id) {
                return elements[id] ??= {
                    value: "", textContent: "", events: {},
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
    const placeholders = value => assert.deepEqual(values(), outputIds.map(() => value));
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
