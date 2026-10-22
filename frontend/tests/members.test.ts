/* Whose a row is: the chip's identity and the filter's arithmetic.

   The chip must look the same on every page — a colour that follows list
   position would make "the blue one" a different person in each form — and
   the filter must hide rows and only rows. Both are small functions, so both
   are written out here rather than left to a screenshot. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { matchesMember, memberLetter, memberTint } from "../src/components/members.ts";

test("a chip's colour follows the member's id, not their place in a list", () => {
  // Id 3 is the same slot wherever it appears, and adding/removing members
  // cannot move anyone else's colour.
  assert.equal(memberTint(3), memberTint(3));
  assert.equal(memberTint(3), "kin-4"); // (3 % 6) + 1
  assert.equal(memberTint(7), memberTint(1)); // six slots wrap, the letter disambiguates
  assert.equal(memberTint(null), "kin-shared");
});

test("the chip shows one character, and 家 for the shared household", () => {
  assert.equal(memberLetter("陈昊", 1), "陈");
  assert.equal(memberLetter("林悦", 2), "林");
  assert.equal(memberLetter(null, null), "家");
  // A name of spaces is not a name; the chip says so rather than showing blank.
  assert.equal(memberLetter("   ", 3), "?");
});

test("the filter keeps everyone, one member's rows, or the shared rows", () => {
  assert.equal(matchesMember(1, "all"), true);
  assert.equal(matchesMember(null, "all"), true);
  assert.equal(matchesMember(1, 1), true);
  assert.equal(matchesMember(2, 1), false);
  assert.equal(matchesMember(null, 1), false);
  // null is the shared slice — the same null the rows carry.
  assert.equal(matchesMember(null, null), true);
  assert.equal(matchesMember(1, null), false);
});
