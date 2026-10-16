/* The Chinese words for the Portfolio page, staged for merge into `zh.ts`.

   Typed against `portfolioEn`, so a key written in English and forgotten here
   is a compile error. Keep every `{placeholder}`; `|` is unused in Chinese —
   write the one form. `*em*` / `**strong**` marks move to where Chinese wants
   the marked word. */

import type { portfolioEn } from "./portfolio.en.ts";

export const portfolioZh: Record<keyof typeof portfolioEn, string> = {
  // --- 成本与盈亏标题（costWords.ts）---------------------------------------
  "cost.avgCostUnknown":
    "没有记录买入价：这是记录本期状况时的价格，不是你付出的价格",
  "cost.avgCostEstimated":
    "平均买入价，部分为*估值*：其中一部分或全部是定投按收盘价算出的买入，或由申报收益率倒推的成本，不是交割单上的价格",
  "cost.avgCostPaid": "实际付出的平均价格，来自已记录的买入",
  "cost.plUnknown": "自本期状况记录以来的变动，不是盈亏：没有记录买入价",
  "cost.plEstimated":
    "相对部分*估值*的买入价（定投按收盘价的买入，或由申报收益率倒推的成本）的盈亏：真实，但未与交割单核对",
  "cost.plPaid": "相对你付出的平均价格的盈亏",

  // --- 持仓的分红一行（dividendLine.ts、sameDividend.ts）--------------------
  "dividend.accumulating": "累积",
  "dividend.distributing": "分红派息",
  "dividend.last": "最近分红 {date}",
  "dividend.offerLine":
    "{where}的 {symbol} 已有记录，仍为估值（市场的税前毛额）。如果这笔分红就是其中之一，请改为更正它：再记一笔会把同一笔钱数两遍。",
  "dividend.older": "另有 {count} 笔更早的。",
  "dividend.correcting": "正在用你的数字更正 {rowDate} 的分红：保存即替换它自己的数字。",
  "dividend.correctingMoved":
    "正在用你的数字更正 {rowDate} 的分红：保存即替换它自己的数字。它的日期保持 {rowDate} 不变——补记靠这一天找到它——所以 {typedDate} 不会被采用。",
  "dividend.movedOffDay":
    "这笔分红是应用除息日 {rowDate} 记下的，也靠这一天找到它。改到 {date} 后，{rowDate} 的分红会在下次启动时再次记入，除非这个账户有一期不早于那天的状况。",

  // --- 流水：种类、删除问句、表单用词 --------------------------------------
  "ledger.kind.buy": "买入",
  "ledger.kind.sell": "卖出",
  "ledger.kind.dividend": "分红",
  "ledger.kind.close": "清仓",
  "ledger.pacBadge": "定投",
  "ledger.deletePlain": "删除 {date} 的{kind}「{name}」？删掉就找不回来了。",
  "ledger.deleteDividend":
    "删除 {date} 的{kind}「{name}」？应用不会再在这个账户记录 {symbol} 在 {date} 的分红。如果券商确实付了，请改用对账单上的入账金额更正。",
  "ledger.deletePacLast":
    "删除 {date} 的{kind}「{name}」？它的定投不会再买入 {occurrence} 那一期。定投的结转归零，那笔钱留在账户现金里。如果券商确实买了，请改用对账单上的数字更正。",
  "ledger.deletePacKeeps":
    "删除 {date} 的{kind}「{name}」？它的定投在 {occurrence} 那一期还有另一笔买入会保留，这个基金不会再为那一期买入。定投的结转归零，那笔钱留在账户现金里。如果券商确实买了，请改用对账单上的数字更正。",
  "ledger.addBuy": "添加买入",
  "ledger.addSell": "添加卖出",
  "ledger.addDividend": "添加分红",
  "ledger.addKind": "添加{kind}",
  "ledger.recordDisposal": "记录清仓",
  "ledger.correctThis": "更正这一笔",
  "ledger.deleteFailed": "删除失败。",
  "ledger.noTransactions": "还没有流水。加一笔，或让定投和分红在启动时自动记入。",
  "ledger.feesLabel": "费用 {amount}",
  "ledger.ecbRate": "按 {date} 的参考汇率",
  "ledger.est": "估值",
  "ledger.thisAccount": "这个账户",

  // --- 自选清单（Watchlist.tsx、watchItem.ts）------------------------------
  "watch.title": "自选清单",
  "watch.hint":
    "看过并留下的标的。这里没有一样是已持有的：本页的任何合计、配置和现金流预测都不计入清单上的任何一行。",
  "watch.note":
    "条目来自对话。它只能点名本地名录里存在的基金，或雅虎收录的个股；每一行下面的三句话是它当时说的依据。",
  "watch.explainQ": "「记一笔买入」做什么？",
  "watch.explainT":
    "没有连接任何券商，所以「记一笔买入」就是字面意思：把基金或个股填进下面的流水表单，买多少、什么价、在哪里、什么时候由你填写。它不会清掉这一行（已经开始买第一笔的想法仍然是想法），用完了点 ✕ 丢掉即可。",
  "watch.empty": "自选清单是空的。问对话该看些什么，它的建议会带着理由落在这里。",
  "watch.loadError": "无法加载自选清单。后端是否在 :8000 上运行？",
  "watch.dropFailed": "没能丢掉这个想法。",
  "watch.drop": "丢掉这个想法",
  "watch.why": "为什么",
  "watch.becauseYouSaid": "因为你曾说",
  "watch.notKnown": "尚不知道",
  "watch.added": "加入于 {date}",
  "watch.share": "个股",
  "watch.fund": "基金",
  "watch.recordBuy": "记一笔买入",
  "watch.recordBuyTitle":
    "把这只{what}填进下面的流水表单：买多少、什么价、在哪里、什么时候由你填写",
  "watch.shareIdentity": "{symbol} · 个股，按雅虎的收录",
  "watch.prefillShare":
    "{symbol}：雅虎收录这只个股所用的代码，画卡片时核对过一次，你接受时又核对过一次。请确认它就是你买入的那一个上市地。买多少、什么价、在哪里也由你填写。记账不会动这一行：想法结束了就点 ✕ 丢掉它。",
  "watch.prefillFund":
    "{isin} · {symbol}：ISIN 标识这只基金；代码来自实时查询，请确认它就是你实际买入的那一个上市地。买多少、什么价、在哪里也由你填写。记账不会动这一行：想法结束了就点 ✕ 丢掉它。",
  "watch.prefillFundBare":
    "{isin}。它标识这只基金，但不能给它定价：你买入的那个上市地的代码仍要由你填写。买多少、什么价、在哪里也由你填写。记账不会动这一行：想法结束了就点 ✕ 丢掉它。",

  // --- 标的选择器（InstrumentPicker.tsx）----------------------------------
  "instrument.placeholder": "名称（输入以搜索）",
  "instrument.label": "标的名称",
  "instrument.owned": "你已经持有的持仓",
  "instrument.ownedHint": "加到它们里面，不是另开一笔",
  "instrument.heldAt": "持有于 {institution}",
  "instrument.live": "个股、ETF 与加密货币（实时）",
  "instrument.liveLooking": "查询中…",
  "instrument.liveOnly": "可报价代码的唯一来源",
  "instrument.liveDown": "实时来源没有回应。这不能说明这个标的不存在。",
  "instrument.liveDownTitle":
    "没有回应，和「这个标的不存在」是两回事。下面的名录一条是本地的，不受影响。",
  "instrument.onExchange": "在 {exchange}",
  "instrument.futuresWarn": "⚠ 有到期日的合约：会到期换月",
  "instrument.futuresWarnTitle":
    "期货合约会到期换月，钉在这个代码上的持仓几个月后衡量的已是另一张合约，却不会说明。",
  "instrument.funds": "基金与 ETF（UCITS 名录）",
  "instrument.fundsHint": "个股和加密货币不在其中",
  "instrument.partial": "并非每个词都命中。这些是最接近的，继续输入可以收窄。",
  "instrument.policyUnknown": "未知",
  "instrument.noMatch":
    "UCITS 基金名录里没有匹配。对个股、加密货币或美国注册的 ETF 来说这是预期答案而不是失败：自己输入名称和代码，下面的实时核对会确认它解析成了什么。",
  "instrument.useAsIs": "就用「**{value}**」，不附带名录里的任何信息",

  // --- 税务估算，摆在合计旁边（TaxEstimatePanel）---------------------------
  "portfolio.taxNoRate": "没有设置税率，所以这里不显示估算。",
  "portfolio.taxGain": "有一笔已实现收益 {amount}。",
  "portfolio.taxLoss": "已实现结果是亏损 {amount}，本来也不会对它征税。",
  "portfolio.taxGrossDividends": "{amount} 的分红仍显示市场的税前毛额。",
  "portfolio.taxSetRate": "在「档案 → 税务」里设置你的税率。",
  "portfolio.taxTitle": "预估税",
  "portfolio.taxTotal": "**{amount}** 为估算，上面的任何合计都不含它",
  "portfolio.taxNoTotal":
    "没有合计：你还没有为 {rates} 设置税率，只把能算出来的那一半加起来会低估它。",
  "portfolio.taxLossLine": "已实现结果是亏损 **{amount}**（没有对它估算什么）",
  "portfolio.taxGainLine": "已实现收益 {gain}，按 *{rate}%* = **{tax}**",
  "portfolio.taxDividendLine": "分红毛额 {gross}，按 *{rate}%* = **{tax}**",
  "portfolio.taxNetNote": " · 你手工更正过的 {net} 已是净额，保持不动",

  // --- 持仓部分 ------------------------------------------------------------
  "portfolio.title": "持仓",
  "portfolio.hint":
    "你的投资持仓（每个机构的最近一期状况）。刷新可拉取实时市价，并查看相对记录价值的盈亏。",
  "portfolio.loadError": "无法加载持仓。后端是否在 :8000 上运行？",
  "portfolio.pricing": "取价中…",
  "portfolio.refresh": "↻ 刷新市价",
  "portfolio.marketVsRecorded": "市值 **{market}** vs 记录 {book}",
  "portfolio.unknown": "未知",
  "portfolio.onPricedRows": "仅已定价的行",
  "portfolio.carriedOfTotal": "其中 {amount} 是你上次记录的数字，不是市价",
  "portfolio.recordedTotal": "记录合计 **{book}**",
  "portfolio.pricesAsOf": "价格截至 {date}（{age}）",
  "portfolio.fxAsOf": "参考汇率 {date}",
  "portfolio.realizedPL": "已实现盈亏 **{delta}**",
  "portfolio.dividendsCollected": " · 已收分红 {amount}",
  "portfolio.ageToday": "今天",
  "portfolio.ageDays": "{n} 天前",
  "portfolio.emptyTitle": "还没有投资",
  "portfolio.emptyBody":
    "先在「记账 → 资产」添加一个机构，再录入一期带日期的状况和其中的持仓。给每一项一个代码，这张表就会自己填满。",
  "portfolio.colAsset": "标的",
  "portfolio.colInstitution": "机构",
  "portfolio.colQty": "数量",
  "portfolio.colAvgCost": "平均成本",
  "portfolio.colRecorded": "记录",
  "portfolio.colLivePrice": "实时价格",
  "portfolio.colWorthNow": "现值",
  "portfolio.colPL": "盈亏 vs 记录",
  "portfolio.currencyNote": "⚠ {note}。以挂牌币种为准；去记账里改这个字段",
  "portfolio.staleUnpriceable": "取值于 {when}（{days} 天）：谁也无法给它定价，只有你能刷新",
  "portfolio.staleQty": "今天已定价，但距上次确认你持有这么多已过 {days} 天（{when}）",
  "portfolio.disposedOn": "{date} 已清仓，留在这里是为了让退出可见",
  "portfolio.noInstitutionTitle":
    "不在任何机构名下：没有一期状况能拍到它，也没有什么能确认它还在。目标未指明机构的定投会造出这种行。给下面的流水一行指定一个机构，就能把它挂上去。",
  "portfolio.noInstitution": "无机构",
  "portfolio.est": "估值",
  "portfolio.costUnknown": "成本未知",
  "portfolio.marketCloseOf": "{date} 的收盘价",
  "portfolio.worthCarriedTitle":
    "今天谁也无法给它定价：这是该持仓最后一次记录的价值，顺延至此",
  "portfolio.sinceSituation": "自本期状况起",
  "portfolio.tableNote":
    "*记录*是持仓的成本：你录入过的买入价，否则就是最近一期状况记录的价值（这时*平均成本*会写「成本未知」，因为那不是你付出的价格）。*现值*是另一个问题：市场给得出价就用市价，给不出就用该持仓最后一次记录的价值。*盈亏 vs 记录*只在真实报价给这一行定过价时才比较两者。对谁也无法定价的行，两列之差仍然可读，但一个月前的对账单不是市场，本应用不会把它染成绿色。刷新价格不再覆盖一期状况（那曾把盈亏强制归零）：要记下今天的数字，请记录一期新的状况。",

  // --- 穿透部分 ------------------------------------------------------------
  "portfolio.lookTitle": "穿透（真实暴露）",
  "portfolio.lookNote":
    "发行人自己公布持仓文件的用它们，其余用 justETF 和雅虎。缓存 15 天。",
  "portfolio.lookExplainQ": "什么是穿透？",
  "portfolio.lookExplainT":
    "你的基金里真正装着什么：国家、行业，以及你透过不止一只基金持有的发行人。",
  "portfolio.compositionError": "无法加载构成（来源可能不可达）。",
  "portfolio.fetching": "取数中…",
  "portfolio.updateComposition": "↻ 更新构成",
  "portfolio.coverage": "覆盖率 **{pct}** 的持仓已拆解",
  "portfolio.loadingComposition": "正在加载构成…",
  "portfolio.coverageTitle": "持仓里我们能看进去多少",
  "portfolio.decomposedPct": "已拆解 {pct}",
  "portfolio.coverageNote":
    "下面的百分比都是整个持仓的占比，所以它们加起来是已拆解的部分，不是 100%。",
  "portfolio.lookedInside": "已看进去",
  "portfolio.notDecomposed": "未能拆解",
  "portfolio.nothingYet": "还没有。",
  "portfolio.everythingCovered": "全都覆盖到了。",
  "portfolio.singleStocksNote":
    "个股和加密货币里面没有东西可看。列在这里的基金通常只缺它的 ISIN：在「记账 → 资产」里加到那笔持仓上。",
  "portfolio.countries": "国家（占持仓）",
  "portfolio.sectors": "行业（占持仓）",
  "portfolio.issuers": "发行人（占持仓）",
  "portfolio.currencyExposure": "货币暴露（占持仓）",
  "portfolio.noData": "无数据",
  "portfolio.matrixTitle": "资产类别 × 地区（占持仓）",
  "portfolio.class": "类别",
  "portfolio.currencyMethodNote":
    "货币暴露跟的是公司所属的国家，不是它在哪里赚取收入，并且忽略份额对冲：一只欧元对冲的基金仍会显示它所持资产的货币。",
  "portfolio.overlapTitle": "重叠：同一只股票出现在 2 只以上基金里",
  "portfolio.overlapNote":
    "对从发行人自己的持仓文件解析出来的基金是完整的；对第三方覆盖的基金只能看到公布的前十大持仓，所以那里的真实重叠更大。",
  "portfolio.via": "经由 {funds}",

  // --- 流水表单（BuysSection）----------------------------------------------
  "portfolio.ledgerTitle": "流水（记账）",
  "portfolio.ledgerHint": "你付出的，和拿回来的：真实利润只能从这里来。",
  "portfolio.ledgerNote":
    "这里没有买入的话，上面的盈亏衡量的是自最近一期状况以来的变动，不是收益。标为「估值」的行来自市场收盘价或分红毛额。请用券商的真实金额更正它们。",
  "portfolio.ledgerExplainQ": "卖出和分红怎么算？",
  "portfolio.ledgerExplainT":
    "卖出按平均成本扣减份额，差额入账；分红计入现金。",
  "portfolio.noCash": "没有现金记录",
  "portfolio.cashAvailable": "可用 {amount}",
  "portfolio.instTitle": "持仓在哪里，以及用谁的现金支付",
  "portfolio.instWhere": "你放在哪里？",
  "portfolio.instAdd": "+ 添加你存放它的地方",
  "portfolio.assetPlaceholder": "标的（输入以搜索）",
  "portfolio.pickNoteTicker": "{isin}：代码仍要由你给出。",
  "portfolio.pickNoteCheck": "{symbol}：请核对它与你要加到的持仓一致。",
  "portfolio.tickerPlaceholder": "代码或 ISIN",
  "portfolio.tickerTitle":
    "带交易所后缀的雅虎代码（如 VWCE.MI）或基金的 ISIN。它必须与「资产」里该持仓的代码一致",
  "portfolio.qtyLabel": "数量",
  "portfolio.qtyPlaceholder": "数量",
  "portfolio.priceLabel": "价格",
  "portfolio.perShareLabel": "每股分红",
  "portfolio.currencyPlaceholder": "币种",
  "portfolio.priceCurrencyTitle":
    "价格所用的币种：即挂牌币种（纽约的股票是 USD，伦敦的便士是 GBp）",
  "portfolio.priceOnDate": "↻ 当日价格",
  "portfolio.proceedsPlaceholder": "回款",
  "portfolio.feesPlaceholder": "费用",
  "portfolio.proceedsTitle":
    "拿回来了多少。允许为零，但必须说出来：这就是卖出一件东西和把它忘掉的区别。",
  "portfolio.feesTitle": "券商费用与佣金",
  "portfolio.proceedsCurrencyTitle": "回款进入账户时的币种",
  "portfolio.accountCurrencyTitle": "账户的币种：费用和划转的钱用的是它",
  "portfolio.debitedIn": "以 {currency} 扣款",
  "portfolio.creditedIn": "以 {currency} 入账",
  "portfolio.debitDerived": "留空则为 {amount}",
  "portfolio.debitTitle":
    "账户实际划转了多少，来自你的对账单。留空则由数量、价格和费用算出（跨两种币种时按上面日期的参考汇率，你的券商汇率会略有出入）。",
  "portfolio.priceNote": "{name}，{date} 收盘：{price}{currency}。若你的成交价不同，请修改。",
  "portfolio.noPrice": "那个代码在那天没有找到价格。",
  "portfolio.couldNotAdd": "没能加进去。",
  "portfolio.newInstName": "银行或券商的名称",
  "portfolio.newInstType": "类型（可选）",
  "portfolio.addAndUse": "添加并使用",
  "portfolio.newInstNote":
    "它会加入「记账 → 资产」的列表，你可以在那里给它现金余额和各期状况。",
  "portfolio.overspend":
    "这比 {institution} 记录的 {amount} 还多。仍然记录了。如果余额只是没跟上，在「记账 → 资产」里的现金锚点说明即可。",
};
