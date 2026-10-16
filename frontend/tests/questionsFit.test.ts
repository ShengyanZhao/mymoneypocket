/* Every question a form asks fits its box, with room to spare.

   09 put a question in every empty required box and measured none of them on
   the page: 16 of 25 were cut ("How mar", "Which ticker or IS"). This pins the
   font, not the strings. A width is the sum of Archivo's advances at weight
   400, 14px, the size and weight the inputs render at; a room is the box's
   width minus its padding and border, measured on the page in Edge at 1440px
   on 2026-09-25. A new question that is too long fails here on its own, and a
   question in a box nobody has measured fails until someone does.

   SLACK is kept free because the advances leave kerning out and a browser can
   round differently: "What is it? e.g. Mortgage" was 152.7px in 156, and
   3px of margin is how a question gets cut again by a rendering nobody tried.

   BOTH LANGUAGES are measured, with their own fonts. Chinese has no Archivo
   advances — the self-hosted subset is latin-only and the glyph comes from
   PingFang or YaHei — but a CJK glyph is full width by the standard that font
   is built to, so one em is the width and the table is not needed. That is
   not an approximation of the rendering, it is the rule the rendering follows.
   English still needs the table, because a proportional font's advances are
   what it is made of.

   Run by `npm test` with Node's own test runner; no runtime imports. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { ARCHIVO_400, UNITS_PER_EM } from "./archivoAdvances.ts";
import {
  BALANCE,
  CASH_ANCHOR,
  DEBT,
  EXPENSE,
  INCOME,
  INSTITUTION,
  PLAN,
  REAL_ASSET,
  TRANSFER,
  VALUATION,
  goal,
  holding,
  transaction,
  type Need,
} from "../src/components/required.ts";
import { tIn, type Locale } from "../src/i18n/t.ts";

const PX = 14;
const SLACK = 4;

const LOCALES: Locale[] = ["en", "zh"];

/** A glyph the CJK font draws across a whole em: the ideographs, kana and
    Hangul, and the full-width brackets and punctuation that sit beside them. */
function fullWidth(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (
    (c >= 0x1100 && c <= 0x115f) || // Hangul Jamo
    (c >= 0x2e80 && c <= 0x303e) || // CJK radicals, Kangxi, punctuation
    (c >= 0x3041 && c <= 0x33ff) || // kana, Hangul compat, CJK compat
    (c >= 0x3400 && c <= 0x4dbf) || // CJK extension A
    (c >= 0x4e00 && c <= 0x9fff) || // CJK unified
    (c >= 0xf900 && c <= 0xfaff) || // CJK compat ideographs
    (c >= 0xfe30 && c <= 0xfe4f) || // CJK compat forms
    (c >= 0xff00 && c <= 0xff60) || // full-width forms
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x20000 && c <= 0x2fa1f) // CJK extensions B and on
  );
}

/** The rendered width of `text` at 14px, weight 400, kerning left out. */
function width(text: string): number {
  let units = 0;
  for (const ch of text) {
    if (fullWidth(ch)) {
      // One em, whatever the font: full-width by design, not by measurement.
      units += UNITS_PER_EM;
      continue;
    }
    const advance = ARCHIVO_400[ch];
    assert.ok(advance !== undefined, `no advance for ${JSON.stringify(ch)}: extend archivoAdvances.ts`);
    units += advance;
  }
  return (units * PX) / UNITS_PER_EM;
}

/** Every rule the forms use, in every state that changes what it asks. */
const RULES: [string, Need[]][] = [
  ["INSTITUTION", INSTITUTION],
  ["INCOME", INCOME],
  ["EXPENSE", EXPENSE],
  ["REAL_ASSET", REAL_ASSET],
  ["DEBT", DEBT],
  ["goal(other)", goal("other")],
  ["TRANSFER", TRANSFER],
  ["PLAN", PLAN],
  ["CASH_ANCHOR", CASH_ANCHOR],
  ["VALUATION", VALUATION],
  ["BALANCE", BALANCE],
  ["holding(total)", holding("total")],
  ["holding(qty)", holding("qty")],
  ["transaction(buy)", transaction("buy", false)],
  ["transaction(dividend)", transaction("dividend", false)],
  ["transaction(close)", transaction("close", true)],
];

/** The room inside each box that shows a question, in px. Measured: a box
    with no width class (156), w-24 (70), w-28 (86), w-32 (102), the picker's
    w-72 (262), and the goal's detail at its min-w-64 (230). */
const ROOM: Record<string, number> = {
  "INSTITUTION.name": 156,
  "INCOME.name": 156,
  "INCOME.amount": 86,
  "EXPENSE.name": 156,
  "EXPENSE.amount": 86,
  "REAL_ASSET.name": 156,
  "DEBT.name": 156,
  "goal(other).name": 230,
  "TRANSFER.amount": 86,
  "PLAN.name": 156,
  "PLAN.amount": 86,
  "PLAN.ticker": 102,
  "CASH_ANCHOR.amount": 102,
  "VALUATION.amount": 156,
  "BALANCE.amount": 156,
  "holding(total).name": 262,
  "holding(total).value": 102,
  "holding(qty).name": 262,
  "holding(qty).quantity": 70,
  "holding(qty).unitPrice": 86,
  "transaction(buy).assetName": 262,
  "transaction(buy).symbol": 102,
  "transaction(buy).quantity": 70,
  "transaction(buy).unitPrice": 86,
  "transaction(dividend).assetName": 262,
  "transaction(dividend).symbol": 102,
  "transaction(dividend).quantity": 70,
  "transaction(dividend).unitPrice": 86,
  "transaction(close).assetName": 262,
  "transaction(close).fees": 102,
};

/** Where each rule's question is asked, and in what words, per language. */
function askedIn(locale: Locale): { at: string; ask: string }[] {
  return RULES.flatMap(([rule, needs]) =>
    needs
      .filter((n) => n.askKey)
      .map((n) => ({ at: `${rule}.${n.key}`, ask: tIn(locale, n.askKey as never) })),
  );
}

test("the table is weight 400, not the variable font's default 600", () => {
  // 76.0 at the default instance; 74.0 is what an input renders
  assert.equal(width("How many?").toFixed(1), "74.0");
});

test("a full-width glyph is one em wide", () => {
  // The Chinese table has no advances to look up; this is the rule it uses.
  assert.equal(width("价"), PX);
  assert.equal(width("价格？"), PX * 3);
});

test("every question has a measured box", () => {
  for (const locale of LOCALES) {
    const unmeasured = askedIn(locale)
      .filter((q) => ROOM[q.at] === undefined)
      .map((q) => `${locale}: ${q.at}`);
    assert.deepEqual(unmeasured, [], "measure these boxes on the page and add them to ROOM");
  }
});

test(`every question fits its box with ${SLACK}px to spare`, () => {
  for (const locale of LOCALES) {
    const tight = askedIn(locale)
      .map((q) => ({ ...q, width: width(q.ask), room: ROOM[q.at] }))
      .filter((q) => q.width + SLACK > q.room)
      .map((q) => `${locale}: ${q.at} "${q.ask}" is ${q.width.toFixed(1)}px in ${q.room}`);
    assert.deepEqual(tight, []);
  }
});

test("the check refuses what 09 shipped, and a question with 3px to spare", () => {
  const fits = (text: string, room: number) => width(text) + SLACK <= room;
  assert.equal(fits("How many?", 70), false);
  assert.equal(fits("Which ticker or ISIN?", 102), false);
  assert.equal(fits("How much each time?", 86), false);
  assert.equal(fits("What is it? e.g. Mortgage", 156), false);
  assert.equal(fits("What is it? e.g. Car loan", 156), true);
});

test("the same box check catches a Chinese question that is too long", () => {
  const fits = (text: string, room: number) => width(text) + SLACK <= room;
  // 12 full-width glyphs is 168px — far past the 156 of a name box. This is
  // what "是什么？例如 米兰的房子" would have cost.
  assert.equal(fits("是什么？例如米兰的房子", 156), false);
  assert.equal(fits("是什么？例如米兰公寓", 156), true);
});
