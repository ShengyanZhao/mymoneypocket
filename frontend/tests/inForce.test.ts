/* What the monthly figures leave out, said beside them (brief AI).

   The figures count the income and expenses in force today; the ones still
   to start and the ones that have ended come back listed apart, and the page
   says so under the figures and on each left-out row. Every expected value
   is written here; the flows are invented.

   Each is a PER-LOCALE FIXTURE: both languages written out, side by side.
   These sentences are assembled from several catalogue values at once — a
   count, a noun, a verb phrase and a join — and a test that checked only
   English would not notice the assembly reading wrong in Chinese. */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inForceIntro,
  leftOutLine,
  notCounted,
  undatedLine,
} from "../src/components/inForce.ts";
import { setLocale, type Locale } from "../src/i18n/t.ts";

type Side = "income" | "expense";

function flow(
  side: Side,
  id: number,
  frequency: string | null,
  start: string | null,
  end: string | null,
) {
  return { side, id, name: `flow ${id}`, frequency, start_date: start, end_date: end };
}

const NOTHING = { scheduled: [], ended: [], undated: 0 };
const LOCALES: Locale[] = ["en", "zh"];

/** What the words say in each language, side by side. */
function both<T>(body: () => T): Record<Locale, T> {
  const said = {} as Record<Locale, T>;
  for (const locale of LOCALES) {
    setLocale(locale);
    said[locale] = body();
  }
  setLocale("en");
  return said;
}

test("the figures say what they are", () => {
  assert.deepEqual(both(inForceIntro), {
    en: "In force today, as a monthly run-rate; one-off items excluded.",
    zh: "按今天的实际存续计算，为月度口径；一次性项目不计。",
  });
});

test("nothing left out says nothing", () => {
  assert.deepEqual(both(() => notCounted(NOTHING)), { en: null, zh: null });
});

test("what starts later and what has ended are counted apart", () => {
  const summary = {
    scheduled: [flow("income", 1, "monthly", "2026-10-30", null)],
    ended: [flow("expense", 2, "monthly", "2025-01-01", "2026-06-30")],
    undated: 0,
  };
  assert.deepEqual(both(() => notCounted(summary)), {
    en: "1 income that starts later, 1 expense that has ended",
    zh: "1 笔收入尚未开始，1 笔支出已经结束",
  });
});

test("several of one kind are counted together, with the verb agreeing", () => {
  const summary = {
    scheduled: [
      flow("income", 1, "monthly", "2026-10-30", null),
      flow("expense", 2, "quarterly", "2026-11-01", null),
      flow("expense", 3, null, "2026-12-01", null),
    ],
    ended: [
      flow("income", 4, "monthly", "2025-01-01", "2026-05-31"),
      flow("income", 5, "annual", "2024-01-01", "2026-01-31"),
    ],
    undated: 0,
  };
  assert.deepEqual(both(() => notCounted(summary)), {
    en: "1 income and 2 expenses that start later, 2 incomes that have ended",
    zh: "1 笔收入和2 笔支出尚未开始，2 笔收入已经结束",
  });
});

test("a one-off is never in the monthly figures, so it is not counted as left out", () => {
  const summary = {
    scheduled: [flow("expense", 7, "one_off", "2026-11-15", null)],
    ended: [],
    undated: 0,
  };
  assert.deepEqual(both(() => notCounted(summary)), { en: null, zh: null });
});

test("a flow with no first payment date is said to be counted", () => {
  assert.deepEqual(both(() => undatedLine(0)), { en: null, zh: null });
  assert.deepEqual(both(() => undatedLine(1)), {
    en: "1 flow with no first payment date is counted as in force.",
    zh: "1 笔没有首次付款日期的流水，已按存续计入。",
  });
  assert.deepEqual(both(() => undatedLine(3)), {
    en: "3 flows with no first payment date are counted as in force.",
    zh: "3 笔没有首次付款日期的流水，已按存续计入。",
  });
});

test("a row that starts later says when, and that it is not counted until then", () => {
  const summary = {
    ...NOTHING,
    scheduled: [flow("income", 1, "monthly", "2026-10-30", null)],
  };
  assert.deepEqual(both(() => leftOutLine(summary, "income", 1)), {
    en: "Starts on 2026-10-30: not counted until then.",
    zh: "2026-10-30 起才开始：在此之前不计入。",
  });
});

test("a row that has ended says when, and that it is no longer counted", () => {
  const summary = {
    ...NOTHING,
    ended: [flow("expense", 2, "monthly", "2025-01-01", "2026-06-30")],
  };
  assert.deepEqual(both(() => leftOutLine(summary, "expense", 2)), {
    en: "Ended on 2026-06-30: no longer counted.",
    zh: "2026-06-30 结束：之后不再计入。",
  });
});

test("a one-off still to come says the day it falls on", () => {
  const summary = {
    ...NOTHING,
    scheduled: [flow("expense", 7, "one_off", "2026-11-15", null)],
  };
  assert.deepEqual(both(() => leftOutLine(summary, "expense", 7)), {
    en: "On 2026-11-15, once: not in the monthly figures.",
    zh: "2026-11-15 一次性发生，不计入月度数字。",
  });
});

test("a row in force carries no line, and an income is never an expense", () => {
  const summary = {
    ...NOTHING,
    scheduled: [flow("income", 1, "monthly", "2026-10-30", null)],
  };
  assert.deepEqual(both(() => leftOutLine(summary, "income", 9)), {
    en: undefined,
    zh: undefined,
  });
  assert.deepEqual(both(() => leftOutLine(summary, "expense", 1)), {
    en: undefined,
    zh: undefined,
  });
});
