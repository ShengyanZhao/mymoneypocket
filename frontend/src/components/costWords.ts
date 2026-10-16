/* What a position's average price and its P/L say about where its cost came
   from, on the Portfolio table (brief AI).

   A cost is estimated when any unit behind it is (`positions.replay` on the
   backend): a photographed cost derived from a reported return, or a plan's
   buy, which is priced at the market close and marked estimated until the
   reader corrects it. The titles named the first source only, so a position
   bought by a PAC said its price was "derived from a reported return", and
   until brief AI it was not even marked.

   Every sentence is looked up when it is said: a title arrives under a column
   the reader may have just switched the language of.

   Pure, so `tests/costWords.test.ts` runs it under Node without a bundler. */

import { t } from "../i18n/t.ts";

type CostRow = { cost_known: boolean; cost_estimated: boolean };

/** The title over a row's average price. */
export function avgCostTitle(r: CostRow): string {
  if (!r.cost_known) {
    return t("cost.avgCostUnknown");
  }
  if (r.cost_estimated) {
    return t("cost.avgCostEstimated");
  }
  return t("cost.avgCostPaid");
}

/** The title over a row's profit or loss. */
export function plTitle(r: CostRow): string {
  if (!r.cost_known) {
    return t("cost.plUnknown");
  }
  if (r.cost_estimated) {
    return t("cost.plEstimated");
  }
  return t("cost.plPaid");
}
