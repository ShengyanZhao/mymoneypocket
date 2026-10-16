/* Profile & goals: the Chinese half of the staging catalogue.

   Typed as `Record<keyof typeof profileEn, string>`, so the compiler reports
   every key missing here and every key spelled wrong. Keep every
   `{placeholder}`; Chinese has no one/two of a count, so no `|`. */

import type { profileEn } from "./profile.en.ts";

export const profileZh: Record<keyof typeof profileEn, string> = {
  // --- 本页 -----------------------------------------------------------------
  "profile.title": "档案与目标",
  "profile.intro":
    "一份简短的问卷，把你的背景交给 Aurelio。内容保存在你的机器上；当你运行分析或向对话提问时，会经 OpenRouter 发给 AI 模型。",
  "profile.save": "保存档案",
  "profile.saving": "保存中…",
  "profile.saved": "已保存 ✓",
  "profile.choose": "请选择…",

  // --- 本表单没有问到的答案 -------------------------------------------------
  "profile.otherTitle": "其他答案",
  "profile.otherIntro":
    "本表单没有问到的问题的答案，记录在对话里。对话和分析会像其他答案一样读取它们：可以在这里修改或删除，然后保存。",
  "profile.deletedWhenSave": "保存时将删除：",
  "profile.keepIt": "保留",

  // --- 所有合计的本位币 -----------------------------------------------------
  "profile.baseTitle": "本位币",
  "profile.baseHelp":
    "所有合计都以这种货币显示：你的净资产、它的历史、每一个换算后的数字。改动它会让所有数字移动，历史也包括在内：这是同一笔财富换一个单位来度量，按每个数字自己那一天的参考汇率换算。你记下的内容不会被改写：每笔金额仍保持你输入时的货币，按当日定下的收支或转账也保持原样。",
  "profile.baseShowIn": "合计显示为",
  "profile.baseSwitch":
    "保存会把所有合计从 {current} 切换到 {picked}。会先获取对 {picked} 的汇率；如果行情源无法访问，什么都不会改变。",
  "profile.baseOnlyOne": "行情源还没有响应，所以目前只有 {current} 可选。",

  // --- 税 -------------------------------------------------------------------
  "profile.taxTitle": "税",
  "profile.taxHelp":
    "你自己的税率，用于显示在持仓数字旁边的估算。Aurelio 从不把税算进合计：不进净资产，也不进账面价值。不知道的字段留空即可：这和填 0 不同，估算会说明哪一半算不出来。",
  "profile.taxCountryLabel": "你在哪里缴纳投资税？",
  "profile.taxCountryPlaceholder": "任意国家（在下面自己填税率也一样管用）",
  "profile.taxMatch": "{country}：{regime}（收益 {cg}%，分红 {div}%）。",
  "profile.taxUseThese": "以此为起点",
  "profile.taxCgLabel": "资本利得税率",
  "profile.taxCgHint": "适用于卖出时已实现的收益",
  "profile.taxDivLabel": "分红预扣税率",
  "profile.taxDivHint": "仅适用于仍按市场毛额显示的分红",
  "profile.taxNothingSet":
    "尚未设置，因此任何地方都不会显示税费估算：不是 0，也不是默默省略。持仓页会说明它缺了什么。",
  "profile.rateNotSet": "未设置",

  // --- 表单显示不了的答案 ---------------------------------------------------
  "survey.unshown.boolean":
    "记录在案：\"{value}\"，它不是这些答案中的任何一个。按一个来替换它；不选就保存的话，它会保持原样。",
  "survey.unshown.single":
    "记录在案：\"{value}\"，它不是这些选项中的任何一个。选一个来替换它；不选就保存的话，它会保持原样。",
  "survey.unshown.number":
    "记录在案：\"{value}\"，它不是一个数字。输入一个来替换它；不填就保存的话，它会保持原样。",

  // --- 问卷 -----------------------------------------------------------------
  "survey.topic.about": "关于你",
  "survey.topic.financial_literacy": "理财常识",
  "survey.topic.family": "家庭",
  "survey.topic.housing": "住房与城市",
  "survey.topic.career": "职业与收入",
  "survey.topic.purchases": "大额支出",
  "survey.topic.retirement": "退休与期限",
  "survey.topic.risk": "风险与价值观",
  "survey.topic.words": "你自己的话",
  "survey.topic.lifestyle": "生活方式",

  "survey.opt.yes": "是",
  "survey.opt.no": "否",
  "survey.opt.unsure": "不确定",
  "survey.opt.employee": "受雇",
  "survey.opt.selfEmployed": "自雇",
  "survey.opt.businessOwner": "企业主",
  "survey.opt.student": "学生",
  "survey.opt.retired": "已退休",
  "survey.opt.notWorking": "没有工作",
  "survey.opt.single": "单身",
  "survey.opt.couple": "伴侣",
  "survey.opt.familyChildren": "有子女的家庭",
  "survey.opt.other": "其他",
  "survey.opt.rent": "租房",
  "survey.opt.ownMortgage": "自有（有按揭）",
  "survey.opt.ownOutright": "自有（无按揭）",
  "survey.opt.liveWithFamily": "与家人同住",
  "survey.opt.under2years": "不到 2 年",
  "survey.opt.twoToFiveYears": "2–5 年",
  "survey.opt.over5years": "5 年以上",
  "survey.opt.low": "低",
  "survey.opt.medium": "中",
  "survey.opt.high": "高",
  "survey.opt.certainLoss500": "确定损失 500 ¥",
  "survey.opt.gamble1000": "五五开：损失 1000 ¥ 或毫无损失",

  "survey.q.about_country": "你住在哪个国家？",
  "survey.q.about_area": "哪个城市或地区？",
  "survey.q.about_age": "你的年龄？",
  "survey.q.about_employment": "就业状况？",
  "survey.q.about_household": "家庭状况？",
  "survey.q.about_dependents": "有多少人在经济上依赖你？",
  "survey.q.about_home": "你的住房状况？",
  "survey.q.lit_why_invest": "你知道人们为什么要投资吗？",
  "survey.q.lit_inflation": "你知道通货膨胀是什么吗？",
  "survey.q.lit_risk_return": "你知道风险与回报的取舍吗？",
  "survey.q.lit_diversification": "你知道分散投资是什么吗？",
  "survey.q.fam_want": "你想要成家或扩大家庭吗？",
  "survey.q.fam_when": "大致在什么时候？",
  "survey.q.fam_children": "你计划要几个孩子？",
  "survey.q.home_buy": "你打算买房吗？",
  "survey.q.home_when": "什么时候？",
  "survey.q.home_city": "有没有你想搬去或定居的城市／地区？",
  "survey.q.career_change": "你预计近期职业或收入会有重大变化吗？",
  "survey.q.career_detail": "简单说，是什么变化？",
  "survey.q.big_purchase": "有大额支出计划吗（买车、装修……）？",
  "survey.q.big_purchase_detail": "买什么，大约什么时候？",
  "survey.q.ret_age": "你希望在什么年龄退休或实现财务独立？",
  "survey.q.risk_tolerance": "你会怎样描述自己的风险承受度？",
  "survey.q.risk_loss_choice":
    "你会选哪一个：确定损失 500 ¥，还是五五开——损失 1000 ¥ 或毫无损失？",
  "survey.q.values_esg": "伦理／ESG 考量对你的投资重要吗？",
  "survey.q.self_narrative":
    "自由地写写你自己和你的钱：你在为什么努力，什么让你担心，你绝不会放弃什么，你希望 Aurelio 怎么和你说话。这里的内容不校验也不打分：它只是背景。",
  "survey.q.lifestyle_notes": "关于你的状况、习惯或计划，还有什么 Aurelio 应该知道的吗？",

  "survey.explain.lit_why_invest":
    "投资让储蓄随时间增长，并抵御通货膨胀：闲着的钱每年都在损失购买力。把钱投向能产生回报的资产，你的资本就有机会增长并跑赢通胀，代价是承担一些风险。",
  "survey.explain.lit_inflation":
    "通货膨胀是物价随时间的普遍上涨：同样的钱，明天买到的东西比今天少。按每年 3% 计，一年后 100 ¥ 的购买力大约只剩 97 ¥——这就是闲钱会「贬值」的原因。",
  "survey.explain.lit_risk_return":
    "更高的潜在回报通常意味着要承受更多风险（起伏、可能的亏损）。不存在又高、又有保障、又无风险的回报。有人这样承诺时要当心。",
  "survey.explain.lit_diversification":
    "分散投资就是不要把所有鸡蛋放在一个篮子里。把资金分散到不同的工具、行业和地区，能降低某一笔糟糕投资拖垮全部的可能。",

  // --- 目标 -----------------------------------------------------------------
  "goals.title": "目标",
  "goals.hint": "选一个稳妥的目标类型，或者设定具体目标（金额＋日期），看看它要求的年化回报。",
  "goals.type.protect_inflation": "抵御通胀",
  "goals.type.stable_income": "稳定／被动收入",
  "goals.type.long_term_growth": "长期增长",
  "goals.type.emergency_fund": "应急金",
  "goals.type.target_amount": "在某日期前达到目标金额",
  "goals.type.other": "别的（请描述）",
  "goals.typePlaceholder": "这个目标是为了什么？…",
  "goals.detailPlaceholder": "细节（可选），例如米兰公寓",
  "goals.targetPlaceholder": "目标金额",
  "goals.currentPlaceholder": "当前已有",
  "goals.monthlyPlaceholder": "每月投入",
  "goals.currencyPlaceholder": "币种",
  "goals.currencyTitle":
    "目标金额、已有金额和每月投入所用的币种。默认按你的本位币提议；改过之后就按你填的来。",
  "goals.save": "保存目标",
  "goals.add": "添加目标",
  "goals.empty": "还没有目标。",
  "goals.deleteConfirm": "删除目标「{name}」？",
  "goals.deleteFailed": "删除失败。",
  "goals.targetSubtitle": "{date} 前达到 {amount}",
  "goals.rateUnreachable": "无法达到",
  "goals.ratePerYear": "{pct}%／年",
  "goals.requiredReturn": "大约 {years} 年内，这需要 **{rate}** 的回报。{assessment}",
  "goals.assess.pastDate": "目标日期已经过去了。",
  "goals.assess.unreachable": "按目前的投入，目标实际上无法达到。增加投入，或延长期限。",
  "goals.assess.onTrack": "即使投资不增长，也已经走在正轨上。",
  "goals.assess.conservative": "保守：低风险配置即可实现。",
  "goals.assess.moderate": "适中：与分散的长期投资组合相符。",
  "goals.assess.aggressive": "激进：风险很高，没有保证。",
  "goals.assess.unrealistic": "不现实：考虑延长期限、增加投入，或降低目标。",
};
