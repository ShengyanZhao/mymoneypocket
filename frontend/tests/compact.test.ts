/* 万 and 亿: the large figures, read the way a Chinese reader reads them.

   The rule is short — from 1万 up read by ten thousands, from 1亿 up by
   hundred millions, and only when the app is read in Chinese — but every
   line of it is a place a wrong figure could stand: the scale boundaries,
   the rounding of the scaled number, which language asks for the scale at
   all. So each is written here. */

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { compact } from "../src/components/money.ts";
import { setLocale } from "../src/i18n/t.ts";

// Node exposes a `navigator`, so the ambient locale is the machine's. These
// fixtures choose their own language per case; nothing here trusts the host.
afterEach(() => setLocale("en"));

test("from 1万 up, a Chinese reader gets 万", () => {
  setLocale("zh");
  assert.match(compact("CNY").format(12345), /1\.23\s*万$/);
});

test("from 1亿 up, the unit becomes 亿", () => {
  setLocale("zh");
  assert.match(compact("CNY").format(123456789), /1\.23\s*亿$/);
});

test("below 1万 the digits are printed whole, whatever the language", () => {
  setLocale("zh");
  assert.doesNotMatch(compact("CNY").format(8432), /万|亿/);
  setLocale("en");
  assert.doesNotMatch(compact("CNY").format(8432), /万|亿/);
});

test("the scale follows the figure's own currency, not a built-in one", () => {
  setLocale("zh");
  assert.match(compact("USD").format(12345), /1\.23\s*万$/);
  assert.match(compact("USD").format(12345), /USD|\$/);
});

test("a negative figure keeps its sign outside the scale", () => {
  setLocale("zh");
  assert.match(compact("CNY").format(-54321), /-.*5\.43\s*万$/);
});

test("English asks for no scale at all", () => {
  setLocale("en");
  assert.doesNotMatch(compact("CNY").format(12345), /万|亿/);
  assert.match(compact("CNY").format(12345), /12,?345/);
});
