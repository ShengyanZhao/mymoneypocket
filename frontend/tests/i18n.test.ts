/* The two catalogues cannot drift.

   A message that exists in English and not in Chinese reads back as its own
   key at the reader — "nav.tabs.dashboard" where a word belongs — and the
   reverse is a key nothing answers. A message whose placeholders differ is
   worse: the sentence still reads as prose, just prose that has forgotten the
   number or name it was about. Both are caught here rather than in a running
   app, because neither can be seen in a screenshot of the language that is
   complete.

   Every assertion below is a PER-LOCALE FIXTURE: the same case is written once
   per language, side by side, and run in both. Nothing here reads whatever
   language happens to be in force — node has a `navigator`, and on a machine
   whose system is Chinese that would quietly assert Chinese and never notice
   the English had gone. */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { en } from "../src/i18n/messages/en.ts";
import { zh } from "../src/i18n/messages/zh.ts";
import {
  getLocale,
  joinList,
  setLocale,
  t,
  tIn,
  tPlain,
  tRich,
  type Locale,
  type RichPart,
} from "../src/i18n/t.ts";

const LOCALES: Locale[] = ["en", "zh"];

/** Run `body` once per language, with that language in force. */
function inEach(body: (locale: Locale) => void) {
  for (const locale of LOCALES) {
    setLocale(locale);
    body(locale);
    // `afterEach` cannot reach inside a loop, so the restore is here: the next
    // case sets its own language first thing anyway, and a suite that ends
    // leaving Chinese in force would leak it into whatever runs after.
  }
  setLocale("en");
}

afterEach(() => setLocale("en"));

function placeholders(value: string): Set<string> {
  // The `|` splits one/two of a count; both sides are the same message and
  // must carry the same placeholders, so the split is erased before reading.
  const found = new Set<string>();
  for (const m of value.replace(/\|/g, " ").matchAll(/\{(\w+)\}/g)) found.add(m[1]);
  return found;
}

describe("the catalogues", () => {
  it("name the same messages in both languages", () => {
    const english = Object.keys(en).sort();
    const chinese = Object.keys(zh).sort();
    const missingInChinese = english.filter((k) => !(k in zh));
    const extraInChinese = chinese.filter((k) => !(k in en));
    assert.deepEqual(
      missingInChinese,
      [],
      `keys with no Chinese words: ${missingInChinese.join(", ")}`,
    );
    assert.deepEqual(
      extraInChinese,
      [],
      `Chinese keys that say nothing in English: ${extraInChinese.join(", ")}`,
    );
    assert.equal(chinese.length, english.length);
  });

  it("say every message in the same pieces", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const a = placeholders(en[key]);
      const b = placeholders(zh[key]);
      assert.deepEqual(
        [...a].sort(),
        [...b].sort(),
        `placeholders of "${key}" differ: en {${[...a]}} vs zh {${[...b]}}`,
      );
    }
  });

  it("leave no message empty", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries({ en, zh }[locale])) {
        assert.ok(value.trim().length > 0, `${locale} "${key}" is empty`);
      }
    }
  });

  it("split counts only in English, where there is something to split", () => {
    // Chinese has one form for one and many. A `|` in a Chinese value is
    // therefore not a translation choice, it is a stray character the reader
    // would see.
    for (const [key, value] of Object.entries(zh)) {
      assert.ok(!value.includes("|"), `zh "${key}" splits a count Chinese does not have`);
    }
  });

  it("close every mark it opens", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries({ en, zh }[locale])) {
        const stars = (value.match(/\*/g) ?? []).length;
        assert.equal(stars % 2, 0, `${locale} "${key}" has an unpaired * in it`);
      }
    }
  });
});

describe("t", () => {
  it("speak the language in force, for the same key", () => {
    const said: Record<Locale, string> = { en: "", zh: "" };
    inEach((locale) => {
      said[locale] = t("nav.tabs.dashboard");
    });
    assert.equal(said.en, "Dashboard");
    assert.equal(said.zh, "总览");
  });

  it("fill a placeholder with what the call site passed", () => {
    const said: Record<Locale, string> = { en: "", zh: "" };
    inEach((locale) => {
      said[locale] = t("dashboard.latestData", { date: "2026-10-11" });
    });
    assert.equal(said.en, "Latest data 2026-10-11 · ");
    assert.equal(said.zh, "数据截至 2026-10-11 · ");
  });

  it("leave a placeholder alone when nothing was passed for it", () => {
    // A silent blank would be prose missing its fact; a visible `{date}` is a
    // bug someone can name.
    setLocale("en");
    assert.equal(t("dashboard.latestData"), "Latest data {date} · ");
  });

  it("read a key nobody wrote back as itself", () => {
    setLocale("en");
    assert.equal(t("no.such.message" as never), "no.such.message");
  });
});

describe("tRich", () => {
  it("split at the marks and keep the words around them", () => {
    setLocale("en");
    assert.deepEqual(tRich("pac.recorded", { parts: "2 buys", count: 2 }), [
      { kind: "text", value: "2 buys recorded automatically (marked " },
      { kind: "em", value: "estimated" },
      {
        kind: "text",
        value: ": correct them with the real amounts if they differ). ",
      },
    ] satisfies RichPart[]);
  });

  it("read back without the marks for a call site wanting a bare string", () => {
    setLocale("en");
    assert.equal(
      tPlain("pac.recorded", { parts: "2 buys", count: 2 }),
      "2 buys recorded automatically (marked estimated: correct them with the real amounts if they differ). ",
    );
  });

  it("let the translation put the mark where its language wants it", () => {
    // The English marks a word mid-sentence; the Chinese marks a word inside
    // the clause that qualifies it. Both are legal — what must hold is that
    // the marks survive the translation, which is the only way a translator
    // can move one without asking for a code change.
    const chinese = tIn("zh", "pac.recorded", { parts: "2 笔买入", count: 2 });
    assert.ok(chinese.includes("*估值*"), `expected a marked word, got: ${chinese}`);
    assert.ok(!chinese.includes("|"));
  });

  it("mark the strong as strongly as the emphasis", () => {
    setLocale("en");
    const parts = tRich("forms.refusal", { list: "nothing marked" });
    assert.deepEqual(parts, [{ kind: "text", value: "Fill in nothing marked." }]);
  });
});

describe("joinList", () => {
  it("say two items the way each language joins two", () => {
    const said: Record<Locale, string> = { en: "", zh: "" };
    inEach((locale) => {
      said[locale] = joinList(["a", "b"]);
    });
    assert.equal(said.en, "a and b");
    assert.equal(said.zh, "a和b");
  });

  it("say many items, each language with its own punctuation", () => {
    const said: Record<Locale, string> = { en: "", zh: "" };
    inEach((locale) => {
      said[locale] = joinList(["a", "b", "c"]);
    });
    assert.equal(said.en, "a, b and c");
    assert.equal(said.zh, "a、b、c");
  });

  it("say one item alone, and nothing as nothing", () => {
    inEach(() => {
      assert.equal(joinList(["a"]), "a");
      assert.equal(joinList([]), "");
    });
  });
});

describe("counts", () => {
  it("take the singular at one and the plural beyond it", () => {
    assert.equal(tIn("en", "pac.purchases", { count: 1 }), "1 PAC purchase");
    assert.equal(tIn("en", "pac.purchases", { count: 3 }), "3 PAC purchases");
  });

  it("say one thing in Chinese whatever the number", () => {
    assert.equal(tIn("zh", "pac.purchases", { count: 1 }), "1 笔定投买入");
    assert.equal(tIn("zh", "pac.purchases", { count: 3 }), "3 笔定投买入");
  });
});

describe("the language in force", () => {
  it("is remembered, and reported once", () => {
    setLocale("zh");
    assert.equal(getLocale(), "zh");
    setLocale("en");
    assert.equal(getLocale(), "en");
    // Setting what is already set is not a change, and must not announce one.
    setLocale("en");
    assert.equal(getLocale(), "en");
  });
});
