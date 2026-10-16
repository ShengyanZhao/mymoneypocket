/* What a form cannot be sent without, and what it says when pressed anyway.

   Thirteen forms used to answer an empty field with silence. These pin the
   rule that replaced it: one list per form, read three ways (the sentence,
   aria-required, the question in the empty box), so the three cannot drift.
   The order cases are the ones the forms were written around: a sentence
   with a reason of its own arrives only when its field is the one thing left.

   Every sentence is asserted as a PER-LOCALE FIXTURE: both languages written
   out, side by side, and checked in both. That is the shape this codebase's
   i18n tests take everywhere, and it is not ceremony — a `refusal` that
   returned English whatever the language was would pass a test that only
   looked at English.

   Run by `npm test` with Node's own test runner, which strips the types
   itself. Type-checked by `tsc -b` through tsconfig.node.json. */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEBT,
  EXPENSE,
  INCOME,
  INSTITUTION,
  PLAN,
  REAL_ASSET,
  TRANSFER,
  dated,
  goal,
  holding,
  marks,
  missing,
  refusal,
  transaction,
  type Need,
} from "../src/components/required.ts";
import { setLocale, type Locale } from "../src/i18n/t.ts";

type Values = Record<string, string | number | null | undefined>;

const keys = (needs: { key: string }[]) => needs.map((n) => n.key);

/** What the form says in each language, side by side. */
function both(
  needs: Need[],
  values: Values,
): Record<Locale, string | null> {
  const said = {} as Record<Locale, string | null>;
  for (const locale of ["en", "zh"] as Locale[]) {
    setLocale(locale);
    said[locale] = refusal(needs, values);
  }
  setLocale("en");
  return said;
}

/** The same, for the two places that only need the start of the sentence. */
function bothMatch(
  needs: Need[],
  values: Values,
  prefix: Record<Locale, string>,
): void {
  const said = both(needs, values);
  for (const locale of ["en", "zh"] as Locale[]) {
    assert.ok(
      said[locale]?.startsWith(prefix[locale]),
      `${locale}: expected a sentence starting ${JSON.stringify(prefix[locale])}, got ${JSON.stringify(said[locale])}`,
    );
  }
}

test("nothing missing: no sentence", () => {
  assert.deepEqual(both(INCOME, { name: "Salary", amount: "3000" }), {
    en: null,
    zh: null,
  });
});

test("one plain field missing is named alone", () => {
  assert.deepEqual(both(INSTITUTION, { name: "  " }), {
    en: "Fill in the name.",
    zh: "请填写名称。",
  });
});

test("every plain field missing is named in one sentence, in the form's order", () => {
  assert.deepEqual(both(EXPENSE, {}), {
    en: "Fill in the name and the amount.",
    zh: "请填写名称和金额。",
  });
  assert.deepEqual(both(transaction("buy", false), {}), {
    en: "Fill in the asset, the ticker, the quantity and the price.",
    zh: "请填写标的、代码、数量、价格。",
  });
});

test("a zero is a value, not an empty box", () => {
  assert.deepEqual(both(INCOME, { name: "Gift", amount: 0 }), { en: null, zh: null });
  assert.deepEqual(
    both(transaction("close", true), {
      assetName: "X",
      fees: "0",
      institutionId: "1",
      currency: "EUR",
    }),
    { en: null, zh: null },
  );
});

test("a sentence of its own waits for the plain fields", () => {
  const debt = { name: "", currency: "" };
  assert.deepEqual(both(DEBT, debt), {
    en: "Fill in the name.",
    zh: "请填写名称。",
  });
  assert.deepEqual(both(DEBT, { ...debt, name: "Mortgage" }), {
    en: "Say which currency this debt is in.",
    zh: "请说明这笔负债是什么币种。",
  });
  assert.deepEqual(both(REAL_ASSET, { name: "Flat", currency: "" }), {
    en: "Say which currency this asset is valued in.",
    zh: "请说明这项资产以什么币种估值。",
  });
});

test("the transaction's institution speaks before its currencies, as the form was written", () => {
  const filled = { assetName: "VWCE", symbol: "VWCE.MI", quantity: "2", unitPrice: "100" };
  bothMatch(transaction("buy", false), filled, {
    en: "A buy has to come from somewhere",
    zh: "买入必须有来处",
  });
  bothMatch(transaction("sell", false), filled, {
    en: "A sell has to say where it is held",
    zh: "卖出必须注明持有地点",
  });
  bothMatch(
    transaction("buy", false),
    { ...filled, institutionId: "3", currency: "EUR" },
    {
      en: "Say which currencies these are: the price's",
      zh: "请说明各自的币种",
    },
  );
});

test("a close needs what came back, and no ticker, quantity, price or price currency", () => {
  assert.deepEqual(keys(transaction("close", true)), [
    "assetName",
    "fees",
    "institutionId",
    "currency",
  ]);
  assert.deepEqual(both(transaction("close", true), {}), {
    en: "Fill in the asset and the proceeds.",
    zh: "请填写标的和回款。",
  });
  assert.deepEqual(both(transaction("close", true), { assetName: "X" }), {
    en: "Fill in the proceeds.",
    zh: "请填写回款。",
  });
});

test("a dividend's price is what each share paid", () => {
  assert.deepEqual(
    both(transaction("dividend", false), {
      assetName: "X",
      symbol: "X",
      quantity: "10",
    }),
    {
      en: "Fill in the dividend per share.",
      zh: "请填写每股分红。",
    },
  );
});

test("a holding needs a value in total mode, a quantity and a price in qty mode", () => {
  assert.deepEqual(keys(holding("total")), ["name", "value"]);
  assert.deepEqual(keys(holding("qty")), ["name", "quantity", "unitPrice"]);
  assert.deepEqual(both(holding("qty"), { name: "VWCE", quantity: "3" }), {
    en: "Fill in the price.",
    zh: "请填写价格。",
  });
});

test("a goal's label is needed only for 'other', where it is the goal", () => {
  assert.deepEqual(keys(goal("house")), ["type", "currency"]);
  assert.deepEqual(keys(goal("other")), ["type", "name", "currency"]);
  assert.deepEqual(both(goal("other"), { type: "other", currency: "EUR" }), {
    en: "Fill in what the goal is.",
    zh: "请填写目标内容。",
  });
});

test("a plan names what is missing before it asks for the source", () => {
  assert.deepEqual(both(PLAN, { name: "PAC", amount: "", ticker: "" }), {
    en: "Fill in the budget and a ticker.",
    zh: "请填写预算和代码。",
  });
  bothMatch(PLAN, { name: "PAC", amount: "300", ticker: "1" }, {
    en: "A plan has to take the money from somewhere",
    zh: "定投必须从某个地方扣钱",
  });
});

test("a transfer asks for a source or a destination before its currencies", () => {
  assert.deepEqual(
    both(TRANSFER, {
      date: "2026-09-24",
      amount: "100",
      currency: "EUR",
      toCurrency: "EUR",
    }),
    {
      en: "Pick a source and/or a destination institution.",
      zh: "请选择转出方和／或转入方机构。",
    },
  );
  assert.deepEqual(both(TRANSFER, { date: "2026-09-24", amount: "", ends: "" }), {
    en: "Fill in the amount.",
    zh: "请填写金额。",
  });
});

test("a transfer's two currencies share one sentence", () => {
  const base = { date: "2026-09-24", amount: "100", ends: "2" };
  const said = both(TRANSFER, { ...base, currency: "EUR" });
  assert.deepEqual(said, both(TRANSFER, { ...base, toCurrency: "USD" }));
  bothMatch(TRANSFER, { ...base, currency: "EUR" }, {
    en: "Say which currencies these are: what left the source",
    zh: "请说明各自的币种",
  });
});

test("a dated series needs its date and its amount, under the amount's own noun", () => {
  assert.deepEqual(both(dated("forms.noun.value", "forms.ask.value"), {}), {
    en: "Fill in the date and the value.",
    zh: "请填写日期和价值。",
  });
});

test("marks: aria-required on every need, the question only where a box can show one", () => {
  for (const locale of ["en", "zh"] as Locale[]) {
    setLocale(locale);
    assert.deepEqual(marks(INCOME, "amount"), {
      "aria-required": true,
      placeholder: locale === "en" ? "How much?" : "多少钱？",
    });
    assert.deepEqual(marks(TRANSFER, "date"), { "aria-required": true });
    assert.deepEqual(marks(PLAN, "sourceId"), { "aria-required": true });
    assert.deepEqual(marks(goal("house"), "name"), {});
  }
  setLocale("en");
});

test("every question is a question; only selects, dates, the either-or and currency boxes ask none", () => {
  const all = [
    INSTITUTION,
    INCOME,
    EXPENSE,
    REAL_ASSET,
    DEBT,
    TRANSFER,
    PLAN,
    dated("forms.noun.value", "forms.ask.value"),
    goal("other"),
    holding("total"),
    holding("qty"),
    transaction("buy", false),
    transaction("close", true),
  ].flat();
  // In both languages the question still ends in a question mark: Chinese
  // writes `？`, and a question that had become a statement would lose it.
  for (const locale of ["en", "zh"] as Locale[]) {
    setLocale(locale);
    for (const n of all) {
      if (n.askKey) assert.match(marks([n], n.key).placeholder ?? "", /[?？]/, n.key);
    }
  }
  setLocale("en");
  const unasked = all.filter((n) => !n.askKey).map((n) => n.key);
  assert.deepEqual([...new Set(unasked)].sort(), [
    "currency",
    "date",
    "ends",
    "institutionId",
    "priceCurrency",
    "sourceId",
    "toCurrency",
    "type",
  ]);
});

test("missing keeps the form's order", () => {
  assert.deepEqual(keys(missing(transaction("buy", false), { symbol: "X" })), [
    "assetName",
    "quantity",
    "unitPrice",
    "institutionId",
    "currency",
    "priceCurrency",
  ]);
});
