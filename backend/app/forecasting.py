"""What the coming days hold (PRD v3 §4.3, 账单日历与现金流预测).

The forecast answers two questions a household actually asks: which days is
money coming or going (the calendar), and will any account run thin before
then (the curve and its gaps). Everything is derived from the four voices
the ledger already keeps — recurring flows, bill schedules, statement
entries and the investment plan — plus transfers, and one payment is counted
once and dated once: where a bill schedule and a recurring flow describe the
same payment, the schedule speaks for it, exactly as a statement entry
speaks for a flow in the cash register (`analytics._covered_by_entries`).

Every point is a PROJECTION, never a promise: the series marks how many of
its movements are still only scheduled, one bill's sum is not known at all
(金额未定 — its date is kept and its sum counts as nothing rather than as a
guess), and the calendar says which years the workday table covers. The
app prints those caveats beside the curve, so a thin day and an unknown day
are never the same mark."""

from __future__ import annotations

import datetime
import json
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import amortization, analytics, calendar_cn, fx, models, pac

DAY = datetime.timedelta(days=1)
# The same width the coverage rule keeps between an entry and a flow: a bill
# due on the 20th and paid on the 23rd is one payment.
_NEAR = analytics._COVER_WINDOW_DAYS


def schedule_dates(s: models.BillSchedule, lo: datetime.date, hi: datetime.date) -> list[datetime.date]:
    """The days this bill falls due within [lo, hi].

    `due_day` picks a day of the month (clamped to a short month's end, the
    way a flow's recurrence clamps); `due_last_workday` picks China's last
    working day (`calendar_cn`). `months` narrows the year to the bill's own
    months — tuition in [2, 9] falls twice a year, not twelve times. A
    schedule's own [start, end] bounds the whole list."""
    if not s.due_day and not s.due_last_workday:
        return []
    months = set(json.loads(s.months)) if s.months else None
    start = datetime.date.fromisoformat(s.start_date) if s.start_date else None
    end = datetime.date.fromisoformat(s.end_date) if s.end_date else None

    out: list[datetime.date] = []
    cursor = datetime.date(lo.year, lo.month, 1)
    while cursor <= hi:
        year, month = cursor.year, cursor.month
        if months is None or month in months:
            day = (
                calendar_cn.last_workday(year, month)
                if s.due_last_workday
                else datetime.date(year, month, min(s.due_day, _month_len(year, month)))
            )
            if lo <= day <= hi and (start is None or day >= start) and (end is None or day <= end):
                out.append(day)
        cursor = analytics.add_months(cursor, 1)
    return out


def _month_len(year: int, month: int) -> int:
    nxt = datetime.date(year + (month == 12), month % 12 + 1, 1)
    return (nxt - datetime.timedelta(days=1)).day


def _movement(
    date: datetime.date,
    direction: str,
    amount: float | None,
    name: str,
    source: str,
    institution_id: int | None,
    institution_name: str | None,
    category: str | None,
    conv: fx.Converter,
    currency: str | None,
) -> dict:
    base = None if amount is None else conv.to_base_or_as_stored(amount, currency)
    return {
        "date": date.isoformat(),
        "name": name,
        "direction": direction,
        "amount": amount,
        "base_amount": base,
        "stated": amount is not None,
        "source": source,
        "institution_id": institution_id,
        "institution_name": institution_name,
        "category": category,
    }


def cash_calendar(
    db: Session,
    lo: datetime.date,
    hi: datetime.date,
    conv: fx.Converter | None = None,
) -> dict:
    """Every expected movement in [lo, hi], one payment once.

    Five voices: flows (what repeats), bill schedules (the days a frequency
    cannot name), statement entries already recorded for those days,
    transfers dated ahead, and the plan's buys. Where a bill schedule or an
    entry carries a flow's payment the flow's occurrence is dropped — the
    more specific row speaks for it — so the rent is one line on one day
    however the household described it."""
    if conv is None:
        conv = fx.Converter(db)
    names = {i.id: i.name for i in db.scalars(select(models.Institution))}
    movements: list[dict] = []

    # The more specific voices first: they are the ones that can cover a flow.
    covers: dict[int | None, list[tuple[str, float, datetime.date]]] = defaultdict(list)
    for s in db.scalars(select(models.BillSchedule)):
        for day in schedule_dates(s, lo, hi):
            movement = _movement(
                day, s.direction, s.amount, s.name, "bill",
                s.institution_id, names.get(s.institution_id), None,
                conv, s.currency,
            )
            movements.append(movement)
            if s.amount is not None:
                covers[s.institution_id].append(
                    (s.direction, conv.to_base_or_as_stored(s.amount, s.currency), day)
                )
    for e in db.scalars(
        select(models.CashEntry).where(
            models.CashEntry.date >= lo.isoformat(),
            models.CashEntry.date <= hi.isoformat(),
            models.CashEntry.linked_transfer_id.is_(None),
        )
    ):
        day = analytics._parse(e.date)
        movement = _movement(
            day, e.direction, e.amount, e.counterparty or e.note or "记账", "entry",
            e.institution_id, names.get(e.institution_id), e.category,
            conv, e.currency,
        )
        movements.append(movement)
        covers[e.institution_id].append((e.direction, conv.to_base_or_as_stored(e.amount, e.currency), day))

    # The recurring voice, minus what a more specific row already carries.
    # `derived` is every description so far PLUS these flows: what the loan
    # plan below must bow to.
    derived: dict[int | None, list[tuple[str, float, datetime.date]]] = {
        k: list(v) for k, v in covers.items()
    }
    for model_, direction in ((models.Expense, "out"), (models.IncomeSource, "in")):
        for f in db.scalars(select(model_)):
            if not f.start_date:
                continue
            amount = conv.to_base_or_as_stored(f.amount, f.currency)
            for day in _flow_occurrences(f, lo, hi):
                if analytics._covered_by_entries(
                    covers.get(f.institution_id, ()), direction, amount, day
                ):
                    continue
                movements.append(
                    _movement(
                        day, direction, f.amount, f.name, "flow",
                        f.institution_id, names.get(f.institution_id), f.category,
                        conv, f.currency,
                    )
                )
                derived.setdefault(f.institution_id, []).append((direction, amount, day))

    # The loan voice (PRD v3 §4.4): payments its PLAN derives — the schedule
    # of a mortgage, the periods of an instalment. It is the lowest-priority
    # voice of all, and deliberately so: wherever the reader described the
    # same payment another way (an entry, a bill, a recurring flow), that
    # description speaks and the derived line stands down. One payment,
    # once — and the plan's line is the one that may lose.
    for liability in db.scalars(select(models.Liability)):
        terms = json.loads(liability.terms) if liability.terms else {}
        account = terms.get("payment_institution_id")
        for part in terms.get("parts") or []:
            for payment in amortization.part_schedule(part):
                day = analytics._parse(payment.date)
                if day is None or not (lo <= day <= hi):
                    continue
                if analytics._covered_by_entries(
                    derived.get(account, ()), "out", payment.payment, day
                ):
                    continue
                movements.append(
                    _movement(
                        day, "out", payment.payment, liability.name, "loan",
                        account, names.get(account), None, conv, liability.currency,
                    )
                )
        plan = json.loads(liability.installment_plan) if liability.installment_plan else None
        if plan and plan.get("started") and plan.get("per_period"):
            start = analytics._parse(plan["started"])
            if start is not None:
                for k in range(int(plan.get("count") or 0)):
                    day = analytics.add_months(start, k)
                    if not (lo <= day <= hi):
                        continue
                    if analytics._covered_by_entries(
                        derived.get(account, ()), "out", float(plan["per_period"]), day
                    ):
                        continue
                    movements.append(
                        _movement(
                            day, "out", float(plan["per_period"]), liability.name, "loan",
                            account, names.get(account), None, conv, liability.currency,
                        )
                    )

    # Transfers dated ahead: one line per side, as the register moves them.
    for t in db.scalars(
        select(models.Transfer).where(
            models.Transfer.date >= lo.isoformat(), models.Transfer.date <= hi.isoformat()
        )
    ):
        day = analytics._parse(t.date)
        if t.from_institution_id is not None:
            movements.append(
                _movement(day, "out", t.amount, t.note or "转账", "transfer",
                          t.from_institution_id, names.get(t.from_institution_id), None, conv, t.currency)
            )
        if t.to_institution_id is not None:
            movements.append(
                _movement(day, "in", t.to_amount, t.note or "转账", "transfer",
                          t.to_institution_id, names.get(t.to_institution_id), None, conv, t.to_currency)
            )

    # The plan's buys, unless one is already recorded for that occurrence.
    recorded = {
        (t.plan_id, t.plan_occurrence)
        for t in db.scalars(
            select(models.Transaction).where(models.Transaction.plan_id.is_not(None))
        )
    }
    for plan in db.scalars(select(models.AccumulationPlan)):
        for day in pac.plan_occurrences(plan, hi):
            if day < lo or (plan.id, day.isoformat()) in recorded:
                continue
            movements.append(
                _movement(
                    day, "out", plan.amount, plan.name or "定投", "pac",
                    plan.source_institution_id,
                    names.get(plan.source_institution_id),
                    None,
                    conv,
                    plan.currency,
                )
            )

    days: dict[str, list[dict]] = defaultdict(list)
    for m in movements:
        days[m["date"]].append(m)
    for rows in days.values():
        rows.sort(key=lambda m: (m["direction"], m["name"]))
    return {
        "days": dict(days),
        "base_currency": conv.base,
        "unpriced": sum(1 for m in movements if not m["stated"]),
        "calendar_covers": calendar_cn.coverage(),
    }


def _flow_occurrences(f, lo: datetime.date, hi: datetime.date) -> list[datetime.date]:
    """A flow's payment days within [lo, hi]: the recurrence's own dates,
    bounded by its [start, end]. A one_off is its start date."""
    start = analytics._parse(f.start_date)
    end = analytics._parse(f.end_date)
    if start is None:
        return []
    if (f.frequency or "monthly") == "one_off":
        return [start] if lo <= start <= hi and (end is None or start <= end) else []
    step = analytics.STEP_MONTHS.get(f.frequency or "monthly", 1)
    last = hi if end is None else min(hi, end)
    return [d for d in analytics.recurrence(start, step, last) if lo <= d <= hi]


def forecast_cash(
    db: Session,
    horizon_days: int = 30,
    conv: fx.Converter | None = None,
) -> dict:
    """Every account's balance for the coming days, and where one runs thin.

    Starts from each account's projected balance TODAY (the register's own
    number — anchor plus everything that moved it) and walks the calendar's
    movements forward day by day. A day that takes an account below zero is
    a GAP: named with the date, the deficit, the movements that got it there
    (`causes`), and which other accounts hold enough to cover it — a
    suggestion to move money, never a move made."""
    if conv is None:
        conv = fx.Converter(db)
    today = datetime.date.today()
    lo = today + DAY
    hi = today + datetime.timedelta(days=horizon_days)
    calendar = cash_calendar(db, lo, hi, conv)
    names = {i.id: i.name for i in db.scalars(select(models.Institution))}

    starts: dict[int | None, float] = {}
    for i in db.scalars(select(models.Institution)):
        pos = analytics.compute_cash_position(db, i.id, today, conv)
        starts[i.id] = pos["projected"] if pos else 0.0

    net_by_day: dict[str, dict[int | None, float]] = defaultdict(lambda: defaultdict(float))
    for date, rows in calendar["days"].items():
        for m in rows:
            sign = 1 if m["direction"] == "in" else -1
            net_by_day[date][m["institution_id"]] += sign * (m["base_amount"] or 0.0)

    accounts = sorted(starts, key=lambda i: names.get(i, ""))
    balance = dict(starts)
    points: dict[int | None, list[dict]] = defaultdict(list)
    gaps: list[dict] = []
    causes: dict[int | None, list[dict]] = defaultdict(list)
    day = lo
    while day <= hi:
        date = day.isoformat()
        for inst in accounts:
            net = net_by_day.get(date, {}).get(inst, 0.0)
            balance[inst] = balance[inst] + net
            points[inst].append({"date": date, "balance": round(balance[inst], 2), "net": round(net, 2)})
            for m in calendar["days"].get(date, ()):
                if m["institution_id"] == inst:
                    causes[inst].append(m)
            if balance[inst] < 0:
                cover = [
                    {
                        "institution_id": other,
                        "institution_name": names.get(other),
                        "surplus": round(balance[other], 2),
                    }
                    for other in accounts
                    if other != inst and balance[other] > 0
                ]
                gaps.append(
                    {
                        "date": date,
                        "institution_id": inst,
                        "institution_name": names.get(inst),
                        "deficit": round(-balance[inst], 2),
                        # The movements that walked it down: everything the
                        # calendar had on this account since the horizon
                        # began and reached here. Named, never abridged to a
                        # number the reader cannot look up.
                        "causes": causes[inst][-6:],
                        "cover": sorted(cover, key=lambda c: -c["surplus"])[:3],
                    }
                )
        day += DAY

    # A gap is a SPELL, not a day: the days a balance stays below zero are
    # one bad stretch with one cause and one fix. Collapsed here so the page
    # shows three spells rather than three days of the same one — the curve
    # below it still dips for as long as it dips.
    spells: list[dict] = []
    for gap in gaps:
        same = (
            spells
            and spells[-1]["institution_id"] == gap["institution_id"]
            and (
                datetime.date.fromisoformat(gap["date"])
                - datetime.date.fromisoformat(spells[-1]["date"])
            ).days
            == spells[-1]["days"]
        )
        if same:
            spell = spells[-1]
            spell["days"] += 1
            if gap["deficit"] > spell["deficit"]:
                spell["deficit"] = gap["deficit"]
                spell["causes"] = gap["causes"]
        else:
            spells.append({**gap, "days": 1})

    return {
        "horizon_days": horizon_days,
        "base_currency": conv.base,
        "from": lo.isoformat(),
        "to": hi.isoformat(),
        "accounts": [
            {
                "institution_id": inst,
                "institution_name": names.get(inst),
                "start_balance": round(starts[inst], 2),
                "points": points.get(inst, []),
            }
            for inst in accounts
        ],
        "gaps": spells,
        "unpriced": calendar["unpriced"],
        "calendar_covers": calendar["calendar_covers"],
    }


def upcoming_bills(
    db: Session, within_days: int = 7, conv: fx.Converter | None = None
) -> list[dict]:
    """What is due in the days ahead, soonest first, each with whether the
    account it draws on holds enough for it today.

    The reminder's own sentence: "招行信用卡 3 月 20 日还款 8,432 元，工资卡余额
    1.2 万，够" — the date, the sum, the account, and the answer to the only
    question a reminder is for."""
    if conv is None:
        conv = fx.Converter(db)
    today = datetime.date.today()
    calendar = cash_calendar(db, today, today + datetime.timedelta(days=within_days), conv)
    balances = {
        i.id: (analytics.compute_cash_position(db, i.id, today, conv) or {}).get("projected", 0.0)
        for i in db.scalars(select(models.Institution))
    }
    out = []
    for date in sorted(calendar["days"]):
        for m in calendar["days"][date]:
            if m["direction"] != "out":
                continue
            balance = balances.get(m["institution_id"], 0.0)
            out.append(
                {
                    **m,
                    "days_until": (datetime.date.fromisoformat(date) - today).days,
                    "balance_today": round(balance, 2),
                    "enough": m["base_amount"] is not None and balance >= m["base_amount"],
                }
            )
    return out
