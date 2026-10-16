/* Staging fragment: Records children (Wealth, Real assets, Debts, Cash flow).

   Merged into `en.ts` by hand once the page copy is reviewed. Keys are grouped
   by the page that reads them — `wealth.*`, `real.*`, `debts.*`, `cash.*` —
   so they cannot collide with the Portfolio or Profile fragments. Shared
   words stay in `common.*` / `forms.*` / `nav.pages.*` and are NOT repeated
   here: a call site reuses those keys instead. */

export const recordsEn = {
  // --- Wealth: institutions -------------------------------------------------
  "wealth.institutions": "Institutions",
  "wealth.nameOfBankOrBroker": "Name of the bank or broker",
  "wealth.typePlaceholder": "Type (e.g. bank)",
  "wealth.noInstitutions": "No institutions yet.",
  "wealth.deleteInstitution":
    'Delete "{name}"? This also removes its situations, holdings and cash anchors.',
  "wealth.backendUnreachable": "Could not reach the backend. Is it running on :8000?",
  "wealth.deleteFailed": "Delete failed.",
  "wealth.creationFailed": "Creation failed.",
  "wealth.noSituationYet": "no situation recorded yet",
  "wealth.oneSituationOnly":
    "one situation only ({date}): no history to compare against yet",
  "wealth.situationsCount": "{count} situations · latest {date}",

  // --- Wealth: the cash register -------------------------------------------
  "wealth.cash": "Cash",
  "wealth.today": "today",
  "wealth.unknown": "unknown",
  "wealth.fromAnchor": "From anchor {amount} on {date}:",
  "wealth.termIncome": "+ income {amount}",
  "wealth.termExpenses": "− expenses {amount}",
  "wealth.termTransfers": "transfers +{in} / −{out}",
  "wealth.termBuys": "− buys {amount}",
  "wealth.termSells": "+ sells/dividends {amount}",
  "wealth.destIncome": "Records → Cash flow, where income is entered",
  "wealth.destExpenses": "Records → Cash flow, where expenses are entered",
  "wealth.destTransfers": "Records → Cash flow, where transfers are entered",
  "wealth.destBuys": "Portfolio's ledger, where purchases are entered",
  "wealth.destSells": "Portfolio's ledger, where sales and dividends are entered",
  "wealth.noAnchorYet":
    "No anchor yet. Add the actual cash you held at a date below. Linked salaries, costs and transfers after that date are then projected automatically.",
  "wealth.anchorInFuture":
    'Your earliest anchor is dated {date}, which is in the future, so cash will start projecting from that date. If you meant "today", edit it with ✎.',
  "wealth.loadCash": "Could not load this account's cash.",
  "wealth.actualBalance": "actual balance",
  "wealth.balanceOn": "balance on",
  "wealth.actualCash": "Actual cash",
  "wealth.addAnchor": "Add anchor",
  "wealth.noAnchors": "No anchors yet.",

  // --- Wealth: investment situations ---------------------------------------
  "wealth.investmentSituations": "Investment situations",
  "wealth.held": "held",
  "wealth.portfolioNotLoaded": "the portfolio did not load: this is not a zero",
  "wealth.carriedAll": "carried from what was recorded, not priced",
  "wealth.carriedSome":
    "{amount} of it carried from what was recorded, not priced",
  "wealth.situationsHint":
    "Your investment positions at a date. Cash lives in the Cash section above.",
  "wealth.situationsNote":
    "To update, start a new date from the previous one. Editing an old situation rewrites what that day said.",
  "wealth.loadSituations": "Could not load situations.",
  "wealth.nothingToStartFrom":
    "There is nothing to start from yet: this account's first situation has to be declared.",
  "wealth.startFromLastTitle":
    "Copies the positions and quantities of the latest situation, re-prices everything with a ticker at this date, and tells you which rows still need you",
  "wealth.declareFromScratch":
    "Declare from scratch what this account holds at this date.",
  "wealth.emptySituationAuthority":
    "An empty situation becomes this account's authority: the {count} position recorded here leave your net worth unless you re-enter them.|An empty situation becomes this account's authority: the {count} positions recorded here leave your net worth unless you re-enter them.",
  "wealth.dialogAuthority":
    "An empty situation becomes this account's authority for {date}.",
  "wealth.dialogLeaves":
    "This position will leave your net worth unless you re-enter it here:|These {count} positions will leave your net worth unless you re-enter them here:",
  "wealth.dialogReported":
    "They will be reported as unaccounted for, not removed in silence.",
  "wealth.dialogKeeps": "keeps them. Continue anyway?",
  "wealth.startFromLast": "Start from the last one",
  "wealth.declareFirst": "Declare the first situation",
  "wealth.startEmpty": "Start empty",
  "wealth.copiedNeedsAttention":
    "Copied from {date}. {n} priced from the market. Only {names} still needs you.",
  "wealth.copiedAll":
    "Copied from {date}, all {n} positions priced from the market.",
  "wealth.couldNotPrefill": "Could not start from the previous situation.",
  "wealth.deleteSituation":
    "Delete the situation of {date}? This also removes its holdings.",
  "wealth.dateTaken": "{date} already has a situation",
  "wealth.openIt": "Open it",
  "wealth.orPickAnotherDate": ", or pick another date to record a new one.",
  "wealth.noSituations": "No situations yet.",

  // --- Wealth: one situation's holdings ------------------------------------
  "wealth.situationOf": "Situation: {date}",
  "wealth.total": "Total",
  "wealth.cashNotEnteredHere":
    "Cash is not entered here: it belongs in this account's Cash section, and a deposit entered in both is counted twice.",
  "wealth.oldSituationTitle":
    "Editing an old situation rewrites what that day said, so the wealth chart will show today's figures as if they had been true back then, and P/L vs recorded collapses, because the photograph starts chasing the market.",
  "wealth.oldSituation":
    "Situation of **{date}**, {count} day ago: editing here rewrites what that day said. For today, use “Start from the last one”.|Situation of **{date}**, {count} days ago: editing here rewrites what that day said. For today, use “Start from the last one”.",
  "wealth.loadHoldings": "Could not load holdings.",
  "wealth.deleteHolding": 'Remove "{name}"?',
  "wealth.bucket.stocks": "Stocks & ETF",
  "wealth.bucket.bonds": "Bonds",
  "wealth.bucket.commodities": "Commodities",
  "wealth.bucket.crypto": "Crypto",
  "wealth.bucket.other": "Other",
  "wealth.policyHistory": "from its history",
  "wealth.policyAcc": "Accumulating",
  "wealth.policyDist": "Distributing",
  "wealth.modeTotal": "Total",
  "wealth.modeQty": "Qty × price",
  "wealth.tickerOrIsin": "Ticker or ISIN",
  "wealth.tickerTitle":
    "Yahoo ticker WITH the exchange suffix (VWCE.MI = Borsa Italiana, SAP.DE = Xetra, no suffix = US, BTC-EUR = crypto). A bare ticker like 'VWCE' won't match. An ISIN (e.g. IE00BK5BQT80) works too. Prefer a EUR listing so prices need no FX conversion.",
  "wealth.isinOptional": "ISIN (optional)",
  "wealth.isinTitle":
    "The fund's ISIN. The ticker prices the position; the ISIN is what the look-through sources use to see inside it: the same fund has a different ticker on each exchange, so one field cannot do both.",
  "wealth.addIsin": "Add the fund's ISIN",
  "wealth.costPlaceholder": "cost (optional)",
  "wealth.costLabel": "Cost",
  "wealth.costTitle":
    "What this position cost you in total, in its own currency. Leave it empty if you do not know: an empty cost reads as 'cost unknown', which is true, whereas a guess would let the P/L present a movement as a profit.",
  "wealth.dividendPolicy": "Dividend policy",
  "wealth.policyTitle":
    "From its history: the app reads this holding's dividends on Yahoo once a day and credits each one to this institution's cash, which is how a share works. Distributing: the same, as you or the catalogue stated it. Accumulating: no dividend is recorded (a fund that reinvests them).",
  "wealth.howEntered": "How this position is entered",
  "wealth.value": "Value",
  "wealth.toUnitsTitle":
    "Work out how many units that value is, at this instrument's price, so the position starts pricing itself instead of staying a number you have to maintain",
  "wealth.toUnits": "→ units",
  "wealth.quantity": "Quantity",
  "wealth.price": "Price",
  "wealth.fetchPriceTitle": "Fetch the latest market price for this ticker",
  "wealth.live": "↻ live",
  "wealth.currency": "currency",
  "wealth.currencyTitle":
    "The currency the value, the price and the cost are in. Proposed from the listing when its currency is known, otherwise from the account's anchor on this situation's date; change it and it stays as you typed it.",
  "wealth.deriveTooFar":
    "This situation is dated {situation} but the price is from {price}. Dividing one by the other would invent a quantity you never held. Enter the units from your broker instead.",
  "wealth.derivedUnits":
    "{value} ÷ {price} = {units} units of {name} (close of {date}). Derived, so check it against your broker.",
  "wealth.couldNotPrice":
    "Could not price that ticker, so the units cannot be worked out.",
  "wealth.quoteOk":
    "✓ {name}{resolved}: {price} {currency} (last close {date})",
  "wealth.marketUnreachable":
    "⚠ Could not reach the market, so your symbol may well be correct. Nothing answered, so this says nothing about it. Try again when you are online.",
  "wealth.noMarketMatch":
    "✗ No market match. A bare ticker won't work: add the exchange suffix (VWCE.MI for Borsa Italiana, .DE for Xetra, none for US) or paste the fund's ISIN.",
  "wealth.refreshFailed":
    'Price refresh failed for "{name}". Check its symbol.',
  "wealth.pickCatalogue":
    "{identity} from the catalogue. The ticker is still yours to give: this fund trades under a different symbol on each exchange.",
  "wealth.pickOwned":
    "{symbol}: the symbol already on your position{at}.",
  "wealth.atInstitution": " at {name}",
  "wealth.pickChecking":
    "{symbol} on {exchange}: checking what it prices…",
  "wealth.itsExchange": "its exchange",
  "wealth.lastDividend": "last dividend {date}",

  // --- Real assets ----------------------------------------------------------
  "real.name": "Name",
  "real.categoryBlank": "category…",
  "real.currency": "currency",
  "real.currencyTitle":
    "The currency the asset is valued in. Proposed from your base currency; change it and it stays as you typed it.",
  "real.noRealAssets": "No real assets yet.",
  "real.deleteConfirm": 'Delete "{name}"? This also removes its valuations.',
  "real.backendUnreachable": "Could not reach the backend. Is it running on :8000?",
  "real.deleteFailed": "Delete failed.",
  "real.loadValuations": "Could not load valuations.",
  "real.valuationsOf": "Valuations: {name}",
  "real.equityLine":
    "Latest value {value} − debt {debt} ({names}) = **your equity {equity}**",
  "real.debtInCurrency": "{name} is in {currency}",
  "real.equitySkipped":
    "Equity is not worked out here: {list}, and this asset is valued in {currency}. The net worth on the Dashboard converts both.",
  "real.value": "Value",
  "real.noValuations": "No valuations yet.",

  // --- Debts -----------------------------------------------------------------
  "debts.name": "Name",
  "debts.kindBlank": "kind…",
  "debts.kind.mortgage": "mortgage",
  "debts.kind.personal_loan": "personal loan",
  "debts.kind.auto_loan": "auto loan",
  "debts.kind.student_loan": "student loan",
  "debts.kind.credit_card": "credit card",
  "debts.kind.other": "other",
  "debts.ratePlaceholder": "Rate %/yr",
  "debts.currency": "currency",
  "debts.currencyTitle":
    "The currency the debt is owed in. Proposed from your base currency; change it and it stays as you typed it.",
  "debts.financesAsset": "finances asset…",
  "debts.noDebts": "No debts, lucky you.",
  "debts.deleteConfirm":
    'Delete "{name}"? This also removes its balance history.',
  "debts.backendUnreachable": "Could not reach the backend. Is it running on :8000?",
  "debts.deleteFailed": "Delete failed.",
  "debts.hint":
    "Mortgage, loans… Net worth subtracts the latest balance of each. Link a mortgage to its asset to see your equity.",
  "debts.finances": "finances {name}",
  "debts.ratePerYear": "{rate}%/yr",
  "debts.loadBalances": "Could not load balances.",
  "debts.outstandingOf": "Outstanding balance: {name}",
  "debts.outstandingQuestion": "What is the outstanding balance?",
  "debts.outstandingText":
    "The remaining principal, as your amortization statement shows it.",
  "debts.remaining": "Remaining",
  "debts.noBalances": "No balances yet.",

  // --- Cash flow: the four figures ------------------------------------------
  "cash.monthlyIncome": "Monthly income",
  "cash.monthlyExpenses": "Monthly expenses",
  "cash.monthlyNet": "Monthly net",
  "cash.breakdown":
    "Income: active {active} · passive {passive}. Expenses: essential {essential} · discretionary {discretionary}. ",
  "cash.notCountedMarked": "Not counted: {what} (marked below).",
  "cash.backendUnreachable": "Could not reach the backend. Is it running on :8000?",
  "cash.deleteFailed": "Delete failed.",

  // --- Cash flow: income and expenses ---------------------------------------
  "cash.incomeHint": "Institution = where it's credited (its cash).",
  "cash.expenseHint": "Institution = where it's paid from (its cash).",
  "cash.noIncome": "No income yet.",
  "cash.noExpenses": "No expenses yet.",
  "cash.deleteIncome": 'Delete income "{name}"?',
  "cash.deleteExpense": 'Delete expense "{name}"?',
  "cash.name": "Name",
  "cash.amount": "Amount",
  "cash.kindBlank": "kind…",
  "cash.natureBlank": "nature…",
  "cash.categoryBlank": "category…",
  "cash.frequencyBlank": "frequency…",
  "cash.institutionBlank": "institution…",
  "cash.end": "end",
  "cash.currency": "currency",
  "cash.flowCurrencyTitle":
    "The currency the amount is in. Proposed from the institution's cash on the first payment's date; change it and it stays as you typed it.",
  "cash.kind.active": "active",
  "cash.kind.passive": "passive",
  "cash.nature.essential": "essential",
  "cash.nature.discretionary": "discretionary",
  "cash.category.salary": "salary",
  "cash.category.freelance": "freelance",
  "cash.category.business": "business",
  "cash.category.rental": "rental",
  "cash.category.dividends": "dividends",
  "cash.category.interest": "interest",
  "cash.category.pension": "pension",
  "cash.category.housing": "housing",
  "cash.category.food": "food",
  "cash.category.transport": "transport",
  "cash.category.utilities": "utilities",
  "cash.category.health": "health",
  "cash.category.insurance": "insurance",
  "cash.category.debt": "debt",
  "cash.category.leisure": "leisure",
  "cash.category.education": "education",
  "cash.category.other": "other",
  // The vocabulary in force (app/taxonomy.py): rows stored under an old code
  // still read through it; the dropdowns offer only these words.
  "cash.category.wage": "wage",
  "cash.category.bonus": "bonus",
  "cash.category.red_packet": "red packets",
  "cash.category.reimbursement": "reimbursements",
  "cash.category.investment_income": "investment income",
  "cash.category.side_hustle": "side work",
  "cash.category.dining": "dining",
  "cash.category.shopping": "shopping",
  "cash.category.telecom": "phone & internet",
  "cash.category.medical": "medical",
  "cash.category.entertainment": "entertainment",
  "cash.category.travel": "travel",
  "cash.category.debt_payment": "debt payments",
  "cash.category.gift": "gifts",
  "cash.category.social_security": "social security",
  "cash.category.tax": "tax",
  "cash.category.transfer": "transfers",
  "cash.category.investment": "investments",
  "cash.frequency.monthly": "monthly",
  "cash.frequency.quarterly": "quarterly",
  "cash.frequency.semiannual": "semiannual",
  "cash.frequency.annual": "annual",
  "cash.frequency.one_off": "one-off",
  "cash.fromDate": "from {date}",
  "cash.untilDate": "until {date}",

  // --- Cash flow: transfers -------------------------------------------------
  "cash.transfers": "Transfers",
  "cash.transfersHint":
    "Move cash between two of your institutions on a date. It lowers the source's cash and raises the destination's. Between two currencies, what arrived is worked out at the reference rate of that date unless you type it from the statement.",
  "cash.on": "on",
  "cash.fromExternal": "from (or external)…",
  "cash.toExternal": "to (or external)…",
  "cash.external": "External",
  "cash.deleteTransfer": "Delete this transfer?",
  "cash.noAnswer": "no answer came.",
  "cash.fromCurrencyTitle": "The currency that left the source account",
  "cash.toCurrencyTitle": "The currency the destination account was credited in",
  "cash.arrivedIn": "Arrived in {currency}",
  "cash.arrivedTitle":
    "What the destination was actually credited, from its statement. Leave it blank and it is worked out at the reference rate of the date. Your bank's rate will differ a little.",
  "cash.atEcbRate": "at the reference rate of {date}",
  "cash.noTransfers": "No transfers yet.",

  // --- Cash flow: PAC -------------------------------------------------------
  "cash.pacHint": "Recurring buys: how much moves, into what, how often.",
  "cash.pacQuestion": "How does a PAC work?",
  "cash.pacExplain":
    "A plan names both ends (the account each contribution leaves, and where each investment is held), because money moves from one to the other and a plan that says neither is describing a purchase nobody made. With several targets the budget is spent as one pot, so a whole-unit broker leaves one small remainder instead of one per fund, and it carries to the next contribution.",
  "cash.planName": "Plan name",
  "cash.budget": "Budget",
  "cash.budgetTitle":
    "Total contributed per occurrence, split across the targets below",
  "cash.planCurrencyTitle":
    "The currency the contribution is paid in: the source account's cash. Proposed from that account on the first buy's date; change it and it stays as you typed it.",
  "cash.wholeUnits": "whole units",
  "cash.fractional": "fractional",
  "cash.executionTitle":
    "How your broker fills the order: whole units only (the remainder stays in cash), or exact fractional amounts, spending the contribution to the cent. Check which one yours does; it changes what a contribution buys.",
  "cash.whichAccountFunds": "Which account funds it?",
  "cash.sourceTitle":
    "The account each contribution is taken from. Required: a plan that does not say where the money comes from cannot take it from anywhere, and its buys spend money no account ever loses.",
  "cash.buyWhat": "Buy what? Type to search",
  "cash.ticker": "Ticker",
  "cash.tickerTitle":
    "Yahoo ticker with exchange suffix (e.g. VWCE.MI). A listing in another currency is bought at its close converted into the plan's currency, at the reference rate of that day",
  "cash.whereHeld": "Where is it held?",
  "cash.whereHeldTitle":
    "Where this investment will be held. Required: a position held at no institution is one no situation can photograph and no sale can settle. Pre-filled from the account funding the plan: change it if you buy this one somewhere else.",
  "cash.share": "share",
  "cash.shareTitle":
    "Relative share of the budget: 1/1/1 and 40/30/30 mean the same thing",
  "cash.removeTarget": "Remove this target",
  "cash.addAnother": "+ add another investment",
  "cash.split": "{amount} split {shares}",
  "cash.sayWhereHeld":
    "Say where {names} will be held. A position held nowhere is one no situation can photograph and no sale can settle.",
  "cash.it": "it",
  "cash.deletePlan": 'Delete plan "{name}"?',
  "cash.nothingYet": "nothing yet",
  "cash.fromCash": "cash",
  "cash.planFrom": "from {source} → {targets}",
  "cash.openAccount": "Open {name}",
  "cash.noMatches":
    "**{names}** matches no position you hold: fine for a new plan, but a typo starts a second position instead of adding to yours.",
  "cash.noMatchesTitle":
    "Executions are matched to positions by exact ticker, so a different spelling silently starts a SECOND position for the same fund instead of adding to the one you hold. If you are starting a new plan on something you do not own yet, this is expected: the first execution creates it.",
  "cash.noPlans": "No PACs yet.",
  "cash.setAsideEnded":
    "{amount} set aside and never invested: this plan has ended",
  "cash.setAsideWaiting":
    "{amount} set aside, waiting for the next contribution",

  // --- Cash flow: statement imports & entries -------------------------------
  "imports.title": "Import a statement",
  "imports.hint":
    "Export a CSV from Alipay or WeChat and import it here. Every row is confirmed before anything is written, one import is one undo, and the same file twice records nothing twice.",
  "imports.choose": "Choose a statement file",
  "imports.previewBtn": "Preview",
  "imports.account": "Into account…",
  "imports.accountHint": "Whose cash these movements belong to.",
  "imports.confirm": "Import {count} rows",
  "imports.cancel": "Cancel",
  "imports.rowsSeen": "{count} rows",
  "imports.duplicates": "{count} already imported; they will be skipped",
  "imports.unreadable": "{count} lines could not be read",
  "imports.pairs": "{count} pairs look like one transfer (out and in), ticked together",
  "imports.done": "{count} rows imported.",
  "imports.doneSkipped": "{count} rows imported, {duplicates} duplicates skipped.",
  "imports.failed": "The import failed.",
  "imports.batches": "Imports",
  "imports.noBatches": "No statement imported yet.",
  "imports.batchLine": "{source} · {filename} · {written} rows · {from} → {to}",
  "imports.deleteBatch": "Undo",
  "imports.deleteBatchAsk":
    "Undo this import? The {count} rows it wrote go with it; nothing else is touched.",
  "imports.entriesTitle": "Entries",
  "imports.noEntries": "No entries yet.",
  "imports.source.alipay": "Alipay",
  "imports.source.wechat": "WeChat Pay",
  "imports.source.bank": "bank",
  "imports.source.broker": "broker",
  "imports.source.generic": "generic",
  "imports.source.unknown": "unknown",
  "imports.colDate": "Date",
  "imports.colDirection": "In / out",
  "imports.colCounterparty": "Counterparty",
  "imports.colCategory": "Category",
  "imports.colAmount": "Amount",
  "imports.legMark": "transfer",
} as const;
