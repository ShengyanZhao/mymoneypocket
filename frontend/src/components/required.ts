/* What a form cannot be sent without, said once per form.

   Thirteen forms used to swallow a press on an empty field: the button
   worked, nothing was sent, and nothing was said. Five of them did it through
   one line in the shared list editor, eight in their own submit handlers. And
   no field anywhere said it was required, so the reader learned which ones
   were by pressing and watching nothing happen.

   One list per form now drives three things that used to be separate, or
   missing: the sentence a refused press says, `aria-required` on the field,
   and the question its empty box asks. They cannot disagree, because there is
   only one list to read. The API schemas' own required arrays were not used
   for this, deliberately: in four forms they do not match what the form
   actually refuses (a holding needs a value the schema leaves optional, a
   goal's schema requires the name its form calls optional), and a marker has
   to tell the reader what THIS form will refuse.

   A need names its words by KEY, never by sentence. The rule lists below are
   module-level constants, so a sentence written into them would be the
   sentence of whatever language was in force when the file was first loaded —
   a reader who switched language would keep reading the old one. `refusal` and
   `marks` look the words up when they are said, which is the moment the
   language is known.

   One import: the catalogue. Nothing DOM, so `npm test` reaches it. */

import { joinList, t, type MessageKey } from "../i18n/t.ts";

/** One field the form needs before it can send anything. */
export interface Need {
  /** The form's own name for the value, as passed to `refusal`. */
  key: string;
  /** How the shared sentence names it: "the name", "a ticker". */
  nounKey: MessageKey;
  /** The question its empty box asks. Left out for a select, whose first
      option already asks; for a date, which cannot show a placeholder; and
      for a currency box, 54px wide, where no question fits ("Currency?" is
      65px) and which opens filled in anyway. Every question here must fit
      its box with room to spare: tests/questionsFit.test.ts measures them
      against the font. */
  askKey?: MessageKey;
  /** A sentence of its own, for a field whose absence has a reason worth
      giving. Said on its own, and only once the plain ones are filled in. */
  saysKey?: MessageKey;
}

type Values = Record<string, string | number | null | undefined>;

function empty(v: string | number | null | undefined): boolean {
  return v == null || String(v).trim() === "";
}

/** The needs whose value is still empty, in the form's order. */
export function missing(needs: Need[], values: Values): Need[] {
  return needs.filter((n) => empty(values[n.key]));
}

/** What a refused press says, or null when nothing is missing.

    The plain needs are said together, in one sentence, because a reader
    filling a form should learn everything that is left at once. A need with a
    sentence of its own waits until the plain ones are in: those sentences were
    written to arrive when their field is the one thing left.

    The list is joined the way the language joins lists — English's final
    "and", Chinese's `、` — which is the one bit of grammar a catalogue value
    cannot carry, because it joins words that do not exist until now. */
export function refusal(needs: Need[], values: Values): string | null {
  const gone = missing(needs, values);
  const plain = gone.filter((n) => !n.saysKey);
  if (plain.length > 0) {
    return t("forms.refusal", { list: joinList(plain.map((n) => t(n.nounKey))) });
  }
  return gone.length > 0 ? t(gone[0].saysKey as MessageKey) : null;
}

/** The attributes that mark `key` as needed, to spread onto its control:
    `aria-required`, and the question its empty box asks. Nothing for a field
    this form does not need in its current state. */
export function marks(
  needs: Need[],
  key: string,
): { "aria-required"?: true; placeholder?: string } {
  const need = needs.find((n) => n.key === key);
  if (!need) return {};
  return need.askKey
    ? { "aria-required": true, placeholder: t(need.askKey) }
    : { "aria-required": true };
}

// --- The rules, one per form ------------------------------------------------

const NAME: Need = { key: "name", nounKey: "forms.noun.name", askKey: "forms.ask.name" };
const AMOUNT: Need = {
  key: "amount",
  nounKey: "forms.noun.amount",
  askKey: "forms.ask.amount",
};

export const INSTITUTION: Need[] = [
  { key: "name", nounKey: "forms.noun.name", askKey: "forms.ask.institution" },
];

export const INCOME: Need[] = [
  { key: "name", nounKey: "forms.noun.name", askKey: "forms.ask.income" },
  AMOUNT,
];
export const EXPENSE: Need[] = [
  { key: "name", nounKey: "forms.noun.name", askKey: "forms.ask.expense" },
  AMOUNT,
];

/** The dated series: a cash anchor, a valuation, a balance. `noun` and `ask`
    are the amount's, which is the one part that differs. */
export function dated(nounKey: MessageKey, askKey: MessageKey): Need[] {
  return [
    { key: "date", nounKey: "forms.noun.date" },
    { key: "amount", nounKey, askKey },
  ];
}

/** The three dated series. Their questions live here rather than at the
    call sites, so the fit test sees every question the forms can ask. */
export const CASH_ANCHOR = dated("forms.noun.cash", "forms.ask.cash");
export const VALUATION = dated("forms.noun.value", "forms.ask.value");
export const BALANCE = dated("forms.noun.balance", "forms.ask.balance");

export const REAL_ASSET: Need[] = [
  { key: "name", nounKey: "forms.noun.name", askKey: "forms.ask.realAsset" },
  {
    key: "currency",
    nounKey: "forms.noun.currency",
    saysKey: "forms.says.realAssetCurrency",
  },
];

export const DEBT: Need[] = [
  { key: "name", nounKey: "forms.noun.name", askKey: "forms.ask.debt" },
  {
    key: "currency",
    nounKey: "forms.noun.currency",
    saysKey: "forms.says.debtCurrency",
  },
];

/** A goal: the dropdown carries the meaning, so the free label is needed only
    for "other", where it IS the goal. */
export function goal(type: string): Need[] {
  // The spread is its own value, so it carries its own annotation: a
  // conditional inside an array literal has nothing to be typed against, and
  // widens every key in it to `string`.
  const free: Need[] =
    type === "other"
      ? [{ key: "name", nounKey: "forms.noun.goalName", askKey: "forms.ask.goalName" }]
      : [];
  return [
    { key: "type", nounKey: "forms.noun.goalType" },
    ...free,
    {
      key: "currency",
      nounKey: "forms.noun.currency",
      saysKey: "forms.says.goalCurrency",
    },
  ];
}

/** A transfer. Its source-or-destination is an either/or that no one field
    carries: `ends` is either of them, said as a sentence and marked on
    neither box. */
export const TRANSFER: Need[] = [
  { key: "date", nounKey: "forms.noun.date" },
  AMOUNT,
  {
    key: "ends",
    nounKey: "forms.noun.ends",
    saysKey: "forms.says.ends",
  },
  {
    key: "currency",
    nounKey: "forms.noun.currency",
    saysKey: "forms.says.currenciesMoved",
  },
  {
    key: "toCurrency",
    nounKey: "forms.noun.currency",
    saysKey: "forms.says.currenciesMoved",
  },
];

/** A PAC. At least one target needs a ticker; the first target's box carries
    the mark, since a second row left empty is simply ignored. Where each
    ticker is held is said by the form, per target, after these. */
export const PLAN: Need[] = [
  NAME,
  { key: "amount", nounKey: "forms.noun.budget", askKey: "forms.ask.budget" },
  { key: "ticker", nounKey: "forms.noun.ticker", askKey: "forms.ask.ticker" },
  {
    key: "sourceId",
    nounKey: "forms.noun.source",
    saysKey: "forms.says.source",
  },
];

/** A position in a situation: a total, or a quantity and a price. */
export function holding(mode: "total" | "qty"): Need[] {
  const priced: Need[] =
    mode === "qty"
      ? [
          {
            key: "quantity",
            nounKey: "forms.noun.quantity",
            askKey: "forms.ask.quantity",
          },
          {
            key: "unitPrice",
            nounKey: "forms.noun.price",
            askKey: "forms.ask.price",
          },
        ]
      : [{ key: "value", nounKey: "forms.noun.value", askKey: "forms.ask.worth" }];
  return [{ key: "name", nounKey: "forms.noun.name", askKey: "forms.ask.search" }, ...priced];
}

/** What a row that names no institution says, by what the row is doing. One
    key per kind rather than one sentence with the kind in it: the kind is a
    word, and a word inside a sentence is a word a translator has to be able
    to move, which is what a key is for. */
const HELD_AT: Record<string, MessageKey> = {
  buy: "forms.says.buyFrom",
  sell: "forms.says.sellHeldAt",
  dividend: "forms.says.dividendHeldAt",
  close: "forms.says.closeHeldAt",
};

/** A ledger row. A close needs what came back, and zero is an answer; a
    buy, a sell or a dividend needs what was traded and at what, where a
    dividend's price is what each share paid. */
export function transaction(kind: string, isClose: boolean): Need[] {
  const traded: Need[] = isClose
    ? [{ key: "fees", nounKey: "forms.noun.proceeds", askKey: "forms.ask.proceeds" }]
    : [
        { key: "symbol", nounKey: "forms.noun.theTicker", askKey: "forms.ask.ticker" },
        {
          key: "quantity",
          nounKey: "forms.noun.quantity",
          askKey: "forms.ask.quantity",
        },
        kind === "dividend"
          ? {
              key: "unitPrice",
              nounKey: "forms.noun.dividendPerShare",
              askKey: "forms.ask.perShare",
            }
          : {
              key: "unitPrice",
              nounKey: "forms.noun.price",
              askKey: "forms.ask.price",
            },
      ];
  const priceIn: Need[] = isClose
    ? []
    : [
        {
          key: "priceCurrency",
          nounKey: "forms.noun.currency",
          saysKey: "forms.says.currenciesTraded",
        },
      ];
  return [
    { key: "assetName", nounKey: "forms.noun.asset", askKey: "forms.ask.search" },
    ...traded,
    {
      key: "institutionId",
      nounKey: "forms.noun.institution",
      saysKey: HELD_AT[kind] ?? "forms.says.closeHeldAt",
    },
    {
      key: "currency",
      nounKey: "forms.noun.currency",
      saysKey: "forms.says.currenciesTraded",
    },
    ...priceIn,
  ];
}
