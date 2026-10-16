/* What deleting a ledger entry does beyond the row, said before the press
   (brief AO).

   The catch-up writes some entries by itself: a PAC's buys, each for one
   occurrence of its plan, and the dividends of a position that follows them.
   Until brief AO, deleting one of them opened its occurrence or its day again,
   and the next start wrote it again: the occurrence bought again with what
   the deleted buy had left counted twice, the dividend recorded again. Now a
   deletion stays one (`crud.delete_transaction`, which the chat's card calls
   too): the PAC does not buy that occurrence again, its carry goes to zero,
   and the app does not record a dividend on that day again. The question the
   form asked said none of it.

   Each branch is ONE catalogue sentence rather than clauses glued here: the
   punctuation between clauses belongs to the language, and a Chinese question
   ends with a full stop its English twin ends with a question mark.

   Pure, so `tests/ledgerDelete.test.ts` runs it under Node without a bundler.
   Dates go in as ISO strings; `fmt` is how the page prints them. */

import { t, tOpt } from "../i18n/t.ts";

/** The ledger fields this reads, as `TransactionRead` carries them. */
export type LedgerEntry = {
  id: number;
  kind: string;
  date: string;
  asset_name: string;
  symbol: string | null;
  institution_id: number | null;
  plan_id: number | null;
  plan_occurrence: string | null;
};

const asIs = (iso: string) => iso;

/** The reader's word for a stored kind; a kind nobody has named yet is shown
    as stored rather than dropped. */
function kindWord(kind: string): string {
  return tOpt(`ledger.kind.${kind}`) ?? kind;
}

/** The question the ledger's Delete asks about `entry`, with what follows
    from it. `rows` is the ledger, where the other buys of its occurrence are. */
export function deleteQuestion(
  entry: LedgerEntry,
  rows: LedgerEntry[],
  fmt: (iso: string) => string = asIs,
): string {
  const said = {
    kind: kindWord(entry.kind),
    name: entry.asset_name,
    date: fmt(entry.date),
  };
  if (entry.kind === "buy" && entry.plan_id != null && entry.plan_occurrence) {
    const occurrence = fmt(entry.plan_occurrence);
    const others = rows.some(
      (r) =>
        r.id !== entry.id &&
        r.plan_id === entry.plan_id &&
        r.plan_occurrence === entry.plan_occurrence,
    );
    return others
      ? t("ledger.deletePacKeeps", { ...said, occurrence })
      : t("ledger.deletePacLast", { ...said, occurrence });
  }
  if (entry.kind === "dividend" && entry.symbol && entry.institution_id != null) {
    return t("ledger.deleteDividend", { ...said, symbol: entry.symbol });
  }
  return t("ledger.deletePlain", said);
}
