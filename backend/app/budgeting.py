"""What a month's spending reached, and what to say about it (PRD v3 §4.2).

预算与月度复盘. The module answers three questions and never a fourth: how
much of a budget is gone (`budget_overview`), where a month's money actually
went (`month_actuals`), and what a reader should look at (`month_review`).
It decides nothing and blocks nothing — a budget is a plan, and spending is
a fact.

One accounting rule, borrowed rather than rewritten: when a recurring flow
and a statement entry describe the SAME payment, the entry speaks for it.
That is `analytics._covered_by_entries`, the cash register's own rule, and
reusing it is why a rent paid by import and a rent paid by standing order
land in the same place — counted once, on the day the money moved.

The review is COMPUTED every time it is read, from the rows themselves. A
stored review could disagree with a corrected entry; this one cannot, and
its attributions name the very rows they came from (`entry_ids`) so the
reader can see the sentence and its evidence together."""

from __future__ import annotations

import datetime
import json
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import analytics, fx, models

# How far the coverage window reaches past a month's edges: a payment due on
# the 28th and carried by an entry dated the 1st of the next month is still
# THAT payment, and the rule's own width is the honest reach.
_COVER_PAD = datetime.timedelta(days=analytics._COVER_WINDOW_DAYS)

# The longest history a rollover budget will chain through. A budget left on
# for years does not make its surplus a research project.
_ROLLOVER_CAP = 12


def month_window(month: str) -> tuple[datetime.date, datetime.date]:
    """(first day, last day) of a "YYYY-MM" month."""
    year, mon = (int(p) for p in month.split("-"))
    first = datetime.date(year, mon, 1)
    last = datetime.date(year + (mon == 12), mon % 12 + 1, 1) - datetime.timedelta(days=1)
    return first, last


def prev_month(month: str) -> str:
    first = month_window(month)[0]
    return (first - datetime.timedelta(days=1)).strftime("%Y-%m")


def _month_actuals_where(month: str):
    lo, hi = month_window(month)
    return lo, hi


def month_actuals(
    db: Session, month: str, conv: fx.Converter | None = None
) -> dict:
    """What actually moved in `month`, per category, in the base currency.

    Two voices, one payment each. FLEXIBLE is the statement lane: entries
    dated in the month. FIXED is the recurring lane's payments of the month
    that no entry carried — the rent on a standing order, the salary no
    import ever described. Where an entry carries a flow's payment the entry
    wins (its date and its exact sum are the truer ones) and the flow's
    occurrence counts nothing: the same rule the cash register projects by,
    so the budget and the balance cannot tell two stories."""
    if conv is None:
        conv = fx.Converter(db)
    in_base = conv.to_base_or_as_stored
    lo, hi = _month_actuals_where(month)

    rows = list(
        db.scalars(
            select(models.CashEntry)
            .where(
                models.CashEntry.date >= (lo - _COVER_PAD).isoformat(),
                models.CashEntry.date <= (hi + _COVER_PAD).isoformat(),
                models.CashEntry.linked_transfer_id.is_(None),
            )
            .order_by(models.CashEntry.date, models.CashEntry.id)
        )
    )
    covers: dict[int | None, list[tuple[str, float, datetime.date]]] = defaultdict(list)
    for e in rows:
        covers[e.institution_id].append((e.direction, in_base(e.amount, e.currency), analytics._parse(e.date)))

    spent: dict[str | None, float] = defaultdict(float)
    earned: dict[str | None, float] = defaultdict(float)
    entry_ids: dict[str | None, list[int]] = defaultdict(list)
    entry_count = 0
    days_seen: set[str] = set()
    flexible_total = 0.0
    income_flexible = 0.0
    for e in rows:
        day = analytics._parse(e.date)
        if day is None or not (lo <= day <= hi):
            continue
        entry_count += 1
        days_seen.add(e.date)
        base_amt = in_base(e.amount, e.currency)
        if e.direction == "out":
            spent[e.category] += base_amt
            flexible_total += base_amt
            entry_ids[e.category].append(e.id)
        else:
            earned[e.category] += base_amt
            income_flexible += base_amt

    fixed_total = 0.0
    income_fixed = 0.0
    before = lo - datetime.timedelta(days=1)
    for f in db.scalars(select(models.Expense)):
        paid = analytics._flow_sum_in_window(
            in_base(f.amount, f.currency),
            f.frequency,
            analytics._parse(f.start_date),
            analytics._parse(f.end_date),
            before,
            hi,
            covers=covers.get(f.institution_id, ()),
            direction="out",
        )
        if paid:
            spent[f.category] += paid
            fixed_total += paid
    for f in db.scalars(select(models.IncomeSource)):
        paid = analytics._flow_sum_in_window(
            in_base(f.amount, f.currency),
            f.frequency,
            analytics._parse(f.start_date),
            analytics._parse(f.end_date),
            before,
            hi,
            covers=covers.get(f.institution_id, ()),
            direction="in",
        )
        if paid:
            earned[f.category] += paid
            income_fixed += paid

    return {
        "month": month,
        "base_currency": conv.base,
        "spent_by_category": [
            {"category": k, "amount": round(v, 2)} for k, v in sorted(spent.items(), key=lambda kv: -kv[1])
        ],
        "earned_by_category": [
            {"category": k, "amount": round(v, 2)} for k, v in sorted(earned.items(), key=lambda kv: -kv[1])
        ],
        "spent_total": round(flexible_total + fixed_total, 2),
        "income_total": round(income_flexible + income_fixed, 2),
        "flexible_total": round(flexible_total, 2),
        "fixed_total": round(fixed_total, 2),
        "entry_count": entry_count,
        "days_with_entries": len(days_seen),
        "entry_ids_by_category": dict(entry_ids),
    }


def effective_budgets(db: Session, month: str) -> dict[str | None, models.Budget]:
    """The budget row in force for `month`, per category.

    A `repeat` row applies from its month forward; a row without it is one
    month's own adjustment. Where both could apply, the later start wins —
    which is exactly what "a new row from the month it applies" means."""
    chosen: dict[str | None, models.Budget] = {}
    for r in db.scalars(select(models.Budget).order_by(models.Budget.year_month, models.Budget.id)):
        if r.year_month > month:
            continue
        if not r.repeat and r.year_month != month:
            continue
        current = chosen.get(r.category)
        if current is None or r.year_month >= current.year_month:
            chosen[r.category] = r
    return chosen


def _carried(
    db: Session,
    conv: fx.Converter,
    month: str,
    row: models.Budget,
    cache: dict[str, dict],
) -> float:
    """What a rollover budget brings into `month` from before it.

    The surplus of every month since the row started, chained: last month's
    leftovers add to this month's limit, and last month's limit already
    included the leftovers before it. Capped at `_ROLLOVER_CAP` months back —
    a budget left on for years does not make its surplus a research project."""
    if not row.rollover:
        return 0.0
    carried = 0.0
    cursor = row.year_month
    seen = 0
    while cursor < month and seen < _ROLLOVER_CAP:
        if cursor not in cache:
            cache[cursor] = month_actuals(db, cursor, conv)
        spent = next(
            (s["amount"] for s in cache[cursor]["spent_by_category"] if s["category"] == row.category),
            0.0,
        )
        surplus = row.amount + carried - spent
        carried = max(0.0, surplus)
        cursor = next_month(cursor)
        seen += 1
    return round(carried, 2)


def next_month(month: str) -> str:
    first = month_window(month)[0]
    return (datetime.date(first.year + (first.month == 12), first.month % 12 + 1, 1)).strftime("%Y-%m")


def budget_overview(
    db: Session,
    month: str | None = None,
    conv: fx.Converter | None = None,
    actuals: dict | None = None,
) -> dict:
    """Every budget of `month` against what has been spent of it.

    The progress numbers the page draws: budget, spent, remaining, the share
    gone, and the daily allowance the days left allow — "这个月每天还能花
    182". A past month has no days left and no daily allowance (the question
    was answered by the month); a future one has all of them and nothing
    spent."""
    month = month or datetime.date.today().strftime("%Y-%m")
    if conv is None:
        conv = fx.Converter(db)
    if actuals is None:
        actuals = month_actuals(db, month, conv)
    budgets = effective_budgets(db, month)
    lo, hi = month_window(month)
    today = datetime.date.today()
    if today > hi:
        days_left = 0
    elif today < lo:
        days_left = (hi - lo).days + 1
    else:
        days_left = (hi - today).days + 1

    spent_by = {s["category"]: s["amount"] for s in actuals["spent_by_category"]}
    cache: dict[str, dict] = {month: actuals}
    slices = []
    for cat in sorted(budgets, key=lambda c: (c is not None, c or "")):
        row = budgets[cat]
        carried = _carried(db, conv, month, row, cache)
        budget = row.amount + carried
        spent = spent_by.get(cat, 0.0)
        remaining = budget - spent
        slices.append(
            {
                "id": row.id,
                "category": cat,
                "budget": round(budget, 2),
                "stated": round(row.amount, 2),
                "carried": carried,
                "spent": round(spent, 2),
                "remaining": round(remaining, 2),
                "ratio": round(spent / budget, 4) if budget > 0 else (1.0 if spent > 0 else 0.0),
                "days_left": days_left,
                "daily": round(remaining / days_left, 2) if days_left > 0 else None,
                "repeat": row.repeat,
                "rollover": row.rollover,
            }
        )
    total_budget = next((s["budget"] for s in slices if s["category"] is None), None)
    if total_budget is None:
        total_budget = sum(s["budget"] for s in slices if s["category"] is not None)
    return {
        "month": month,
        "base_currency": conv.base,
        "slices": slices,
        "total_budget": round(total_budget, 2),
        "total_spent": actuals["spent_total"],
        "days_left": days_left,
    }


def _round_hundreds(x: float) -> int:
    """A suggestion says "1,200", never "1,187.5": a budget is a line a
    reader draws, and they draw it round."""
    return max(100, int(round(x / 100.0)) * 100)


def month_review(db: Session, month: str) -> dict:
    """Everything worth saying about `month`, in the words the page prints.

    The numbers are computed here and the attributions name the rows behind
    them (`entry_ids`): a sentence about spending and the spending itself are
    never two documents. Suggestions come last and at most three — the point
    of a review is what to look at first, not an exhaustive audit."""
    conv = fx.Converter(db)
    cur = month_actuals(db, month, conv)
    prev_str = prev_month(month)
    prev = month_actuals(db, prev_str, conv)
    overview = budget_overview(db, month, conv, cur)

    lo, hi = month_window(month)
    prev_hi = month_window(prev_str)[1]
    now = analytics.compute_summary(db, hi)
    before = analytics.compute_summary(db, prev_hi)

    # Where spending moved most against the month before: the categories of
    # a positive change, biggest first, each with the rows that made it and
    # the counterparty that made it most. "女儿换牙" is written on a row, and
    # this is the row it is read off.
    entries_by_cat: dict[str | None, list[models.CashEntry]] = defaultdict(list)
    for e in db.scalars(
        select(models.CashEntry).where(
            models.CashEntry.date >= lo.isoformat(),
            models.CashEntry.date <= hi.isoformat(),
            models.CashEntry.direction == "out",
            models.CashEntry.linked_transfer_id.is_(None),
        )
    ):
        entries_by_cat[e.category].append(e)
    prev_spent = {s["category"]: s["amount"] for s in prev["spent_by_category"]}
    cur_spent = {s["category"]: s["amount"] for s in cur["spent_by_category"]}
    movers = []
    for cat in set(cur_spent) | set(prev_spent):
        delta = cur_spent.get(cat, 0.0) - prev_spent.get(cat, 0.0)
        if delta <= 0:
            continue
        rows = entries_by_cat.get(cat, [])
        by_party: dict[str, float] = defaultdict(float)
        party_count: dict[str, int] = defaultdict(int)
        for e in rows:
            if e.counterparty:
                by_party[e.counterparty] += e.amount
                party_count[e.counterparty] += 1
        top = max(by_party, key=lambda p: by_party[p]) if by_party else None
        movers.append(
            {
                "category": cat,
                "delta": round(delta, 2),
                "spent": round(cur_spent.get(cat, 0.0), 2),
                "prev_spent": round(prev_spent.get(cat, 0.0), 2),
                "reason_counterparty": top,
                "reason_count": party_count.get(top, 0) if top else 0,
                "entry_ids": [e.id for e in rows],
            }
        )
    movers.sort(key=lambda m: -m["delta"])
    movers = movers[:3]

    suggestions = _suggestions(db, month, cur, prev, overview)
    resolved = _resolved(db, month)
    suggestions = [s for s in suggestions if s["key"] not in resolved]
    for s in suggestions:
        s["resolution"] = resolved.get(s["key"])

    return {
        "month": month,
        "prev_month": prev_str,
        "base_currency": conv.base,
        "income": cur["income_total"],
        "prev_income": prev["income_total"],
        "expenses": cur["spent_total"],
        "prev_expenses": prev["spent_total"],
        "flexible_total": cur["flexible_total"],
        "fixed_total": cur["fixed_total"],
        "savings_rate": (
            (cur["income_total"] - cur["spent_total"]) / cur["income_total"]
            if cur["income_total"] > 0
            else None
        ),
        "net_worth": now["net_worth"],
        "prev_net_worth": before["net_worth"],
        "entry_count": cur["entry_count"],
        "days_with_entries": cur["days_with_entries"],
        "uncategorized": sum(
            len(v) for k, v in cur["entry_ids_by_category"].items() if k is None
        ),
        "budget": overview,
        "movers": movers,
        "suggestions": suggestions,
        "resolved": resolved,
    }


def _last3_spent(db: Session, conv: fx.Converter, month: str, category: str | None, cache: dict) -> float:
    """What the category ACTUALLY costs: the biggest of this month and the
    two before it, which is what a line for it should say. This month counts
    — a suggestion that aims under what the reader just spent is a suggestion
    to overrun again next month."""
    months = []
    cursor = month
    for _ in range(3):
        if cursor not in cache:
            cache[cursor] = month_actuals(db, cursor, conv)
        months.append(
            next(
                (s["amount"] for s in cache[cursor]["spent_by_category"] if s["category"] == category),
                0.0,
            )
        )
        cursor = prev_month(cursor)
    return max(months)


def _suggestions(db: Session, month: str, cur: dict, prev: dict, overview: dict) -> list[dict]:
    """At most three, each actionable: a line to move, or one fact to fix.

    Two rules about budgets (two months over, two months far under — a single
    month is weather), and one about the ledger itself (rows with no category
    are invisible to every budget). Each names a proposed number rounded to
    hundreds; the reader accepts it into a budget or dismisses it, and a
    dismissed one stops coming back (`MonthlyReview.resolved`)."""
    out: list[dict] = []
    conv_month_cache: dict[str, dict] = {month: cur, prev_month(month): prev}
    cur_map = {s["category"]: s["amount"] for s in cur["spent_by_category"]}
    prev_map = {s["category"]: s["amount"] for s in prev["spent_by_category"]}
    prev_budgets = effective_budgets(db, prev_month(month))
    for slice_ in overview["slices"]:
        cat = slice_["category"]
        spent_now = cur_map.get(cat, 0.0)
        spent_prev = prev_map.get(cat, 0.0)
        prev_row = prev_budgets.get(cat)
        prev_limit = prev_row.amount if prev_row else 0.0
        if spent_now > slice_["budget"] > 0 and prev_row is not None and spent_prev > prev_limit:
            proposed = _round_hundreds(_last3_spent(db, fx.Converter(db), month, cat, conv_month_cache))
            if proposed > slice_["budget"]:
                out.append(
                    {
                        "key": f"raise:{cat or ''}",
                        "kind": "raise",
                        "category": cat,
                        "proposed_amount": float(proposed),
                        "month": month,
                    }
                )
        elif (
            slice_["budget"] > 0
            and prev_row is not None
            and spent_now < slice_["budget"] * 0.5
            and spent_prev < prev_limit * 0.5
        ):
            proposed = _round_hundreds(_last3_spent(db, fx.Converter(db), month, cat, conv_month_cache))
            if proposed < slice_["budget"]:
                out.append(
                    {
                        "key": f"lower:{cat or ''}",
                        "kind": "lower",
                        "category": cat,
                        "proposed_amount": float(proposed),
                        "month": month,
                    }
                )
    uncategorized = sum(len(v) for k, v in cur["entry_ids_by_category"].items() if k is None)
    if uncategorized > 0:
        out.append(
            {
                "key": "categorize",
                "kind": "categorize",
                "category": None,
                "proposed_amount": None,
                "month": month,
            }
        )
    # Biggest question first, and never more than three: the point of a
    # review is what to look at first.
    order = {"raise": 0, "lower": 1, "categorize": 2}
    out.sort(key=lambda s: (order.get(s["kind"], 9), -(s["proposed_amount"] or 0)))
    return out[:3]


def _resolved(db: Session, month: str) -> dict[str, str]:
    row = db.scalar(select(models.MonthlyReview).where(models.MonthlyReview.year_month == month))
    if row is None:
        return {}
    try:
        data = json.loads(row.resolved)
    except ValueError:
        return {}
    return {k: v for k, v in data.items() if v in ("accepted", "ignored")}


def resolve_suggestion(db: Session, month: str, key: str, action: str) -> dict:
    """Record what the reader did with one suggestion: taken or dismissed.

    Taken RAISES OR LOWERS the budget through the caller (the router applies
    it and then calls this); dismissed only stops it coming back. Either way
    the decision is stored here so next month's review knows."""
    row = db.scalar(select(models.MonthlyReview).where(models.MonthlyReview.year_month == month))
    if row is None:
        row = models.MonthlyReview(year_month=month, resolved="{}")
        db.add(row)
    data = json.loads(row.resolved) if row.resolved else {}
    data[key] = action
    row.resolved = json.dumps(data)
    from app.database import commit

    commit(db)
    return _resolved(db, month)
