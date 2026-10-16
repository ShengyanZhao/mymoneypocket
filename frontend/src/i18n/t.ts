/* The message lookup: which words, in which language.

   No React and no DOM on purpose — `required.ts`, `costWords.ts` and the rest
   of the sentence modules are plain arithmetic about strings and are run by
   `node` alone in `tests/`. Anything that needs a browser lives in `useT.ts`
   and gets its language from here.

   LANGUAGE is two things that this file keeps apart. The app's is `en` or
   `zh`, chosen by the reader and remembered. The number-and-date FORMAT is
   separate: `getFormatLocale()` maps the app's language onto a full locale
   tag for `Intl`, and English keeps the reader's own browser tag, because a
   German reading the English UI still wants 1.234,56. */

import { en, type MessageKey } from "./messages/en.ts";
import { zh } from "./messages/zh.ts";

export type { MessageKey };
export type Locale = "en" | "zh";

const CATALOGUES: Record<Locale, Record<string, string>> = { en, zh };

const STORAGE_KEY = "aurelio.locale";

function readStored(): Locale | null {
  // `typeof` rather than a bare global: a build step or a node test has
  // neither of these, and that is a real answer rather than a missing one.
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "zh" ? v : null;
  } catch {
    // Private browsing can refuse the read. Falling through to the browser's
    // language is the right recovery: nothing is lost but a preference.
    return null;
  }
}

function readBrowser(): Locale {
  if (typeof navigator === "undefined" || !navigator.language) return "en";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

let current: Locale = readStored() ?? readBrowser();

const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

/** What `Intl` should format numbers and dates in, as a full tag.

    `zh` becomes `zh-CN` so dates read 2026年10月11日 and figures group by four
    digits where that is the convention. `en` deliberately keeps whatever the
    browser said: English is the app's default language, not a claim that the
    reader lives in the United States. */
export function getFormatLocale(): string | undefined {
  if (current === "zh") return "zh-CN";
  return typeof navigator !== "undefined" && navigator.language ? navigator.language : undefined;
}

export function setLocale(next: Locale): void {
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
  // Nothing here touches `document`. This module is loaded by `tests/` as
  // well as by the app, and the test side of `tsconfig` has no DOM in it: the
  // page's own `lang` attribute is kept in step by `useT.ts`, which only the
  // browser half ever imports.
  for (const fn of listeners) fn();
}

/** For React's `useSyncExternalStore`. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function pick(value: string, count: string | number | null | undefined): string {
  if (count == null) return value;
  const parts = value.split("|");
  if (parts.length < 2) return value;
  const n = typeof count === "number" ? count : Number(count);
  return n === 1 ? parts[0] : parts[parts.length - 1];
}

function fill(template: string, params: Params | undefined): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name] ?? "") : whole,
  );
}

/* A placeholder's value. `null` and `undefined` are allowed because the
   backend's own types are: a `start_date` that is not known is `string | null`,
   and a sentence saying "starts on {date}" with the date absent should say
   "starts on " rather than "starts on null" — the visible blank is the fact. */
export type Params = Record<string, string | number | null | undefined>;

/** The words for `key`, in the language in force, with `{placeholders}` filled.

    A key nothing has been written for reads back as itself, which is the shape
    of a missing message that is easiest to spot in a running app and hardest
    to mistake for a translation. */
export function t(key: MessageKey, params?: Params): string {
  const value = CATALOGUES[current][key];
  if (value === undefined) return key;
  return fill(pick(value, params?.count), params);
}

/** A key that may not exist — the code dictionaries under `code.*`, where the
    backend can send something no one has named yet. `null` tells the caller to
    fall back to its own wording rather than print a raw key at the reader. */
export function tOpt(key: string, params?: Params): string | null {
  const value = CATALOGUES[current][key];
  if (value === undefined) return null;
  return fill(pick(value, params?.count), params);
}

/** Same words as `t`, kept as the pieces a sentence is built from.

    `*em*` and `**strong**` survive into parts so a component can mark up
    where its language wants the mark, instead of the code slicing a
    translated sentence around JSX it was written for. Plain `t` erases the
    marks, so a call site that needs a bare string still gets one. */
export type RichPart =
  | { kind: "text"; value: string }
  | { kind: "em"; value: string }
  | { kind: "strong"; value: string };

const RICH = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function tRich(key: MessageKey, params?: Params): RichPart[] {
  const text = fill(pick(CATALOGUES[current][key] ?? key, params?.count), params);
  const parts: RichPart[] = [];
  let at = 0;
  for (const m of text.matchAll(RICH)) {
    const start = m.index ?? 0;
    if (start > at) parts.push({ kind: "text", value: text.slice(at, start) });
    const body = m[0];
    if (body.startsWith("**")) parts.push({ kind: "strong", value: body.slice(2, -2) });
    else parts.push({ kind: "em", value: body.slice(1, -1) });
    at = start + body.length;
  }
  if (at < text.length) parts.push({ kind: "text", value: text.slice(at) });
  return parts;
}

/** `t`, with the marks erased. Same output as reading `t`'s result and
    deleting asterisks, without a second pass over the string. */
export function tPlain(key: MessageKey, params?: Params): string {
  return tRich(key, params)
    .map((p) => p.value)
    .join("");
}

/** A list said the way the language says a list: English commas with a final
    "and", Chinese `、` throughout. Two is its own case in both — `t`'s
    `forms.listTwo` is what says it, because the words between the items are
    words and belong with the other words. */
export function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return t("forms.listTwo", { a: items[0], b: items[1] });
  return t("forms.listMany", {
    head: items.slice(0, -1).join(current === "zh" ? "、" : ", "),
    last: items[items.length - 1],
  });
}

/** For tests: look up a message in a SPECIFIC language, whatever is in force.
    The per-locale fixtures in `tests/` assert on both catalogues without
    flipping the app's language out from under each other. */
export function tIn(locale: Locale, key: MessageKey, params?: Params): string {
  const value = CATALOGUES[locale][key];
  if (value === undefined) return key;
  return fill(pick(value, params?.count), params);
}

/** For tests: both catalogues, so a test can check keys and placeholders. */
export const catalogues = CATALOGUES;
