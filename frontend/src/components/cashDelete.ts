/* What a page's Delete of a transfer or a balance asks, with what the
   deletion moves (brief AP).

   The Cash flow page asked "Delete this transfer?" and the account page
   "Delete the cash anchor of <day>?", and neither said what a deletion does
   to the cash. Measured on copies of the test database: deleting an account's
   only balance leaves its cash unprojected and counted 0 in every total, and
   deleting its latest one runs the cash from the balance before it. What a
   deletion moves is worked out by the backend (`cash_moves`), from the same
   function the chat's card says it with, and asked for here before the
   question is put.

   Pure, so `tests/cashDelete.test.ts` runs it under Node: the request and the
   reading of its failure are handed in. */

import { t } from "../i18n/t.ts";

/** The question, with what the backend says the deletion moves; when that
    could not be had, the question with why, so the reader still decides. */
export async function askBeforeDeleting(
  asked: string,
  moves: () => Promise<string>,
  failure: (err: unknown) => string,
): Promise<string> {
  try {
    return `${asked} ${await moves()}`;
  } catch (err) {
    return `${asked} ${t("del.movesUnknown", { reason: failure(err) })}`;
  }
}
