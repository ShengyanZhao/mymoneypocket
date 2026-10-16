/* How the Profile form says the backend's questions in the reader's language
   without changing what it stores.

   `GET /api/survey/questions` returns English `text`, `topic`, `options` and
   `explain_when.text`, and a stored answer is compared against those English
   option strings — "2–5 years" is an answer only while the option reads that.
   So the words SHOWN here are looked up by key, while every value SENT BACK
   stays the English the backend sent. An unknown string falls back to itself:
   the backend's English is better at the reader than a raw key.

   The keys, one family each:
     survey.q.<question key>       the question text (the backend's own key)
     survey.topic.<slug>           a topic heading (mapped below: the topic is
                                   an English phrase with nothing stable in it)
     survey.opt.<slug>             an option, or a yes/no/unsure button
     survey.explain.<question key> the explain_when paragraph

   `tOpt` rather than `t` on purpose: a question the catalogue has not named
   yet is a question the form can still ask, in the backend's English. */

import { tOpt } from "../i18n/t.ts";
import type { SurveyQuestion } from "../api/survey.ts";

/** Topics come as English words. Slugs are stable; the English is the map. */
const TOPIC_KEY: Record<string, string> = {
  "About you": "survey.topic.about",
  "Financial literacy": "survey.topic.financial_literacy",
  Family: "survey.topic.family",
  "Housing & city": "survey.topic.housing",
  "Career & income": "survey.topic.career",
  "Major purchases": "survey.topic.purchases",
  "Retirement & horizon": "survey.topic.retirement",
  "Risk & values": "survey.topic.risk",
  "In your words": "survey.topic.words",
  Lifestyle: "survey.topic.lifestyle",
};

/** The options, and the yes/no/unsure buttons, as the backend spells them.
    "Other" appears under two questions and is one word in both. */
const OPTION_KEY: Record<string, string> = {
  yes: "survey.opt.yes",
  no: "survey.opt.no",
  unsure: "survey.opt.unsure",
  Employee: "survey.opt.employee",
  "Self-employed": "survey.opt.selfEmployed",
  "Business owner": "survey.opt.businessOwner",
  Student: "survey.opt.student",
  Retired: "survey.opt.retired",
  "Not working": "survey.opt.notWorking",
  Single: "survey.opt.single",
  Couple: "survey.opt.couple",
  "Family with children": "survey.opt.familyChildren",
  Other: "survey.opt.other",
  Rent: "survey.opt.rent",
  "Own (with mortgage)": "survey.opt.ownMortgage",
  "Own (outright)": "survey.opt.ownOutright",
  "Live with family": "survey.opt.liveWithFamily",
  "< 2 years": "survey.opt.under2years",
  "2–5 years": "survey.opt.twoToFiveYears",
  "> 5 years": "survey.opt.over5years",
  Low: "survey.opt.low",
  Medium: "survey.opt.medium",
  High: "survey.opt.high",
  "A certain loss of 500 ¥": "survey.opt.certainLoss500",
  "A 50/50 gamble: lose 1000 ¥ or lose nothing": "survey.opt.gamble1000",
};

function lookedUp(key: string | undefined, fallback: string): string {
  return (key && tOpt(key)) ?? fallback;
}

/** The heading a topic is listed under. */
export function topicWords(topic: string): string {
  return lookedUp(TOPIC_KEY[topic], topic);
}

/** The question, as the form asks it. */
export function questionWords(q: SurveyQuestion): string {
  return lookedUp(`survey.q.${q.key}`, q.text);
}

/** One option, or one yes/no/unsure button, as the form shows it. The VALUE
    behind the button is still the English `opt`: that is what is stored. */
export function optionWords(opt: string): string {
  return lookedUp(OPTION_KEY[opt], opt);
}

/** The paragraph shown when a question's answer is the one it explains, or
    null when the question explains nothing. */
export function explainWords(q: SurveyQuestion): string | null {
  if (!q.explain_when) return null;
  return lookedUp(`survey.explain.${q.key}`, q.explain_when.text);
}
