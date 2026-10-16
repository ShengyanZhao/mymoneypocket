/* What the monthly figures leave out, said beside them (brief AI).

   The Cash flow page and the Dashboard show the income and expenses IN FORCE
   today, as the chat and the analysis read them: one computation on the
   backend (`analytics.compute_flows_in_force`), which lists apart the flows
   whose first payment is after today and the ones that have ended. Until
   then the page summed every flow whatever its dates, so a salary starting
   next month read as one already paid, and nothing said otherwise.

   These are the words: the sentence under the figures, what the figures
   leave out, and the line a left-out row carries. A one-off is never in the
   monthly figures, so the count of what is left out does not name one; its
   row says when it falls.

   Every sentence is assembled from the catalogue at the moment it is said,
   never held in a constant: these words arrive under a figure the reader has
   just changed the language of, and a constant would still be speaking the
   old one. The counts go through `t` as `count`, which is what decides one
   versus many in a language that has the distinction.

   Pure, with type-only imports besides the catalogue, so `tests/inForce.test.ts`
   runs it under Node without a bundler. */

import { joinList, t, type MessageKey } from "../i18n/t.ts";
import type { Schemas } from "../api/types";

type Summary = Pick<Schemas["CashFlowSummary"], "scheduled" | "ended" | "undated">;
type LeftOut = Schemas["FlowNotCounted"];

/** What the figures are, said once under them on both pages. */
export function inForceIntro(): string {
  return t("inForce.intro");
}

const ONCE = "one_off";

function counted(n: number, key: MessageKey): string | null {
  return n > 0 ? t(key, { count: n }) : null;
}

/** What a group of left-out flows is called: "1 income and 2 expenses that
    start later", or null for none. The `count` is how many flows the clause
    is about, which is what decides "starts" against "start" — not the counts
    inside `nouns`, which already took theirs. */
function phrase(flows: LeftOut[], key: MessageKey): string | null {
  const recurring = flows.filter((f) => f.frequency !== ONCE);
  const nouns = [
    counted(recurring.filter((f) => f.side === "income").length, "inForce.incomes"),
    counted(recurring.filter((f) => f.side === "expense").length, "inForce.expenses"),
  ].filter((n): n is string => n !== null);
  if (nouns.length === 0) return null;
  return t(key, { nouns: joinList(nouns), count: recurring.length });
}

/** Two clauses said as one sentence, with the punctuation of the language.
    One clause is said alone: a comma with nothing after it is not a pause,
    it is a cut. */
function join(parts: string[]): string {
  return parts.length === 1 ? parts[0] : t("inForce.join", { a: parts[0], b: parts[1] });
}

/** What the figures leave out, by count: "1 income that starts later, 1
    expense that has ended". Null when they leave out nothing that repeats. */
export function notCounted(summary: Summary): string | null {
  const parts = [
    phrase(summary.scheduled, "inForce.startsLater"),
    phrase(summary.ended, "inForce.hasEnded"),
  ].filter((p): p is string => p !== null);
  return parts.length ? join(parts) : null;
}

/** A flow with no first payment date is counted: said, since the figures
    cannot show it. Null when there is none. */
export function undatedLine(n: number): string | null {
  if (n <= 0) return null;
  return t("inForce.undated", { count: n });
}

/** The line a row carries when the figures leave it out, or undefined. */
export function leftOutLine(
  summary: Summary,
  side: "income" | "expense",
  id: number,
): string | undefined {
  const later = summary.scheduled.find((f) => f.side === side && f.id === id);
  if (later) {
    return later.frequency === ONCE
      ? t("inForce.onceOn", { date: later.start_date })
      : t("inForce.startsOn", { date: later.start_date });
  }
  const gone = summary.ended.find((f) => f.side === side && f.id === id);
  if (gone && gone.frequency !== ONCE) return t("inForce.endedOn", { date: gone.end_date });
  return undefined;
}
