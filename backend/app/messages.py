"""The words the backend says, in both languages it says them in.

Two dictionaries that must name exactly the same keys. `EN` is the source of
truth for WHICH words exist — it was written first, and it is what the tests
that pin behaviour were written against. `ZH` is only what they are called in
Chinese. `tests/test_i18n.py` fails if they drift apart, so a message cannot
exist in one language and not the other.

WRITING A NEW MESSAGE.

  1. Add it to `EN` first, with every `{placeholder}` the sentence needs.
  2. Add the same key to `ZH`, keeping every placeholder. Chinese may reorder
     them and may drop the `|` count split (it has one form for one and many),
     but may not drop a placeholder: the number a sentence is about has to
     arrive in the sentence whatever the word order around it is.
  3. Say it with `t("namespace.key", placeholder=...)`.

KEYS ARE NAMESPACED by what the reader is looking at: `errors.*` for a failed
request, `survey.*` for the Profile questions, `cards.*` for what a chat card
says it will do, `tax.*` for the estimate's caveats. A flat map, not nested:
one `str` key per message is the shape that both a translator and a `grep` can
follow.

MARKS: none. These strings arrive as API payloads (`detail`, a card's
`title`, a survey question), never as JSX, so there is nothing to mark up.
Placeholders are `{name}`.
"""

from __future__ import annotations

EN: dict[str, str] = {
    # --- a request that could not be answered -----------------------------
    "errors.not_found": "{label} {id} not found",
    "errors.already_valued":
        "A valuation for real asset {id} on {date} already exists",
    "errors.already_valued_plain": "A valuation for this asset and date already exists",
    "errors.already_anchored":
        "A cash anchor for institution {id} on {date} already exists",
    "errors.already_balanced":
        "A balance for liability {id} on {date} already exists",
    "errors.already_snapshotted": "{institution} already has a situation on {date}",
    "errors.no_snapshot_yet":
        "Institution {id} has no situation yet, so there is nothing to start from",
    "errors.no_symbol": "This holding has no symbol/ticker to fetch a price for",
    "errors.chat_gone": "Chat conversation {id} not found",
    "errors.card_gone": "Chat card {id} not found",
    "errors.decision_taken": "That card was already {exc}. A decision is taken once.",
    "errors.catalogue_failed": "Could not download the instrument catalogue: {exc}",

    # --- a body that could not be accepted --------------------------------
    "errors.date_in_the_future":
        "{date} has not happened yet: today is {today}. A situation, a valuation "
        "and a balance are all OBSERVATIONS of something that already happened.",
    "errors.currency_missing":
        "say which currency this is in (e.g. EUR, USD) — a figure with no unit "
        "cannot be converted or compared",
    "errors.currency_unknown": "'{code}' is not a currency code the rate feed quotes",

    # --- the words a label is read out as ---------------------------------
    "label.institution": "Institution",
    "label.plan": "Accumulation plan",
    "label.goal": "Goal",
    "label.real_asset": "Real asset",
    "label.liability": "Liability",
    "label.holding": "Holding",
    "label.income_source": "Income source",
    "label.expense": "Expense",
}

ZH: dict[str, str] = {
    # --- 请求没能完成 ------------------------------------------------------
    "errors.not_found": "找不到{label} {id}",
    "errors.already_valued": "实物资产 {id} 在 {date} 已有一条估值记录",
    "errors.already_valued_plain": "这项资产在该日期已有一条估值记录",
    "errors.already_anchored": "机构 {id} 在 {date} 已有一条现金锚点",
    "errors.already_balanced": "负债 {id} 在 {date} 已有一条余额记录",
    "errors.already_snapshotted": "{institution} 在 {date} 已经有一期状况",
    "errors.no_snapshot_yet": "机构 {id} 还没有任何一期状况，没有可以起算的内容",
    "errors.no_symbol": "这条持仓没有可用来取价的代码／ISIN",
    "errors.chat_gone": "找不到对话 {id}",
    "errors.card_gone": "找不到卡片 {id}",
    "errors.decision_taken": "这张卡片已经是「{exc}」了。一个决定只能做一次。",
    "errors.catalogue_failed": "无法下载标的目录：{exc}",

    # --- 请求内容没能通过校验 --------------------------------------------
    "errors.date_in_the_future":
        "{date} 还没有到：今天是 {today}。状况、估值和余额都应当是对已发生事实的"
        "「观测」。",
    "errors.currency_missing": "请说明这是什么币种（如 EUR、USD）——没有单位的数字无法换算或比较。",
    "errors.currency_unknown": "「{code}」不是汇率数据源提供的币种代码",

    # --- 一个标签念成什么 --------------------------------------------------
    "label.institution": "机构",
    "label.plan": "定投计划",
    "label.goal": "目标",
    "label.real_asset": "实物资产",
    "label.liability": "负债",
    "label.holding": "持仓",
    "label.income_source": "收入来源",
    "label.expense": "支出",
}
