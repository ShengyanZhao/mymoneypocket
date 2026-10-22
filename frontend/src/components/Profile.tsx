import { useEffect, useState } from "react";
import {
  getSurvey,
  getSurveyQuestions,
  saveSurvey,
  type SurveyAnswer,
  type SurveyQuestion,
} from "../api/survey";
import {
  getTaxSettings,
  saveTaxSettings,
  type TaxCountryDefault,
  type TaxSettingsRead,
} from "../api/tax";
import { getBaseCurrency, saveBaseCurrency, type BaseCurrencySetting } from "../api/baseCurrency";
import { getMembers, type Member } from "../api/members";
import { getGains, setGains } from "../gains";
import MembersSection from "./MembersSection";
import { choicesOf, isVisible, topicsOf, unshownAnswer } from "./questionnaire";
import { askedAs, othersOf, toSave } from "./profileAnswers";
import { explainWords, optionWords, questionWords, topicWords } from "./surveyText";
import { apiError, btnClass, cardClass, inputClass } from "./ui";
import { useT } from "../i18n/index.ts";

/* The questions are the backend's (`GET /api/survey/questions`, app/questionnaire.py):
   the chat's answers to them are checked against the same list, so the two
   cannot disagree about what a question takes. Booleans store "yes"/"no" (or
   "unsure" when allowed). The keys in that list are the ones this form is
   authoritative for; everything else stored under /api/survey belongs to
   somebody else, today the chat, which can write an answer to a question this
   list never asked, because the analyses declare what they do not know about
   you and a form cannot ask that in advance. */

export default function Profile() {
  const tr = useT();
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /* Answers stored under keys this form does not ask, posted back with every
     Save. PUT /api/survey replaces the WHOLE set (it deletes what its payload
     does not name), which is correct for a caller that reads
     everything and writes everything back, and is only correct while this form
     IS that caller. Without this, pressing Save here would silently delete
     every question the chat had recorded in conversation. Shown since brief AN
     (`OtherAnswers`), each changed or deleted here (`profileAnswers.ts`). */
  const [carried, setCarried] = useState<SurveyAnswer[]>([]);
  // The ones deleted here and not saved yet, said under the list with a way back.
  const [dropped, setDropped] = useState<SurveyAnswer[]>([]);
  /* The tax settings are a different resource from the questionnaire — three
     keys in `settings`, not survey answers — but they share this page's ONE
     save button on purpose. Two save buttons on one screen is how an edit gets
     lost: you change a rate, press the button you can see, and the rate never
     left the browser. */
  const [tax, setTax] = useState<TaxSettingsRead | null>(null);
  /* Held as strings, so "" can mean cleared. A number input bound to a number
     cannot express "I have not said" — it collapses to 0, which is the reader
     claiming they pay no tax. */
  const [taxCountry, setTaxCountry] = useState("");
  const [cgRate, setCgRate] = useState("");
  const [divRate, setDivRate] = useState("");
  /* The declared dividend schedule (China's 20%/10%/免征 by holding period),
     adopted from a shipped default by pressing it: one box cannot hold three
     numbers, so the schedule travels as data. A flat rate typed beside it
     still wins, which is why the two live together happily. */
  const [divTiers, setDivTiers] = useState<NonNullable<TaxSettingsRead["dividend_tiers"]> | null>(
    null,
  );
  /* The base, as stored and as picked. Saved with the same button, for the
     reason written above; sent only when it changed, because changing it is
     the one save here that asks the rate feed for something. */
  const [base, setBase] = useState<BaseCurrencySetting | null>(null);
  const [pickedBase, setPickedBase] = useState("");
  // The household (PRD v3 §4.1). Edited by its own section and re-read on its
  // own: adding someone is a fact, not a pending change behind the Save below.
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [asked, existing, taxes, currentBase, memberList] = await Promise.all([
        getSurveyQuestions(),
        getSurvey(),
        getTaxSettings(),
        getBaseCurrency(),
        getMembers(),
      ]);
      setMembers(memberList);
      setQuestions(asked);
      setBase(currentBase);
      setPickedBase(currentBase.base_currency);
      setTax(taxes);
      setTaxCountry(taxes.country ?? "");
      setCgRate(taxes.capital_gains_rate?.toString() ?? "");
      setDivRate(taxes.dividend_withholding_rate?.toString() ?? "");
      setDivTiers(taxes.dividend_tiers ?? null);
      const map: Record<string, string> = {};
      for (const a of existing) if (a.answer != null) map[a.question_key] = a.answer;
      setAnswers(map);
      setCarried(othersOf(asked, existing));
      setDropped([]);
    } catch (err) {
      setError(apiError(err, tr("common.backendDown")));
    } finally {
      setLoading(false);
    }
  }

  function setAnswer(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveSurvey(toSave(questions, answers, carried));
      // What the save kept: an answer emptied in its box went with it.
      setCarried((kept) => kept.filter((a) => (a.answer ?? "").trim() !== ""));
      setDropped([]);
      // An empty field CLEARS the key rather than storing 0. The backend
      // deletes it, so "not said" has one representation instead of three
      // that look identical on screen.
      setTax(
        await saveTaxSettings({
          country: taxCountry.trim() || null,
          capital_gains_rate: cgRate === "" ? null : Number(cgRate),
          dividend_withholding_rate: divRate === "" ? null : Number(divRate),
          dividend_tiers: divTiers,
        }),
      );
      // Last, so a feed that does not answer leaves everything above saved and
      // says, in the backend's own words, that the base did not change.
      if (base && pickedBase !== base.base_currency) {
        setBase(await saveBaseCurrency(pickedBase));
      }
      setSaved(true);
    } catch (err) {
      setError(apiError(err, tr("common.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-ink-soft">{tr("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">{tr("profile.title")}</h2>
        <p className="text-sm text-ink-soft">{tr("profile.intro")}</p>
      </div>

      {error && <p className="text-bad">{error}</p>}

      {topicsOf(questions).map((topic) => {
        const qs = questions.filter((q) => q.topic === topic && isVisible(q, answers));
        if (qs.length === 0) return null;
        return (
          <section key={topic} className={cardClass + " space-y-4 p-5"}>
            <h3 className="text-sm font-semibold text-ink">{topicWords(topic)}</h3>
            {qs.map((q) => (
              <QuestionField
                key={q.key}
                q={q}
                value={answers[q.key] ?? ""}
                onChange={(v) => setAnswer(q.key, v)}
              />
            ))}
          </section>
        );
      })}

      <OtherAnswers
        answers={carried}
        dropped={dropped}
        onChange={(key, value) => {
          setSaved(false);
          setCarried((all) => all.map((a) => (a.question_key === key ? { ...a, answer: value } : a)));
        }}
        onDelete={(key) => {
          setSaved(false);
          const gone = carried.find((a) => a.question_key === key);
          setCarried((all) => all.filter((a) => a.question_key !== key));
          if (gone) setDropped((all) => [...all, gone]);
        }}
        onRestore={(key) => {
          const back = dropped.find((a) => a.question_key === key);
          setDropped((all) => all.filter((a) => a.question_key !== key));
          if (back) setCarried((all) => [...all, back]);
        }}
      />

      <TaxSection
        known={tax?.known_countries ?? []}
        country={taxCountry}
        capitalGains={cgRate}
        dividends={divRate}
        onChange={(field, value) => {
          setSaved(false);
          if (field === "country") setTaxCountry(value);
          else if (field === "cg") setCgRate(value);
          else setDivRate(value);
        }}
        onUseDefault={(d) => {
          setSaved(false);
          setCgRate(d.capital_gains_rate.toString());
          // A country whose dividend rate is not one number (China's schedule)
          // ships none — its box comes back EMPTY, and the schedule beside it
          // is what the estimate will use.
          setDivRate(d.dividend_withholding_rate?.toString() ?? "");
          setDivTiers(d.dividend_tiers ?? null);
        }}
      />

      <BaseCurrencySection
        current={base?.base_currency ?? ""}
        available={base?.available ?? []}
        picked={pickedBase}
        onPick={(code) => {
          setSaved(false);
          setPickedBase(code);
        }}
      />

      <GainsSection />

      <MembersSection
        members={members}
        onChanged={() => {
          void getMembers()
            .then(setMembers)
            .catch((err) => setError(apiError(err, tr("common.backendDown"))));
        }}
      />

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className={btnClass}>
          {saving ? tr("profile.saving") : tr("profile.save")}
        </button>
        {saved && <span className="text-sm text-good">{tr("profile.saved")}</span>}
      </div>
    </div>
  );
}

/* The answers on record to questions this form does not ask (brief AN).

   The chat records them, and the chat and the analyses read them like every
   other answer, so the reader is owed seeing them and correcting them where
   they correct the rest: each in a box of its own, a delete beside it, all
   saved with the page's one button. A deleted one stays listed under the
   others until the save, with a way back. */
function OtherAnswers({
  answers,
  dropped,
  onChange,
  onDelete,
  onRestore,
}: {
  answers: SurveyAnswer[];
  dropped: SurveyAnswer[];
  onChange: (key: string, value: string) => void;
  onDelete: (key: string) => void;
  onRestore: (key: string) => void;
}) {
  const tr = useT();
  if (answers.length === 0 && dropped.length === 0) return null;
  return (
    <section className={cardClass + " space-y-4 p-5"}>
      <div>
        <h3 className="text-sm font-semibold text-ink">{tr("profile.otherTitle")}</h3>
        <p className="mt-1 text-sm text-ink-soft">{tr("profile.otherIntro")}</p>
      </div>
      {answers.map((a) => (
        <div key={a.question_key} className="space-y-1">
          <label className="block text-sm text-ink" htmlFor={`other-${a.question_key}`}>
            {askedAs(a)}
            {a.topic && <span className="ml-2 text-xs text-ink-faint">{topicWords(a.topic)}</span>}
          </label>
          <div className="flex items-start gap-2">
            <textarea
              id={`other-${a.question_key}`}
              className={inputClass + " min-h-16 w-full"}
              value={a.answer ?? ""}
              onChange={(e) => onChange(a.question_key, e.target.value)}
            />
            <button
              type="button"
              onClick={() => onDelete(a.question_key)}
              className="shrink-0 rounded-sm px-3 py-2 text-sm text-ink-soft transition hover:text-bad"
            >
              {tr("common.delete")}
            </button>
          </div>
        </div>
      ))}
      {dropped.length > 0 && (
        <div className="text-xs text-warn">
          <p>{tr("profile.deletedWhenSave")}</p>
          <ul className="mt-1 space-y-1">
            {dropped.map((a) => (
              <li key={a.question_key}>
                {askedAs(a)}{" "}
                <button
                  type="button"
                  onClick={() => onRestore(a.question_key)}
                  className="text-brand underline-offset-2 hover:underline"
                >
                  {tr("profile.keepIt")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* The currency every total is shown in.

   What the reader has to know before changing it is what moves and what does
   not. Every total moves — the net worth, the history, every converted figure —
   because it is the same wealth measured in another unit, at the reference rate of
   each figure's own day. Nothing recorded moves: an amount keeps the currency
   it was typed in, and a sum fixed on its day stays what it was. The choices
   are the currencies the feed publishes, because a total can only be converted
   into one somebody publishes a rate for. */
function BaseCurrencySection({
  current,
  available,
  picked,
  onPick,
}: {
  current: string;
  available: string[];
  picked: string;
  onPick: (code: string) => void;
}) {
  const tr = useT();
  return (
    <section className={cardClass + " space-y-3 p-5"}>
      <h3 className="text-sm font-semibold text-ink">{tr("profile.baseTitle")}</h3>
      <p className="text-sm text-ink-soft">{tr("profile.baseHelp")}</p>
      <label className="flex items-center gap-2 text-sm text-ink">
        {tr("profile.baseShowIn")}
        <select
          className={inputClass + " w-28"}
          value={picked}
          onChange={(e) => onPick(e.target.value)}
        >
          {available.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      {picked !== current && (
        <p className="text-xs text-warn">
          {tr("profile.baseSwitch", { current, picked })}
        </p>
      )}
      {available.length <= 1 && (
        <p className="text-xs text-ink-faint">
          {tr("profile.baseOnlyOne", { current })}
        </p>
      )}
    </section>
  );
}

/* 涨跌配色: which way gains and losses are coloured. It commits on press —
   like the language toggle, and unlike the rest of this page: a preference
   about colour has nothing to save, and waiting behind the page's one button
   would only hide the effect being chosen. The preview beside each option
   carries its own `data-gains`, so it shows THAT option's colours even while
   the other one is in force. */
function GainsSection() {
  const tr = useT();
  const [gains, setGainsState] = useState(getGains());
  return (
    <section className={cardClass + " space-y-3 p-5"}>
      <h3 className="text-sm font-semibold text-ink">{tr("profile.gainsTitle")}</h3>
      <p className="text-sm text-ink-soft">{tr("profile.gainsHelp")}</p>
      <div role="group" aria-label={tr("profile.gainsTitle")} className="flex flex-wrap gap-2">
        {(["cn", "west"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              setGains(g);
              setGainsState(g);
            }}
            aria-pressed={gains === g}
            className={
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition " +
              (gains === g ? "border-brand text-brand" : "border-rule text-ink-soft hover:text-ink")
            }
          >
            <span data-gains={g} className="tnum text-xs">
              <span className="text-up">+1.2%</span>{" "}
              <span className="text-down">−1.2%</span>
            </span>
            {tr(g === "cn" ? "profile.gainsCn" : "profile.gainsWest")}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-faint">{tr("profile.gainsNote")}</p>
    </section>
  );
}

/* WHAT THIS SECTION IS FOR, AND WHAT IT REFUSES TO BE.

   Two rates and a country name. That is the whole tax model, and keeping it
   that small is the feature rather than a shortcut: a real engine for Italy
   alone would need the 12.5% government-bond rate, harmonised versus
   non-harmonised funds, a four-year loss basket and the rest of it, and the
   way that project fails is by being PRECISE AND WRONG. A reader told
   "roughly 26%, and it says estimated" checks it against their broker. A
   reader shown a confident number does not.

   The country is a LABEL and a seed, never a gate. Nothing downstream branches
   on it: the two rates are what every reader of this figure actually reads, so
   someone whose country this app ships nothing for types their own two numbers
   and gets the identical estimate. Being listed buys a pre-fill and nothing
   else — which is the point, because a rate you looked up this year beats any
   table shipped with an app. France's moved 1.4 points in January. */
function TaxSection({
  known,
  country,
  capitalGains,
  dividends,
  onChange,
  onUseDefault,
}: {
  known: TaxCountryDefault[];
  country: string;
  capitalGains: string;
  dividends: string;
  onChange: (field: "country" | "cg" | "div", value: string) => void;
  onUseDefault: (d: TaxCountryDefault) => void;
}) {
  const tr = useT();
  const match = known.find(
    (d) => d.country.toLowerCase() === country.trim().toLowerCase(),
  );
  const nothingSet = capitalGains === "" && dividends === "";

  return (
    <section className={cardClass + " space-y-4 p-5"}>
      <div>
        <h3 className="text-sm font-semibold text-ink">{tr("profile.taxTitle")}</h3>
        <p className="mt-1 text-sm text-ink-soft">{tr("profile.taxHelp")}</p>
      </div>

      <div>
        <label className="mb-1 block text-sm text-ink">
          {tr("profile.taxCountryLabel")}
        </label>
        <input
          className={inputClass + " w-full"}
          type="text"
          list="tax-countries"
          placeholder={tr("profile.taxCountryPlaceholder")}
          value={country}
          onChange={(e) => onChange("country", e.target.value)}
        />
        <datalist id="tax-countries">
          {known.map((d) => (
            <option key={d.country} value={d.country} />
          ))}
        </datalist>
      </div>

      {match && (
        <div className="rounded-sm bg-tint p-3 text-sm">
          <p className="text-ink">
            {tr("profile.taxMatch", {
              country: match.country,
              regime: match.regime,
              cg: match.capital_gains_rate,
              div: match.dividend_withholding_rate,
            })}
          </p>
          {/* Offered, never applied on its own. A figure that changed itself
              because a text field changed is a figure nobody declared, and the
              reader cannot tell it apart from one they typed. */}
          <p className="mt-1 text-ink-faint">{match.omits}</p>
          <button
            type="button"
            onClick={() => onUseDefault(match)}
            className="mt-2 rounded-sm border border-brand px-3 py-1.5 text-sm text-brand-deep transition hover:bg-brand-tint"
          >
            {tr("profile.taxUseThese")}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-6">
        <RateField
          label={tr("profile.taxCgLabel")}
          hint={tr("profile.taxCgHint")}
          value={capitalGains}
          onChange={(v) => onChange("cg", v)}
        />
        <RateField
          label={tr("profile.taxDivLabel")}
          hint={tr("profile.taxDivHint")}
          value={dividends}
          onChange={(v) => onChange("div", v)}
        />
      </div>

      {nothingSet && (
        <p className="text-sm text-ink-faint">{tr("profile.taxNothingSet")}</p>
      )}
    </section>
  );
}

function RateField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const tr = useT();
  return (
    <div>
      <label className="mb-1 block text-sm text-ink">{label}</label>
      <div className="flex items-center gap-2">
        <input
          className={inputClass + " w-28"}
          type="number"
          min={0}
          max={100}
          step="0.001"
          placeholder={tr("profile.rateNotSet")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-sm text-ink-soft">%</span>
      </div>
      <p className="mt-1 text-xs text-ink-faint">{hint}</p>
    </div>
  );
}

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: SurveyQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const tr = useT();
  // An answer on record that no button, option or number box can show: written
  // before the chat's answers were checked against the question (brief AL).
  const unshown = unshownAnswer(q, value);
  // The label and the buttons say the words in this language; `onChange` still
  // receives the English the backend sent and the store compares against.
  return (
    <div>
      <label className="mb-1 block text-sm text-ink">{questionWords(q)}</label>

      {q.type === "boolean" ? (
        <div className="flex gap-2">
          {choicesOf(q).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={
                "rounded-sm border px-3 py-1.5 text-sm capitalize transition " +
                (value === opt
                  ? "border-brand bg-brand-tint text-brand-deep"
                  : "border-rule text-ink-soft hover:bg-ground")
              }
            >
              {optionWords(opt)}
            </button>
          ))}
        </div>
      ) : q.type === "single" ? (
        <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{tr("profile.choose")}</option>
          {q.options.map((o) => (
            <option key={o} value={o}>
              {optionWords(o)}
            </option>
          ))}
        </select>
      ) : q.type === "number" ? (
        <input
          className={inputClass + " w-32"}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : q.type === "longtext" ? (
        <textarea
          className={inputClass + " min-h-40 w-full leading-relaxed"}
          rows={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={inputClass + " w-full"}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {unshown && <p className="mt-2 text-sm text-warn">{unshown}</p>}

      {q.explain_when && value === q.explain_when.equals && (
        <p className="mt-2 rounded-sm bg-warn-tint p-3 text-sm text-warn">
          {explainWords(q)}
        </p>
      )}
    </div>
  );
}
