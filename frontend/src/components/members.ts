/* Whose a row is, as the pages say it.

   No React and no DOM: the avatar's colour and letter, and the filter's
   arithmetic, shared by every form and list that shows a member — and tested
   in `tests/members.test.ts`, where a chip that changes colour between two
   pages would be caught. */

import { t } from "../i18n/t.ts";

/** The avatar's colour slot for a member, or the shared (共同) slot.

   By id, not by position in a list: a chip keeps its colour when someone is
   added or removed, so a reader's eye can follow "the blue one" across pages.
   Six slots, wrapped — identity, not uniqueness; the letter disambiguates. */
export function memberTint(memberId: number | null): string {
  if (memberId == null) return "kin-shared";
  return `kin-${(memberId % 6) + 1}`;
}

/** What the chip shows: the member's first character, or 家 for 共同.

   One character is what a 24px chip can hold and still be read beside a name;
   the whole name is always beside the chip anyway. */
export function memberLetter(name: string | null, memberId: number | null): string {
  if (memberId == null) return "家";
  const trimmed = (name ?? "").trim();
  return trimmed ? Array.from(trimmed)[0] : "?";
}

/** How the shared slice is called beside members. Words, so a function: the
    language in force is decided when it is read, not when this loads. */
export function sharedLabel(): string {
  return t("members.shared");
}

/** What a filter selects: everyone, only the shared (共同) rows, or one
    member. `null` as a member id means shared — the same null a row's
    `member_id` carries — so "shared" and "this person" are the same kind of
    question, and "everyone" is the only other answer. */
export type MemberFilter = "all" | number | null;

/** Whether a row survives the filter. `all` keeps everything; otherwise a row
    belongs to the filter exactly as its member_id says — no account or note
    is asked, because a row's attribution is its own fact. */
export function matchesMember(rowMemberId: number | null, filter: MemberFilter): boolean {
  return filter === "all" || rowMemberId === filter;
}
