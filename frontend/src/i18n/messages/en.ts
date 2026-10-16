/* The English message catalogue: the source of truth for every key.

   FLAT keys, dotted, grouped by where the words are read rather than by which
   component renders them: `nav.*` is the way around the app, `forms.*` is what
   an empty box asks, `errors.*` is what a failed request says. A flat map is
   deliberate over a nested one — `keyof typeof en` then names every message
   exactly once, so `zh.ts` is checked against it by the compiler and a typo
   cannot survive a build.

   Two marks are reserved inside values, and only `tRich` reads them:
     *emphasis*   -> <em>
     **strong**   -> <strong>
   They let a translated sentence put the marked word where its language wants
   it, instead of the code slicing a sentence around JSX. `t` strips them.

   A `|` splits one/two of a count: `"1 thing|2 things"`. `t`/`tRich` pick by
   `params.count`. Chinese has no such distinction and simply writes one form,
   which is why the split lives in the value rather than in the key name.

   Placeholders are `{name}`. Every placeholder in an English value must appear
   in the translation of the same key — `tests/i18n.test.ts` enforces it, so a
   reordering in Chinese cannot silently drop a number the sentence is about. */

import { portfolioEn } from "./staging/portfolio.en.ts";
import { profileEn } from "./staging/profile.en.ts";
import { recordsEn } from "./staging/records.en.ts";

export const en = {
  // --- shared words, said in many places ---------------------------------
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.add": "Add",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.loading": "Loading…",
  "common.dismiss": "Dismiss",
  "common.refreshPrice": "Refresh price",
  "common.refreshPriceTitle": "Refresh price from the market",
  "common.saveFailed": "Save failed.",
  "common.backendDown": "The backend did not answer. Is it running on :8000?",
  "common.na": "n/a",

  // --- the way around -----------------------------------------------------
  "nav.tabs.dashboard": "Dashboard",
  "nav.tabs.portfolio": "Portfolio",
  "nav.tabs.records": "Records",
  "nav.tabs.profile": "Profile",
  "nav.pages.wealth": "Wealth",
  "nav.pages.real": "Real assets",
  "nav.pages.debts": "Debts",
  "nav.pages.cash": "Cash flow",

  // --- the chat rail, and the language toggle beside it --------------------
  "chat.rail.open": "Open the chat",
  "chat.rail.close": "Close the chat",
  "chat.rail.ask": "Ask Aurelio",
  "chat.rail.askTitle": "Ask Aurelio about your finances",
  "lang.label": "Language",
  "lang.en": "EN",
  "lang.zh": "中文",
  "currency.label": "Currency",
  "currency.failed": "Could not change the currency.",

  // --- the catch-up banner -------------------------------------------------
  "pac.purchases": "{count} PAC purchase|{count} PAC purchases",
  "pac.dividends": "{count} dividend|{count} dividends",
  "pac.joined": "{parts}",
  "pac.recorded":
    "{parts} recorded automatically (marked *estimated*: correct them with the real amounts if they differ). ",
  "pac.review": "Review in Portfolio",
  "pac.skipped":
    "{count} occurrence skipped ({reason}{more}). Will retry at next start.|{count} occurrences skipped ({reason}{more}). Will retry at next start.",

  // --- what a form refuses to send without ---------------------------------
  "forms.listTwo": "{a} and {b}",
  "forms.listMany": "{head} and {last}",
  "forms.refusal": "Fill in {list}.",
  "forms.noun.name": "the name",
  "forms.noun.amount": "the amount",
  "forms.noun.date": "the date",
  "forms.noun.currency": "the currency",
  "forms.noun.ticker": "a ticker",
  "forms.noun.theTicker": "the ticker",
  "forms.noun.ends": "a source or a destination",
  "forms.noun.goalType": "what the goal is for",
  "forms.noun.goalName": "what the goal is",
  "forms.noun.cash": "the cash",
  "forms.noun.value": "the value",
  "forms.noun.balance": "the balance",
  "forms.noun.budget": "the budget",
  "forms.noun.source": "the account it is funded from",
  "forms.noun.quantity": "the quantity",
  "forms.noun.price": "the price",
  "forms.noun.asset": "the asset",
  "forms.noun.institution": "the institution",
  "forms.noun.proceeds": "the proceeds",
  "forms.noun.dividendPerShare": "the dividend per share",
  "forms.ask.institution": "Which bank or broker?",
  "forms.ask.name": "What is it called?",
  "forms.ask.income": "What is it? e.g. Salary",
  "forms.ask.expense": "What is it? e.g. Rent",
  "forms.ask.amount": "How much?",
  "forms.ask.realAsset": "What is it? e.g. Milan flat",
  "forms.ask.debt": "What is it? e.g. Car loan",
  "forms.ask.goalName": "What is the goal?",
  "forms.ask.cash": "How much?",
  "forms.ask.value": "What is it worth?",
  "forms.ask.balance": "How much is left?",
  "forms.ask.budget": "How much?",
  "forms.ask.ticker": "Which ticker?",
  "forms.ask.search": "What is it? (type to search)",
  "forms.ask.quantity": "Units?",
  "forms.ask.price": "Price?",
  "forms.ask.worth": "Worth?",
  "forms.ask.proceeds": "Proceeds?",
  "forms.ask.perShare": "Per share?",
  "forms.says.realAssetCurrency": "Say which currency this asset is valued in.",
  "forms.says.debtCurrency": "Say which currency this debt is in.",
  "forms.says.goalCurrency": "Say which currency this goal is in.",
  "forms.says.ends": "Pick a source and/or a destination institution.",
  "forms.says.currenciesMoved":
    "Say which currencies these are: what left the source, and what the destination was credited in.",
  "forms.says.currenciesTraded":
    "Say which currencies these are: the price's, and the account's the money moved in.",
  "forms.says.source":
    "A plan has to take the money from somewhere: name the account it is funded from, so each contribution leaves a real balance.",
  "forms.says.buyFrom":
    "A buy has to come from somewhere: pick where you keep it, so the cash leaves the right account.",
  "forms.says.sellHeldAt":
    "A sell has to say where it is held: pick the institution, so the cash reaches the right account.",
  "forms.says.dividendHeldAt":
    "A dividend has to say where it is held: pick the institution, so the cash reaches the right account.",
  "forms.says.closeHeldAt":
    "A close has to say where it is held: pick the institution, so the cash reaches the right account.",

  // --- the shared question behind one figure -------------------------------
  "ui.savingsRate.question": "What is the savings rate?",
  "ui.savingsRate.text": "Share of monthly income left after expenses.",

  // --- what the monthly figures leave out ---------------------------------
  "inForce.intro": "In force today, as a monthly run-rate; one-off items excluded.",
  "inForce.incomes": "{count} income|{count} incomes",
  "inForce.expenses": "{count} expense|{count} expenses",
  "inForce.startsLater": "{nouns} that starts later|{nouns} that start later",
  "inForce.hasEnded": "{nouns} that has ended|{nouns} that have ended",
  "inForce.join": "{a}, {b}",
  "inForce.notCounted": "Not counted: {what}, as Records → Cash flow shows.",
  "inForce.undated":
    "{count} flow with no first payment date is counted as in force.|{count} flows with no first payment date are counted as in force.",
  "inForce.onceOn": "On {date}, once: not in the monthly figures.",
  "inForce.startsOn": "Starts on {date}: not counted until then.",
  "inForce.endedOn": "Ended on {date}: no longer counted.",

  // --- the dashboard ------------------------------------------------------
  "dashboard.loadError": "Could not load the dashboard. Is the backend running on :8000?",
  "dashboard.netWorth": "Net worth",
  "dashboard.sinceUp": "+{amount} since {date}",
  "dashboard.sinceDown": "−{amount} since {date}",
  "dashboard.latestData": "Latest data {date} · ",
  "dashboard.counts":
    "{institutions} institutions · {realAssets} real assets · {debts} debts",
  "dashboard.investments": "Investments",
  "dashboard.cash": "Cash",
  "dashboard.realAssets": "Real assets",
  "dashboard.debts": "Debts",
  "dashboard.carriedNote":
    "{amount} of this is carried over from the last situation, not priced",
  "dashboard.emptyTitle": "Nothing to show yet",
  "dashboard.emptyBody":
    "Start in Records → Wealth with an institution and a dated situation. The charts on this page are drawn from what you record there, and from nothing else.",
  "dashboard.netWorthOverTime": "Net worth over time",
  "dashboard.netWorthOverTimeSub":
    "Hover for the financial / real / debt breakdown behind each point.",
  "dashboard.date": "Date",
  "dashboard.financial": "Financial",
  "dashboard.real": "Real",
  "dashboard.allocation": "Allocation",
  "dashboard.allocationSub": "{total} across {count} class|{total} across {count} classes",
  "dashboard.class": "Class",
  "dashboard.value": "Value",
  "dashboard.share": "Share",
  "dashboard.monthlyCashFlow": "Monthly cash flow",
  "dashboard.income": "Income",
  "dashboard.expenses": "Expenses",
  "dashboard.net": "Net",
  "dashboard.cashBreakdown":
    "Income: active {active} · passive {passive}. Expenses: essential {essential} · discretionary {discretionary}. ",
  "dashboard.notCounted": "Not counted: {what}, as Records → Cash flow shows.",
  "dashboard.chart": "Chart",
  "dashboard.table": "Table",
  "dashboard.savingsRate": "Savings rate",
  "dashboard.savingsRateNone": "Not enough data yet.",
  "dashboard.savingsRateDown": "spending more than you earn",
  "dashboard.savingsRateThin": "thin margin",
  "dashboard.savingsRateHealthy": "healthy",

  // --- the first date of something that repeats (firstDate.ts) -------------
  "firstDate.pastOne": "a buy into your records, dated {date}",
  "firstDate.pastMany": "{count} buys into your records, dated from {first} to {last}",
  "firstDate.leadChanged": "This change adds dates before today.",
  "firstDate.leadPast": "{start} is in the past.",
  "firstDate.body":
    "Saved like this, the app writes {what}, priced at Yahoo's close rather than at your broker's fills, and marked estimated.",
  "firstDate.alternative":
    "Already running at your broker? Then let everything up to today be the broker's: start the plan on its next date, and enter today's units and cash from its statement on the account's page.",
  "firstDate.startOn": "Start on {date}",
  "firstDate.startsLine":
    "Starts {date}. Once it is saved, enter today's units and cash from the broker's statement on the account's page.",
  "firstDate.afterSave":
    "{name} starts on {start}. Record today's situation and cash balance from the broker's statement (start the situation from the last one, so the other positions stay):",
  "firstDate.flowFirst": "first payment",
  "firstDate.paymentNote":
    "The first payment's day is the day it repeats on. A past date is safe: payments before the account's latest balance are already in it.",
  "firstDate.planDate": "first buy",
  "firstDate.planNote":
    "Each date's buy is written the first time the app opens after that day, at its market close (converted at that day's reference rate when the fund trades in another currency), and marked estimated.",

  // --- a date and an amount, one row per date (DatedAmountEditor) ---------
  "dated.noun.cashAnchor": "cash anchor",
  "dated.noun.balance": "balance",
  "dated.noun.valuation": "valuation",
  "dated.confirmDelete": "Delete the {noun} of {date}?",
  "dated.saveError": "Save failed (a {noun} for that date may already exist).",
  "dated.date": "Date",
  "dated.currencyPlaceholder": "currency",
  "dated.currencyTitle":
    "The currency this amount is in. Proposed from the anchor in force on this date; change it and it stays as you typed it.",
  "dated.noAnswer": "no answer came.",

  // --- value a situation dropped (OmissionsNotice) ------------------------
  "omitted.title":
    "A newer situation stopped accounting for these, so their value left the totals and nothing on record says where it went. Selling is a dated statement with proceeds; forgetting is the absence of one.",
  "omitted.lead": "**{total}** left the totals with nothing saying where it went ·",
  "omitted.unitsOf": "{units} units of {name}",
  "omitted.lastSeen": "last seen {date}",
  "omitted.lastSeenBetween": "last seen between {first} and {last}",
  "omitted.nameSeen": "{name}, last seen {date}",
  "omitted.arrived":
    "was declared in the same situation under a name the app did not know|was declared in the same situations under names the app did not know",
  "omitted.declaredOn": "{name}, declared {date}",
  "omitted.sameHoldings": "Same holdings, written out?",
  "omitted.footer": "Sold → record a **close**{where}. Dropped by mistake → put it back.",
  "omitted.inPortfolio": " in Portfolio",

  // --- amounts no rate could reach (UnconvertedNotice) --------------------
  "unconverted.title":
    "No exchange rate is known for these currencies, so each amount written in one of them is counted at face value, as if it were already in the base currency. The figures above are therefore in more than one unit.",
  "unconverted.amounts": "{count} amount in {currency}|{count} amounts in {currency}",
  "unconverted.noCurrency": "no stated currency",
  "unconverted.asWritten": "{amount} as written",
  "unconverted.rate":
    "has no exchange rate here, so it is counted at face value wherever it appears above.|have no exchange rate here, so each is counted at face value wherever it appears above.",
  "unconverted.note":
    "Those totals are the rows added up, not the amount any figure above is wrong by: a cost is counted beside the value it belongs to, and a debt counts here while it subtracts there. A mistyped code → correct it on the row. A real currency no reference rate is published for → nothing can convert it, and the figures above are in more than one unit alongside {baseCurrency}.",

  // --- what a Delete of a row asks, and what it could not say -------------
  "del.movesUnknown": "What deleting it moves could not be worked out: {reason}",
  "del.deleteFailed": "Delete failed.",

  // --- while the fund catalogue is still arriving -------------------------
  "catalogue.downloading":
    "The fund catalogue is downloading by itself. The funds will show here as soon as it arrives. {meanwhile}",
  "catalogue.failed":
    "The fund catalogue could not be downloaded from justETF. The app tries again by itself when it is next opened or reloaded. {meanwhile}",
  "catalogue.failedFrom":
    "The fund catalogue could not be downloaded from justETF. The app tries again by itself when it is next opened or reloaded, from {time}. {meanwhile}",
  "catalogue.notStarted":
    "The fund catalogue downloads by itself when the app opens. Reload the page to start it. {meanwhile}",
  "catalogue.meanwhile": "Meanwhile, what you type can be used as it is.",

  // --- codes the backend sends, read out as words -------------------------
  "code.bank": "Bank",
  "code.broker": "Broker",
  "code.insurance": "Insurance",
  "code.pension_fund": "Pension fund",
  "code.crypto_exchange": "Crypto exchange",
  "code.other": "Other",
  "code.cash": "Cash",
  "code.equity": "Equity",
  "code.bond": "Bond",
  "code.fund_etf": "Fund / ETF",
  "code.crypto": "Crypto",
  "code.real_estate": "Real estate",
  "code.commodity": "Commodity",
  "code.vehicle": "Vehicle",
  "code.collectible": "Collectible",
  "code.jewelry": "Jewelry",
  "code.art": "Art",
  "code.etf": "ETF",
  "code.cryptocurrency": "Cryptocurrency",
  "code.future": "Future",
  "code.index": "Index",

  // --- pages, from the staging fragments ---------------------------------
  ...profileEn,
  ...portfolioEn,
  ...recordsEn,
} as const;

/** Every message the app can say. `zh.ts` must name all of them — the
    compiler enforces it, which is the point of typing the catalogue here. */
export type MessageKey = keyof typeof en;
