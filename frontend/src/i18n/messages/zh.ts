/* The Chinese catalogue.

   Typed as `Record<MessageKey, string>` rather than `as const`, so the
   compiler reports every key missing here and every key spelled wrong. It is
   the only file a translator touches: English stays the source of truth for
   WHICH words exist, this one only for what they are called in Chinese.

   Notes a translator needs:
     - `|` splits the one/two of a count. Chinese has no such distinction, so
       write a single form and leave the `|` out — `t` uses the value whole.
     - `*em*` and `**strong**` marks survive translation; put them where
       Chinese wants the marked word, not where English had it.
     - Keep every `{placeholder}`. The number or name a sentence is about has
       to arrive in the sentence whatever the word order around it is. */

import type { MessageKey } from "./en";
import { portfolioZh } from "./staging/portfolio.zh.ts";
import { profileZh } from "./staging/profile.zh.ts";
import { recordsZh } from "./staging/records.zh.ts";

export const zh: Record<MessageKey, string> = {
  // --- 共用词，多处出现 ---------------------------------------------------
  "common.save": "保存",
  "common.cancel": "取消",
  "common.add": "添加",
  "common.edit": "编辑",
  "common.delete": "删除",
  "common.loading": "加载中…",
  "common.dismiss": "关闭",
  "common.refreshPrice": "刷新价格",
  "common.refreshPriceTitle": "从市场刷新价格",
  "common.saveFailed": "保存失败。",
  "common.backendDown": "后端没有响应。它是否在 :8000 上运行？",
  "common.na": "无",

  // --- 导航 ----------------------------------------------------------------
  "nav.tabs.dashboard": "总览",
  "nav.tabs.portfolio": "持仓",
  "nav.tabs.records": "记账",
  "nav.tabs.profile": "档案",
  "nav.pages.wealth": "资产",
  "nav.pages.real": "实物资产",
  "nav.pages.debts": "负债",
  "nav.pages.cash": "现金流",

  // --- 聊天侧栏，以及旁边的切换 -------------------------------------------
  "chat.rail.open": "打开对话",
  "chat.rail.close": "关闭对话",
  "chat.rail.ask": "问 Aurelio",
  "chat.rail.askTitle": "就你的财务问 Aurelio",
  "lang.label": "语言",
  "lang.en": "EN",
  "lang.zh": "中文",
  "currency.label": "货币",
  "currency.failed": "无法更改货币。",

  // --- 补记横幅 ------------------------------------------------------------
  "pac.purchases": "{count} 笔定投买入",
  "pac.dividends": "{count} 笔分红",
  "pac.joined": "{parts}",
  "pac.recorded": "{parts} 已自动记账（标为*估值*：若与实际金额不符请更正）。",
  "pac.review": "去持仓查看",
  "pac.skipped": "{count} 次计划被跳过（{reason}{more}）。下次启动会重试。",

  // --- 表单必填词 ----------------------------------------------------------
  "forms.listTwo": "{a}和{b}",
  "forms.listMany": "{head}、{last}",
  "forms.refusal": "请填写{list}。",
  "forms.noun.name": "名称",
  "forms.noun.amount": "金额",
  "forms.noun.date": "日期",
  "forms.noun.currency": "币种",
  "forms.noun.ticker": "代码",
  "forms.noun.theTicker": "代码",
  "forms.noun.ends": "转出方或转入方",
  "forms.noun.goalType": "目标用途",
  "forms.noun.goalName": "目标内容",
  "forms.noun.cash": "现金",
  "forms.noun.value": "价值",
  "forms.noun.balance": "余额",
  "forms.noun.budget": "预算",
  "forms.noun.source": "出资账户",
  "forms.noun.quantity": "数量",
  "forms.noun.price": "价格",
  "forms.noun.asset": "标的",
  "forms.noun.institution": "机构",
  "forms.noun.proceeds": "回款",
  "forms.noun.dividendPerShare": "每股分红",
  "forms.ask.institution": "哪家银行或券商？",
  "forms.ask.name": "叫什么名字？",
  "forms.ask.income": "是什么？例如工资",
  "forms.ask.expense": "是什么？例如房租",
  "forms.ask.amount": "多少钱？",
  "forms.ask.realAsset": "是什么？例如米兰公寓",
  "forms.ask.debt": "是什么？例如车贷",
  "forms.ask.goalName": "目标是什么？",
  "forms.ask.cash": "多少钱？",
  "forms.ask.value": "估值多少？",
  "forms.ask.balance": "还剩多少？",
  "forms.ask.budget": "多少钱？",
  "forms.ask.ticker": "哪个代码？",
  "forms.ask.search": "是什么？（输入以搜索）",
  "forms.ask.quantity": "多少份？",
  "forms.ask.price": "价格？",
  "forms.ask.worth": "价值？",
  "forms.ask.proceeds": "回款？",
  "forms.ask.perShare": "每股多少？",
  "forms.says.realAssetCurrency": "请说明这项资产以什么币种估值。",
  "forms.says.debtCurrency": "请说明这笔负债是什么币种。",
  "forms.says.goalCurrency": "请说明这个目标是什么币种。",
  "forms.says.ends": "请选择转出方和／或转入方机构。",
  "forms.says.currenciesMoved": "请说明各自的币种：从转出方扣了多少，转入方入账了多少。",
  "forms.says.currenciesTraded": "请说明各自的币种：价格用的是哪种，账户里划转的又是哪种。",
  "forms.says.source": "定投必须从某个地方扣钱：请指明出资账户，这样每期投入才会真正从余额里划走。",
  "forms.says.buyFrom": "买入必须有来处：请选你持有它的账户，这样现金才会从正确的账户划出。",
  "forms.says.sellHeldAt": "卖出必须注明持有地点：请选机构，这样现金才会进正确的账户。",
  "forms.says.dividendHeldAt": "分红必须注明持有地点：请选机构，这样现金才会进正确的账户。",
  "forms.says.closeHeldAt": "清仓必须注明持有地点：请选机构，这样现金才会进正确的账户。",

  // --- 一个数字背后的解释 --------------------------------------------------
  "ui.savingsRate.question": "什么是储蓄率？",
  "ui.savingsRate.text": "月收入扣除支出后剩下的比例。",

  // --- 月度数字漏掉了什么 --------------------------------------------------
  "inForce.intro": "按今天的实际存续计算，为月度口径；一次性项目不计。",
  "inForce.incomes": "{count} 笔收入",
  "inForce.expenses": "{count} 笔支出",
  "inForce.startsLater": "{nouns}尚未开始",
  "inForce.hasEnded": "{nouns}已经结束",
  "inForce.join": "{a}，{b}",
  "inForce.notCounted": "未计入：{what}，详情见「记账 → 现金流」。",
  "inForce.undated": "{count} 笔没有首次付款日期的流水，已按存续计入。",
  "inForce.onceOn": "{date} 一次性发生，不计入月度数字。",
  "inForce.startsOn": "{date} 起才开始：在此之前不计入。",
  "inForce.endedOn": "{date} 结束：之后不再计入。",

  // --- 总览页 --------------------------------------------------------------
  "dashboard.loadError": "无法加载总览。后端是否在 :8000 上运行？",
  "dashboard.netWorth": "净资产",
  "dashboard.sinceUp": "较 {date} 增加 {amount}",
  "dashboard.sinceDown": "较 {date} 减少 {amount}",
  "dashboard.latestData": "数据截至 {date} · ",
  "dashboard.counts": "{institutions} 个机构 · {realAssets} 项实物资产 · {debts} 笔负债",
  "dashboard.investments": "投资",
  "dashboard.cash": "现金",
  "dashboard.realAssets": "实物资产",
  "dashboard.debts": "负债",
  "dashboard.carriedNote": "其中 {amount} 沿用上一期状况，未按市价估值",
  "dashboard.emptyTitle": "暂时没有内容",
  "dashboard.emptyBody":
    "从「记账 → 资产」开始，先录入一个机构和一期带日期的状况。本页的图表只从你在那里记下的内容绘制，不来自别处。",
  "dashboard.netWorthOverTime": "净资产走势",
  "dashboard.netWorthOverTimeSub": "悬停查看每个点背后的金融／实物／负债构成。",
  "dashboard.date": "日期",
  "dashboard.financial": "金融资产",
  "dashboard.real": "实物",
  "dashboard.allocation": "配置",
  "dashboard.allocationSub": "共 {total}，分 {count} 类",
  "dashboard.class": "类别",
  "dashboard.value": "市值",
  "dashboard.share": "占比",
  "dashboard.monthlyCashFlow": "月度现金流",
  "dashboard.income": "收入",
  "dashboard.expenses": "支出",
  "dashboard.net": "净额",
  "dashboard.cashBreakdown":
    "收入：主动 {active} · 被动 {passive}。支出：必要 {essential} · 可选 {discretionary}。",
  "dashboard.notCounted": "未计入：{what}，详情见「记账 → 现金流」。",
  "dashboard.chart": "图表",
  "dashboard.table": "表格",
  "dashboard.savingsRate": "储蓄率",
  "dashboard.savingsRateNone": "数据还不够。",
  "dashboard.savingsRateDown": "入不敷出",
  "dashboard.savingsRateThin": "余地很薄",
  "dashboard.savingsRateHealthy": "健康",

  // --- 重复事项的首次日期（firstDate.ts） ---------------------------------
  "firstDate.pastOne": "向你的记录写入一笔买入，日期为 {date}",
  "firstDate.pastMany": "向你的记录写入 {count} 笔买入，日期从 {first} 到 {last}",
  "firstDate.leadChanged": "这次改动会写入今天之前的日期。",
  "firstDate.leadPast": "{start} 已是过去的日期。",
  "firstDate.body":
    "这样保存的话，应用会{what}，价格用 Yahoo 的收盘价而不是券商的成交价，并标为估值。",
  "firstDate.alternative":
    "计划其实已经在券商那里跑着？那就让今天以前都算券商的：把计划改到下一期开始，再在账户页按对账单录入今天的份额和现金。",
  "firstDate.startOn": "从 {date} 开始",
  "firstDate.startsLine": "将从 {date} 开始。保存之后，请在账户页按券商对账单录入今天的份额和现金。",
  "firstDate.afterSave":
    "{name} 将从 {start} 开始。请按券商对账单录入今天的状况和现金余额（状况从上一期复制，这样其他持仓才会保留）：",
  "firstDate.flowFirst": "首次付款",
  "firstDate.paymentNote":
    "首次付款的那一天，就是以后每次重复的那一天。日期在过去也没关系：账户最新余额之前的付款已经算在里面了。",
  "firstDate.planDate": "首次买入",
  "firstDate.planNote":
    "每个日期的买入，会在那天之后应用第一次打开时写入，按当日收盘价（基金以其他货币交易时按当日参考汇率折算），并标为估值。",

  // --- 一天一笔金额（DatedAmountEditor） ----------------------------------
  "dated.noun.cashAnchor": "现金锚点",
  "dated.noun.balance": "余额",
  "dated.noun.valuation": "估值",
  "dated.confirmDelete": "删除 {date} 的{noun}？",
  "dated.saveError": "保存失败（该日期可能已有{noun}）。",
  "dated.date": "日期",
  "dated.currencyPlaceholder": "币种",
  "dated.currencyTitle": "这笔金额用的币种。默认按该日期在效的锚点建议；改过之后就按你输入的为准。",
  "dated.noAnswer": "没有得到回答。",

  // --- 状况里凭空少掉的价值（OmissionsNotice） ----------------------------
  "omitted.title":
    "新一期状况不再核算这些，它们的价值因此离开了合计，而记录里没有任何内容说明它去了哪里。卖出是一句有日期、有回款的陈述；遗忘则什么陈述也没有。",
  "omitted.lead": "**{total}** 离开了合计，却没有留下去向 ·",
  "omitted.unitsOf": "{units} 份 {name}",
  "omitted.lastSeen": "最后见到于 {date}",
  "omitted.lastSeenBetween": "最后见到于 {first} 至 {last} 之间",
  "omitted.nameSeen": "{name}，最后见到于 {date}",
  "omitted.arrived": "在同一期状况里以应用不认识的名字申报了别的东西",
  "omitted.declaredOn": "{name}，申报于 {date}",
  "omitted.sameHoldings": "是同一批持仓，只是写全了？",
  "omitted.footer": "已卖出 → 记一笔**清仓**{where}。误删 → 把它加回来。",
  "omitted.inPortfolio": "，去持仓页",

  // --- 没有汇率能折算的金额（UnconvertedNotice） --------------------------
  "unconverted.title":
    "这些货币没有已知的汇率，因此以它们记下的每一笔金额都按面值计入，仿佛已经是本位币。上面的数字因此不止一种单位。",
  "unconverted.amounts": "{currency} 的 {count} 笔金额",
  "unconverted.noCurrency": "未注明币种",
  "unconverted.asWritten": "账面写的 {amount}",
  "unconverted.rate": "在这里没有汇率，因此每笔在上面出现的地方都按面值计入。",
  "unconverted.note":
    "这些合计是各行相加的结果，不是上面哪个数字错了多少：成本和它所属的价值算在一起，负债在这里加、在那里减。代码打错了 → 在那一行改掉。没有参考汇率的真实货币 → 谁也折算不了，上面的数字就是和 {baseCurrency} 并存的多种单位。",

  // --- 删除一行时的问句，以及没能说出口的部分 -----------------------------
  "del.movesUnknown": "没能算出删除会挪动什么：{reason}",
  "del.deleteFailed": "删除失败。",

  // --- 基金目录还没到齐的时候 --------------------------------------------
  "catalogue.downloading": "基金目录正在自动下载。到齐后基金就会出现在这里。{meanwhile}",
  "catalogue.failed": "没能从 justETF 下载基金目录。应用会在下次打开或刷新时自动再试。{meanwhile}",
  "catalogue.failedFrom": "没能从 justETF 下载基金目录。应用会在下次打开或刷新时自动再试，从 {time} 起。{meanwhile}",
  "catalogue.notStarted": "应用打开时会自动下载基金目录。刷新页面即可开始。{meanwhile}",
  "catalogue.meanwhile": "在此期间，你输入的内容可以照常使用。",

  // --- 后端发来的代码，念成词 ---------------------------------------------
  "code.bank": "银行",
  "code.broker": "券商",
  "code.insurance": "保险",
  "code.pension_fund": "养老金",
  "code.crypto_exchange": "加密交易所",
  "code.other": "其他",
  "code.cash": "现金",
  "code.equity": "股票",
  "code.bond": "债券",
  "code.fund_etf": "基金／ETF",
  "code.crypto": "加密货币",
  "code.real_estate": "房地产",
  "code.commodity": "大宗商品",
  "code.vehicle": "车辆",
  "code.collectible": "收藏品",
  "code.jewelry": "珠宝",
  "code.art": "艺术品",
  "code.etf": "ETF",
  "code.cryptocurrency": "加密货币",
  "code.future": "期货",
  "code.index": "指数",

  // --- 各页文案，来自 staging 分册 ---------------------------------------
  ...profileZh,
  ...portfolioZh,
  ...recordsZh,
};
