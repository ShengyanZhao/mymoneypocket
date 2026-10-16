/* Portfolio-page words, staged for merge into `messages/en.ts`.

   Prefixes, one per surface: `portfolio.` the page, `instrument.` the picker,
   `watch.` the watchlist, `ledger.` the ledger form and its delete questions,
   `dividend.` the dividend lines, `cost.` the cost and P/L titles. Nothing
   here collides with the keys already in the catalogue.

   English is the source of truth for WHICH words exist — same rule as
   `en.ts` itself. Values keep the exact wording the components used to say
   inline, so nothing changes but which file holds the sentence. */

export const portfolioEn = {
  // --- cost and P/L titles over the position table (costWords.ts) ----------
  "cost.avgCostUnknown":
    "No purchase price on record: this is the price the situation was recorded at, not what you paid",
  "cost.avgCostEstimated":
    "Average price paid, ESTIMATED in part: some or all of it is a plan's buy priced at a market close, or a cost derived from a reported return, not a contract note",
  "cost.avgCostPaid": "Average price actually paid, from recorded purchases",
  "cost.plUnknown":
    "Movement since the situation was recorded, NOT profit: no purchase price is on record",
  "cost.plEstimated":
    "Profit or loss against a purchase price ESTIMATED in part (a plan's buy at a market close, or a cost derived from a reported return): real, but not verified against a contract note",
  "cost.plPaid": "Profit or loss against the average price you paid",

  // --- a holding's dividend line (dividendLine.ts, sameDividend.ts) --------
  "dividend.accumulating": "Accumulating",
  "dividend.distributing": "Distributing",
  "dividend.last": "last dividend {date}",
  "dividend.offerLine":
    "Already recorded for {symbol} at {where}, still estimated (the market's gross figure, before tax). If the dividend you are entering is one of these, correct it instead: a second row would count it twice.",
  "dividend.older": "And {count} older one.|And {count} older ones.",
  "dividend.correcting":
    "Correcting the dividend of {rowDate} with your figures: save to replace its own.",
  "dividend.correctingMoved":
    "Correcting the dividend of {rowDate} with your figures: save to replace its own. Its date stays {rowDate}, the ex-date the app finds it by, so {typedDate} is not used.",
  "dividend.movedOffDay":
    "The app recorded this dividend on its ex-date, {rowDate}, and finds it by that day. Moved to {date}, the dividend of {rowDate} is recorded again at the next start, unless this account has a situation dated on or after it.",

  // --- the ledger: kinds, delete questions, form words ---------------------
  "ledger.kind.buy": "buy",
  "ledger.kind.sell": "sell",
  "ledger.kind.dividend": "dividend",
  "ledger.kind.close": "close",
  "ledger.pacBadge": "PAC",
  "ledger.deletePlain": 'Delete {kind} "{name}" of {date}? Nothing brings it back.',
  "ledger.deleteDividend":
    'Delete {kind} "{name}" of {date}? The app will not record a dividend of {symbol} at this account on {date} again. If your broker paid it, correct it with the credit from your statement instead.',
  "ledger.deletePacLast":
    "Delete {kind} \"{name}\" of {date}? Its PAC will not buy its occurrence of {occurrence} again. What the PAC carries goes to zero, and that money stays in the account's cash. If your broker did buy it, correct it with the figures from your statement instead.",
  "ledger.deletePacKeeps":
    "Delete {kind} \"{name}\" of {date}? Its PAC's occurrence of {occurrence} keeps its other buy, and this fund is not bought for it again. What the PAC carries goes to zero, and that money stays in the account's cash. If your broker did buy it, correct it with the figures from your statement instead.",
  "ledger.addBuy": "Add buy",
  "ledger.addSell": "Add sell",
  "ledger.addDividend": "Add dividend",
  "ledger.addKind": "Add {kind}",
  "ledger.recordDisposal": "Record disposal",
  "ledger.correctThis": "Correct this one",
  "ledger.deleteFailed": "Delete failed.",
  "ledger.noTransactions":
    "No transactions yet. Add one, or let PACs and dividends auto-record at app start.",
  "ledger.feesLabel": "fees {amount}",
  "ledger.ecbRate": "at the reference rate of {date}",
  "ledger.est": "est.",
  "ledger.thisAccount": "this account",

  // --- the watchlist (Watchlist.tsx, watchItem.ts) -------------------------
  "watch.title": "Watchlist",
  "watch.hint":
    "Instruments you were shown and kept. Nothing here is owned: no total, no allocation and no projection counts a line on this list.",
  "watch.note":
    "Lines arrive from the chat. It may only name a fund that exists in the local registry or a share Yahoo lists, and the three sentences under each one are what it said at the time.",
  "watch.explainQ": "What does ‘record a buy’ do?",
  "watch.explainT":
    "No broker is connected, so ‘record a buy’ is exactly that: it fills the ledger form below with the fund or the share and leaves how many, at what price, where and when to you. It does not clear the line (an idea you bought a first tranche of is still an idea), so drop it with ✕ when you are done with it.",
  "watch.empty":
    "Nothing on the watchlist. Ask the chat what you might look at, and what it suggests lands here with its reasoning.",
  "watch.loadError": "Could not load the watchlist. Is the backend running on :8000?",
  "watch.dropFailed": "Could not drop that idea.",
  "watch.drop": "Drop this idea",
  "watch.why": "Why",
  "watch.becauseYouSaid": "Because you said",
  "watch.notKnown": "Not known",
  "watch.added": "added {date}",
  "watch.share": "share",
  "watch.fund": "fund",
  "watch.recordBuy": "Record a buy",
  "watch.recordBuyTitle":
    "Fill the ledger form below with this {what}: you supply how many, at what price, where and when",
  "watch.shareIdentity": "{symbol} · share, as Yahoo lists it",
  "watch.prefillShare":
    "{symbol}: the symbol Yahoo lists this share under, checked when the card was drawn and again when you accepted it. Check it is the listing you bought on. How many, at what price and where are yours too. Recording this leaves the watchlist line where it is: drop it with ✕ when the idea is done.",
  "watch.prefillFund":
    "{isin} · {symbol}: the ISIN identifies the fund; the ticker came from the live lookup, so check it is the listing you actually bought on. How many, at what price and where are yours too. Recording this leaves the watchlist line where it is: drop it with ✕ when the idea is done.",
  "watch.prefillFundBare":
    "{isin}. That identifies the fund but does not price it: the ticker of the listing you bought on is still yours to give. How many, at what price and where are yours too. Recording this leaves the watchlist line where it is: drop it with ✕ when the idea is done.",

  // --- the instrument picker (InstrumentPicker.tsx) ------------------------
  "instrument.placeholder": "Name (type to search)",
  "instrument.label": "Asset name",
  "instrument.owned": "Positions you already hold",
  "instrument.ownedHint": "adds to them, not beside them",
  "instrument.heldAt": "held at {institution}",
  "instrument.live": "Shares, ETFs & crypto (live)",
  "instrument.liveLooking": "looking up…",
  "instrument.liveOnly": "the only source of a quotable symbol",
  "instrument.liveDown": "Live source did not answer. This says nothing about the instrument.",
  "instrument.liveDownTitle":
    "Nothing answered, which is a different claim from 'this instrument does not exist'. The catalogue lane below is local and unaffected.",
  "instrument.onExchange": "on {exchange}",
  "instrument.futuresWarn": "⚠ dated contract: expires and rolls",
  "instrument.futuresWarnTitle":
    "A futures contract expires and rolls, so a position pinned to this symbol would measure a different contract in a few months without saying so.",
  "instrument.funds": "Funds & ETFs (UCITS catalogue)",
  "instrument.fundsHint": "shares and coins are not in here",
  "instrument.partial":
    "Not every word matched. These are the closest, keep typing to narrow.",
  "instrument.policyUnknown": "unknown",
  "instrument.noMatch":
    "Nothing in the UCITS fund catalogue matches. For a share, a coin or a US-domiciled ETF that is the expected answer rather than a failure: type the name and the ticker yourself, and the live check below will confirm what it resolved to.",
  "instrument.useAsIs":
    "Use “**{value}**” as it is, with nothing from the catalogue attached",

  // --- the tax estimate, beside the totals (TaxEstimatePanel) --------------
  "portfolio.taxNoRate": "No tax rate set, so no estimate is shown here.",
  "portfolio.taxGain": "There is a realized gain of {amount}. ",
  "portfolio.taxLoss":
    "The realized result is a loss of {amount}, which no rate would be applied to anyway. ",
  "portfolio.taxGrossDividends":
    "{amount} of dividends still show the market\u2019s gross figure. ",
  "portfolio.taxSetRate": "Set your rate in Profile → Tax.",
  "portfolio.taxTitle": "Estimated tax",
  "portfolio.taxTotal": "**{amount}** estimated, and counted in none of the totals above",
  "portfolio.taxNoTotal":
    "No total: you have not set a rate for {rates}, and adding up only the half that can be worked out would understate it.",
  "portfolio.taxLossLine":
    "Realized result is a loss of **{amount}** (nothing estimated on it)",
  "portfolio.taxGainLine": "Realized gain {gain} at *{rate}%* = **{tax}**",
  "portfolio.taxDividendLine": "Gross dividends {gross} at *{rate}%* = **{tax}**",
  "portfolio.taxNetNote":
    " · the {net} you corrected by hand is already net and is left alone",

  // --- the positions section ----------------------------------------------
  "portfolio.title": "Portfolio",
  "portfolio.hint":
    "Your investment positions (latest situation of each institution). Refresh to pull live market prices and see profit/loss vs the recorded value.",
  "portfolio.loadError": "Could not load the portfolio. Is the backend running on :8000?",
  "portfolio.pricing": "Pricing…",
  "portfolio.refresh": "↻ Refresh market prices",
  "portfolio.marketVsRecorded": "Market **{market}** vs recorded {book}",
  "portfolio.unknown": "unknown",
  "portfolio.onPricedRows": "on priced rows",
  "portfolio.carriedOfTotal":
    "{amount} of that total is what you last recorded, not priced",
  "portfolio.recordedTotal": "Recorded total **{book}**",
  "portfolio.pricesAsOf": "prices as of {date} ({age})",
  "portfolio.fxAsOf": "FX rate {date}",
  "portfolio.realizedPL": "Realized P/L **{delta}**",
  "portfolio.dividendsCollected": " · dividends collected {amount}",
  "portfolio.ageToday": "today",
  "portfolio.ageDays": "{n} day ago|{n} days ago",
  "portfolio.emptyTitle": "Nothing invested yet",
  "portfolio.emptyBody":
    "Add an institution in Records → Wealth, then a dated situation and the holdings it contains. Give each one a ticker and this table fills in on its own.",
  "portfolio.colAsset": "Asset",
  "portfolio.colInstitution": "Institution",
  "portfolio.colQty": "Qty",
  "portfolio.colAvgCost": "Avg cost",
  "portfolio.colRecorded": "Recorded",
  "portfolio.colLivePrice": "Live price",
  "portfolio.colWorthNow": "Worth now",
  "portfolio.colPL": "P/L vs recorded",
  "portfolio.currencyNote": "⚠ {note}. The listing wins; fix the field in Records",
  "portfolio.staleUnpriceable":
    "value from {when} ({days} days): nothing can price this, only you can refresh it",
  "portfolio.staleQty":
    "priced today, but {days} days since anyone confirmed you hold this many ({when})",
  "portfolio.disposedOn": "disposed of on {date}, kept here so the exit is visible",
  "portfolio.noInstitutionTitle":
    "Held at no institution: no situation can photograph it and nothing can confirm it is still there. PAC targets that name no institution create these. Give the ledger row below an institution to attach it.",
  "portfolio.noInstitution": "no institution",
  "portfolio.est": "est.",
  "portfolio.costUnknown": "cost unknown",
  "portfolio.marketCloseOf": "Market close of {date}",
  "portfolio.worthCarriedTitle":
    "Nothing can price this today: the last value recorded for this position, carried forward",
  "portfolio.sinceSituation": "since situation",
  "portfolio.tableNote":
    "*Recorded* is what a position cost: the purchase price where you entered one, otherwise the value your last situation recorded (and then *Avg cost* says \"cost unknown\", because that is not a price you paid). *Worth now* is the other question: a market price where the market can give one, the last value recorded for the position where it cannot. *P/L vs recorded* compares the two only when a real quote priced the row. On a row nothing can price, the difference between the two columns is there to read, but a month-old statement is not a market and this app will not colour it green. Refreshing a price no longer overwrites a situation (that used to force P/L to zero): to record today's values, record a new situation.",

  // --- the look-through section -------------------------------------------
  "portfolio.lookTitle": "Look-through (real exposure)",
  "portfolio.lookNote":
    "From the issuers' own files where they publish them, justETF and Yahoo otherwise. Cached 15 days.",
  "portfolio.lookExplainQ": "What is the look-through?",
  "portfolio.lookExplainT":
    "What is really inside your funds: countries, sectors, and the issuers you hold through more than one of them.",
  "portfolio.compositionError":
    "Could not load the composition (sources may be unreachable).",
  "portfolio.fetching": "Fetching…",
  "portfolio.updateComposition": "↻ Update composition",
  "portfolio.coverage": "Coverage **{pct}** of the portfolio decomposed",
  "portfolio.loadingComposition": "Loading composition…",
  "portfolio.coverageTitle": "How much of the portfolio we can see inside",
  "portfolio.decomposedPct": "{pct} decomposed",
  "portfolio.coverageNote":
    "Percentages below are shares of the whole portfolio, so they add up to the decomposed part, not to 100%.",
  "portfolio.lookedInside": "Looked inside",
  "portfolio.notDecomposed": "Not decomposed",
  "portfolio.nothingYet": "Nothing yet.",
  "portfolio.everythingCovered": "Everything is covered.",
  "portfolio.singleStocksNote":
    "Single stocks and crypto have nothing inside them to look at. A fund listed here usually just needs its ISIN: add it to the holding in Records → Wealth.",
  "portfolio.countries": "Countries (% of portfolio)",
  "portfolio.sectors": "Sectors (% of portfolio)",
  "portfolio.issuers": "Issuers (% of portfolio)",
  "portfolio.currencyExposure": "Currency exposure (% of portfolio)",
  "portfolio.noData": "No data",
  "portfolio.matrixTitle": "Asset class × region (% of portfolio)",
  "portfolio.class": "Class",
  "portfolio.currencyMethodNote":
    "Currency exposure follows the country each company belongs to, not where it earns its revenue, and ignores share-class hedging: a EUR-hedged fund still shows the currencies of what it holds.",
  "portfolio.overlapTitle": "Overlap: same stock inside 2+ funds",
  "portfolio.overlapNote":
    "Complete for funds resolved from their issuer's own holdings file; for funds covered by a third party it only sees the published top holdings, so the real overlap is larger there.",
  "portfolio.via": "via {funds}",

  // --- the ledger form (BuysSection) --------------------------------------
  "portfolio.ledgerTitle": "Transactions (ledger)",
  "portfolio.ledgerHint":
    "What you paid, and what came back: the only place a real profit can come from.",
  "portfolio.ledgerNote":
    "Without a buy here, the P/L above measures movement since the last situation rather than gain. Rows marked ‘estimated’ came from market closes or gross dividends. Correct them with the real broker amounts.",
  "portfolio.ledgerExplainQ": "How are sells and dividends counted?",
  "portfolio.ledgerExplainT":
    "A sell removes units at average cost and books the difference; a dividend credits cash.",
  "portfolio.noCash": "no cash on record",
  "portfolio.cashAvailable": "{amount} available",
  "portfolio.instTitle": "Where the position is held, and whose cash pays for it",
  "portfolio.instWhere": "Where do you keep it?",
  "portfolio.instAdd": "+ Add where you keep it",
  "portfolio.assetPlaceholder": "Asset (type to search)",
  "portfolio.pickNoteTicker": "{isin}: the ticker is still yours to give.",
  "portfolio.pickNoteCheck":
    "{symbol}: check it matches the position you are adding to.",
  "portfolio.tickerPlaceholder": "Ticker or ISIN",
  "portfolio.tickerTitle":
    "Yahoo ticker with exchange suffix (e.g. VWCE.MI) or the fund's ISIN. It must match the position's symbol in Wealth",
  "portfolio.qtyLabel": "Quantity",
  "portfolio.qtyPlaceholder": "Qty",
  "portfolio.priceLabel": "Price",
  "portfolio.perShareLabel": "Dividend per share",
  "portfolio.currencyPlaceholder": "currency",
  "portfolio.priceCurrencyTitle":
    "The currency the price is in: the listing's (USD for a New York share, GBp for pence in London)",
  "portfolio.priceOnDate": "↻ price on date",
  "portfolio.proceedsPlaceholder": "Proceeds",
  "portfolio.feesPlaceholder": "Fees",
  "portfolio.proceedsTitle":
    "What came back. Zero is allowed, but it has to be said: that is the difference between selling something and forgetting it.",
  "portfolio.feesTitle": "Broker fees and commissions",
  "portfolio.proceedsCurrencyTitle": "The currency the proceeds reached the account in",
  "portfolio.accountCurrencyTitle":
    "The currency of the account: what the fees and the money that moved are in",
  "portfolio.debitedIn": "Debited in {currency}",
  "portfolio.creditedIn": "Credited in {currency}",
  "portfolio.debitDerived": "{amount} if left blank",
  "portfolio.debitTitle":
    "What the account actually moved by, from your statement. Leave it blank and it is worked out from the quantity, the price and the fees (across two currencies, at the reference rate of the date above, where your broker's rate will differ a little).",
  "portfolio.priceNote":
    "{name}, close of {date}: {price}{currency}. Edit it if your fill differed.",
  "portfolio.noPrice": "No price found for that ticker on that date.",
  "portfolio.couldNotAdd": "Could not add it.",
  "portfolio.newInstName": "Name of the bank or broker",
  "portfolio.newInstType": "Type (optional)",
  "portfolio.addAndUse": "Add and use",
  "portfolio.newInstNote":
    "It joins the list in Records → Wealth, where you can give it a cash balance and its situations.",
  "portfolio.overspend":
    "That is more than the {amount} on record at {institution}. It was recorded anyway. If the balance is simply behind, its cash anchor in Records → Wealth is where you say so.",
} as const;
