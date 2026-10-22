/* Profile & goals: the English half of the staging catalogue.

   These keys are not in `messages/en.ts` yet — the parent agent merges this
   fragment there (and `profile.zh.ts` into `zh.ts`) once the page is done.
   Until then `MessageKey` does not name them, which is why the call sites look
   like finished code and `tsc` is expected to complain about the union.

   English is the source of truth for WHICH keys exist. Keys are prefixed
   `profile.`, `goals.` or `survey.` so they cannot collide with another
   fragment. `survey.*` says the backend's questions in the reader's language
   while the values stored stay the English the backend sent — see
   `components/surveyText.ts`. */

export const profileEn = {
  // --- the page itself -----------------------------------------------------
  "profile.title": "Profile & goals",
  "profile.intro":
    "A short questionnaire that gives Aurelio your context. Saved on your machine; sent to the AI model through OpenRouter when you run an analysis or ask the chat.",
  "profile.save": "Save profile",
  "profile.saving": "Saving…",
  "profile.saved": "Saved ✓",
  "profile.choose": "choose…",

  // --- answers the form does not ask ---------------------------------------
  "profile.otherTitle": "Other answers",
  "profile.otherIntro":
    "Answers to questions this form does not ask, recorded in the chat. The chat and the analyses read them like the rest: change one or delete it here, then save.",
  "profile.deletedWhenSave": "Deleted when you save:",
  "profile.keepIt": "Keep it",

  // --- the currency every total is shown in --------------------------------
  "profile.baseTitle": "Base currency",
  "profile.baseHelp":
    "Every total is shown in this currency: your net worth, its history, every converted figure. Changing it moves all of them, the history included: it is the same wealth in another unit, converted at the reference rate of each figure's own day. Nothing you recorded is rewritten: every amount keeps the currency you typed it in, and a debit or a transfer fixed on its day stays what it was.",
  "profile.baseShowIn": "Show totals in",
  "profile.baseSwitch":
    "Saving switches every total from {current} to {picked}. The rates against {picked} are fetched first; if the feed cannot be reached, nothing changes.",
  "profile.baseOnlyOne":
    "The rate feed has not answered yet, so {current} is the only currency on offer.",

  // --- 涨跌配色: which way the market colours point -------------------------
  "profile.gainsTitle": "Gain/loss colours",
  "profile.gainsHelp":
    "Only the colours of gains and losses move with this: the P/L column, the net worth change. Status colours never move — a refusal is red and a success is green in both settings.",
  "profile.gainsCn": "Red up, green down",
  "profile.gainsWest": "Green up, red down",
  "profile.gainsNote": "Applies as soon as you press it; nothing needs saving.",

  // --- tax -----------------------------------------------------------------
  "profile.taxTitle": "Tax",
  "profile.taxHelp":
    "Your own rates, used for an estimate shown beside your portfolio figures. Aurelio never puts a tax inside a total: not your net worth, not your book value. Leave a field empty if you do not know it: that is different from writing 0, and the estimate will say which half it could not work out.",
  "profile.taxCountryLabel": "Which country do you pay investment tax in?",
  "profile.taxCountryPlaceholder":
    "Any country (typing your own rates below works either way)",
  "profile.taxMatch": "{country}: {regime} ({cg}% on gains, {div}% on dividends).",
  "profile.taxUseThese": "Use these as a starting point",
  "profile.taxCgLabel": "Capital gains rate",
  "profile.taxCgHint": "Applied to the gains your sells locked in",
  "profile.taxDivLabel": "Dividend withholding rate",
  "profile.taxDivHint":
    "Applied only to dividends still showing the market's gross figure",
  "profile.taxNothingSet":
    "Nothing set, so no tax estimate is shown anywhere: not a zero, and not a silent omission. The portfolio page says what it is missing.",
  "profile.rateNotSet": "not set",

  // --- an answer the form cannot show ---------------------------------------
  "survey.unshown.boolean":
    'On record: "{value}", which is none of these answers. Press one to replace it; saved without one, it stays as it is.',
  "survey.unshown.single":
    'On record: "{value}", which is none of these options. Pick one to replace it; saved without one, it stays as it is.',
  "survey.unshown.number":
    'On record: "{value}", which is not a number. Type one to replace it; saved without one, it stays as it is.',

  // --- the questionnaire, said in this language -----------------------------
  "survey.topic.about": "About you",
  "survey.topic.financial_literacy": "Financial literacy",
  "survey.topic.family": "Family",
  "survey.topic.housing": "Housing & city",
  "survey.topic.career": "Career & income",
  "survey.topic.purchases": "Major purchases",
  "survey.topic.retirement": "Retirement & horizon",
  "survey.topic.risk": "Risk & values",
  "survey.topic.words": "In your words",
  "survey.topic.lifestyle": "Lifestyle",

  "survey.opt.yes": "Yes",
  "survey.opt.no": "No",
  "survey.opt.unsure": "Unsure",
  "survey.opt.employee": "Employee",
  "survey.opt.selfEmployed": "Self-employed",
  "survey.opt.businessOwner": "Business owner",
  "survey.opt.student": "Student",
  "survey.opt.retired": "Retired",
  "survey.opt.notWorking": "Not working",
  "survey.opt.single": "Single",
  "survey.opt.couple": "Couple",
  "survey.opt.familyChildren": "Family with children",
  "survey.opt.other": "Other",
  "survey.opt.rent": "Rent",
  "survey.opt.ownMortgage": "Own (with mortgage)",
  "survey.opt.ownOutright": "Own (outright)",
  "survey.opt.liveWithFamily": "Live with family",
  "survey.opt.under2years": "< 2 years",
  "survey.opt.twoToFiveYears": "2–5 years",
  "survey.opt.over5years": "> 5 years",
  "survey.opt.low": "Low",
  "survey.opt.medium": "Medium",
  "survey.opt.high": "High",
  "survey.opt.certainLoss500": "A certain loss of 500 ¥",
  "survey.opt.gamble1000": "A 50/50 gamble: lose 1000 ¥ or lose nothing",

  "survey.q.about_country": "Which country do you live in?",
  "survey.q.about_area": "Which city or area?",
  "survey.q.about_age": "Your age?",
  "survey.q.about_employment": "Employment status?",
  "survey.q.about_household": "Household?",
  "survey.q.about_dependents": "How many people depend on you financially?",
  "survey.q.about_home": "Your housing situation?",
  "survey.q.lit_why_invest": "Do you know why people invest?",
  "survey.q.lit_inflation": "Do you know what inflation is?",
  "survey.q.lit_risk_return": "Do you know the risk/return trade-off?",
  "survey.q.lit_diversification": "Do you know what diversification is?",
  "survey.q.fam_want": "Do you want to start or grow a family?",
  "survey.q.fam_when": "On what horizon?",
  "survey.q.fam_children": "How many children do you plan for?",
  "survey.q.home_buy": "Do you plan to buy a home?",
  "survey.q.home_when": "When?",
  "survey.q.home_city": "Any city/area you plan to move to or settle in?",
  "survey.q.career_change": "Do you expect a major career or income change soon?",
  "survey.q.career_detail": "Briefly, what change?",
  "survey.q.big_purchase": "Any large purchase planned (car, renovation, …)?",
  "survey.q.big_purchase_detail": "What and roughly when?",
  "survey.q.ret_age":
    "At what age would you like to retire or be financially independent?",
  "survey.q.risk_tolerance": "How would you describe your risk tolerance?",
  "survey.q.risk_loss_choice":
    "Which would you choose: a certain loss of 500 ¥, or a 50% chance of losing 1000 ¥ and a 50% chance of losing nothing?",
  "survey.q.values_esg": "Do ethical / ESG considerations matter for your investments?",
  "survey.q.self_narrative":
    "Write freely about yourself and your money: what you are working towards, what worries you, what you would never give up, how you want Aurelio to talk to you. Nothing here is validated or scored: it is context.",
  "survey.q.lifestyle_notes":
    "Anything else about your situation, habits, or plans Aurelio should know?",

  "survey.explain.lit_why_invest":
    "Investing grows your savings over time and protects them from inflation: money left idle loses purchasing power every year. By investing in assets that yield a return, your capital can grow and outpace inflation, in exchange for some risk.",
  "survey.explain.lit_inflation":
    "Inflation is the general rise in prices over time: with the same amount you buy less tomorrow than today. At 3%/year, ¥100 is worth about ¥97 of purchasing power after one year, which is why idle cash 'loses value'.",
  "survey.explain.lit_risk_return":
    "Higher potential returns usually require accepting more risk (ups and downs, possible losses). There are no high, guaranteed, risk-free returns. Be wary of anyone promising them.",
  "survey.explain.lit_diversification":
    "Diversification means not putting all your eggs in one basket. Spreading across instruments, sectors and regions reduces the chance that a single bad investment hurts everything.",

  // --- goals ----------------------------------------------------------------
  "goals.title": "Goals",
  "goals.hint":
    "Pick a safe goal type, or set a concrete target (amount + date) to see the annual return it would require.",
  "goals.type.protect_inflation": "Protect from inflation",
  "goals.type.stable_income": "Stable / passive income",
  "goals.type.long_term_growth": "Long-term growth",
  "goals.type.emergency_fund": "Emergency fund",
  "goals.type.target_amount": "Target amount by a date",
  "goals.type.other": "Something else (describe it)",
  "goals.typePlaceholder": "what is this goal for?…",
  "goals.detailPlaceholder": "Detail (optional), e.g. flat in Milan",
  "goals.targetPlaceholder": "Target",
  "goals.currentPlaceholder": "Current",
  "goals.monthlyPlaceholder": "Monthly contribution",
  "goals.currencyPlaceholder": "currency",
  "goals.currencyTitle":
    "The currency the target, what you have and the contribution are in. Proposed from your base currency; change it and it stays as you typed it.",
  "goals.save": "Save goal",
  "goals.add": "Add goal",
  "goals.empty": "No goals yet.",
  "goals.deleteConfirm": 'Delete goal "{name}"?',
  "goals.deleteFailed": "Delete failed.",
  "goals.targetSubtitle": "target {amount} by {date}",
  "goals.rateUnreachable": "unreachable",
  "goals.ratePerYear": "{pct}%/yr",
  "goals.requiredReturn":
    "Over ~{years} years this requires a return of **{rate}**. {assessment}",
  "goals.assess.pastDate": "The target date is in the past.",
  "goals.assess.unreachable":
    "Target effectively unreachable with these contributions. Raise contributions or extend the horizon.",
  "goals.assess.onTrack": "Already on track without investment growth.",
  "goals.assess.conservative": "Conservative: feasible with a low-risk allocation.",
  "goals.assess.moderate":
    "Moderate: in line with a diversified long-term portfolio.",
  "goals.assess.aggressive": "Aggressive: high risk, not guaranteed.",
  "goals.assess.unrealistic":
    "Unrealistic: consider extending the horizon, raising contributions, or lowering the target.",
} as const;
