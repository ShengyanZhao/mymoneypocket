/* What the instrument picker says while the fund catalogue is not there yet.

   Nobody presses anything for the catalogue any more: every page load asks
   the backend, which downloads it in the background when it is missing or a
   week old. So an empty list has one sentence for each place that download can
   be, in the reader's words, and never a button. Once the catalogue has funds
   in it nothing is said at all: an old list still works, so a refresh that is
   running, or that failed, is not something the reader has to know.

   No browser imports, so `npm test` reaches it. The words come from the
   catalogue when they are said. */

import { t } from "../i18n/t.ts";

/** What `/api/instruments/catalogue` and every search report. */
export interface CatalogueState {
  rows: number;
  state: "ready" | "downloading" | "failed" | "not_started";
  /** When a failed download is tried again, at a page load, at the earliest. */
  retry_after: string | null;
}

/** The sentence for an empty catalogue, or null when there is nothing to say.
    `clockTime` turns the retry moment into the reader's own clock time. */
export function catalogueNotice(
  status: CatalogueState | null,
  clockTime: (iso: string) => string,
): string | null {
  if (status === null || status.rows > 0) return null;
  const meanwhile = t("catalogue.meanwhile");
  switch (status.state) {
    case "downloading":
      return t("catalogue.downloading", { meanwhile });
    case "failed":
      return status.retry_after
        ? t("catalogue.failedFrom", { time: clockTime(status.retry_after), meanwhile })
        : t("catalogue.failed", { meanwhile });
    default:
      // Empty, and nothing has asked since the server started: a page left
      // open while the backend was restarted.
      return t("catalogue.notStarted", { meanwhile });
  }
}
