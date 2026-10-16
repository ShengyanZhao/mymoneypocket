/* The same words, wired to React.

   `t.ts` holds the language; this makes a component care when it changes.
   `useSyncExternalStore` rather than context because there is no provider to
   place: the language is one app-wide value, and a hook that subscribes to it
   is a smaller thing to get wrong than a context that every layout has to
   wrap. */

import { useCallback, useSyncExternalStore } from "react";
import {
  getLocale,
  joinList,
  setLocale,
  subscribe,
  t,
  tPlain,
  tRich,
  type Locale,
  type MessageKey,
  type Params,
  type RichPart,
} from "./t.ts";

function snapshot(): Locale {
  return getLocale();
}

function serverSnapshot(): Locale {
  return "en";
}

export type T = {
  (key: MessageKey, params?: Params): string;
  /** The same words, split at `*em*` / `**strong**` so JSX can mark up where
      the translation wants the mark. */
  rich(key: MessageKey, params?: Params): RichPart[];
  /** The same words with the marks erased. */
  plain(key: MessageKey, params?: Params): string;
  /** A list said the way this language says a list. */
  list(items: string[]): string;
  locale: Locale;
};

/** The translator, plus the language it is speaking.

    Every component that says anything must read it through here — a bare `t`
    in a component would print the right words once and never learn the reader
    switched language. Pure modules called from a component that has already
    re-rendered use `t` from `./t` directly and are correct. */
export function useT(): T {
  const locale = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const fn = useCallback(
    (key: MessageKey, params?: Params) => t(key, params),
    // Rebuilt when the language changes so memoised children that took `t` as
    // a prop see a new one and re-render too.
    [locale],
  );
  return Object.assign(fn, {
    rich: (key: MessageKey, params?: Params) => tRich(key, params),
    plain: (key: MessageKey, params?: Params) => tPlain(key, params),
    list: (items: string[]) => joinList(items),
    locale,
  });
}

export { setLocale, type Locale };

/* The page says what language it is in.

   `t.ts` cannot touch `document` — the tests load it too, and that side of
   `tsconfig` has no DOM. So the one line that would live there lives here,
   where only the browser half ever comes. Read out a screen reader asks the
   document, not the catalogue, and a Chinese page announced in English is a
   Chinese page half of its readers cannot use. */
function keepPageLang() {
  document.documentElement.lang = getLocale() === "zh" ? "zh-CN" : "en";
}
keepPageLang();
subscribe(keepPageLang);
