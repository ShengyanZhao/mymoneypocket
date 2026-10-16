/* What a watchlist line says about the instrument it names.

   A line is a FUND from the catalogue, named by its ISIN, with perhaps a
   ticker from Yahoo's lookup beside it as a hint; or, since brief AG, a single
   SHARE, named by the symbol Yahoo lists it under and with no ISIN, because
   nothing this app can ask gives a share's. The ISIN alone tells them apart,
   and the sentences differ because the symbol means two things: a hint to
   check on a fund's line, the identity on a share's.

   The sentences are whole catalogue values rather than a suffix glued on
   here: where the clause a language puts last goes is that language's
   business.

   No runtime imports besides the catalogue, so `npm test` reaches it. */

import { t } from "../i18n/t.ts";

/** The two fields that say what a line names. */
export interface WatchedInstrument {
  isin?: string | null;
  symbol?: string | null;
}

/** Whether the line names a single share rather than a fund. */
export function isShare(item: WatchedInstrument): boolean {
  return !item.isin;
}

/** The line under the name: what identifies it, and the hint beside it. */
export function identityOf(item: WatchedInstrument): string {
  if (isShare(item)) return t("watch.shareIdentity", { symbol: item.symbol ?? "" });
  return [item.isin, item.symbol].filter(Boolean).join(" · ");
}

/** What the ledger form says when "Record a buy" brings a line into it. */
export function prefillNote(item: WatchedInstrument): string {
  if (isShare(item)) {
    return t("watch.prefillShare", { symbol: item.symbol ?? "" });
  }
  return item.symbol
    ? t("watch.prefillFund", { isin: item.isin, symbol: item.symbol })
    : t("watch.prefillFundBare", { isin: item.isin });
}
