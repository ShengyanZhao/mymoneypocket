/* 涨跌配色 — which way the market colours point.

   `cn` (default): 红涨绿跌 — red up, green down — the A-share convention, and
   the one a Chinese reader's eye is trained on. `west`: 绿涨红跌, the
   convention of every other market, for readers who also watch US/HK
   listings.

   The VALUES live in index.css: `html[data-gains="west"]` re-points the two
   direction tokens and nothing else. This module only decides which set is in
   force and remembers the choice — same shape as the language setting in
   `i18n/t.ts`, and for the same reason: the flip is a CSS-variable move, so
   the whole page repaints without React knowing.

   Status colours do not move with this setting. `good` is green and `bad` is
   red on every exchange floor: a refusal stays red whichever way gains point. */

export type Gains = "cn" | "west";

const STORAGE_KEY = "aurelio.gains";

function readStored(): Gains | null {
  // `typeof` rather than a bare global: a build step or a node test has no
  // localStorage, and that is a real answer rather than a missing one.
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "cn" || v === "west" ? v : null;
  } catch {
    // Private browsing can refuse the read. The default is the right
    // recovery: nothing is lost but a preference.
    return null;
  }
}

let current: Gains = readStored() ?? "cn";

export function getGains(): Gains {
  return current;
}

/** Put the choice in force on the page. A no-op where there is no DOM. */
function apply(): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.gains = current;
}

export function setGains(next: Gains): void {
  if (next === current) return;
  current = next;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A preference we cannot keep is still a preference in force for this
      // session. Swallowing this is the whole of the error handling it needs.
    }
  }
  apply();
}

// In force from the first import, so no screen is ever drawn in the other
// convention for a frame.
apply();
