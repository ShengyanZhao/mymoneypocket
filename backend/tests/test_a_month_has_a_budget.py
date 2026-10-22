"""A month has a budget, and the review names the rows it read.

PRD v3 §4.2 (预算与复盘). Three promises are written here. One payment is
counted once and on the day its money moved, whether a statement entry or a
recurring flow described it — the cash register's own coverage rule, not a
second copy of it. A budget's arithmetic is plain and never blocks anything.
And a review's attribution carries the ids of the rows behind its sentence,
so the sentence and its evidence can be held side by side.
"""

from __future__ import annotations

import datetime

from app import budgeting, crud, models, schemas
from app.database import SessionLocal

TODAY = datetime.date.today()
CUR = TODAY.strftime("%Y-%m")
PREV = budgeting.prev_month(CUR)
NEXT = budgeting.next_month(CUR)
CUR_LO, CUR_HI = budgeting.month_window(CUR)
PREV_HI = budgeting.month_window(PREV)[1]


def _day(month_end: datetime.date, n: int) -> str:
    """The n-th day of the month `month_end` finishes."""
    return month_end.replace(day=n).isoformat()


def _entry(db, date: str, amount: float, category: str | None, counterparty: str | None = None, direction: str = "out", inst: models.Institution | None = None):
    return crud.create_cash_entry(
        db,
        schemas.CashEntryCreate(
            date=date,
            direction=direction,
            amount=amount,
            currency="CNY",
            category=category,
            counterparty=counterparty,
            institution_id=inst.id if inst else None,
        ),
    )


def test_one_payment_is_counted_once_wherever_it_was_described():
    """A rent on a standing order and the same rent on an import are one
    payment: the entry speaks for it (its date and its sum are the truer
    ones) and the flow's occurrence counts nothing."""
    with SessionLocal() as db:
        inst = crud.create_institution(db, schemas.InstitutionCreate(name="工资卡"))
        crud.create_expense(
            db,
            schemas.ExpenseCreate(
                name="房租", nature="essential", category="housing", amount=4500,
                currency="CNY", frequency="monthly",
                start_date=_day(CUR_LO, 5), institution_id=inst.id,
            ),
        )
        # This month's rent, as the import describes it — same account, same
        # sum, within the coverage window of the 5th.
        _entry(db, _day(CUR_LO, 6), 4500, "housing", counterparty="房东", inst=inst)
        # A coffee no flow ever knew about.
        _entry(db, _day(CUR_LO, 10), 30, "dining", counterparty="星巴克", inst=inst)

        actuals = budgeting.month_actuals(db, CUR)
        spent = {s["category"]: s["amount"] for s in actuals["spent_by_category"]}
        # 4500 once (the entry's), plus the coffee: the rent is not counted
        # again by the flow, though it occurs this month.
        assert spent["housing"] == 4500.0
        assert spent["dining"] == 30.0
        assert actuals["flexible_total"] == 4530.0
        assert actuals["fixed_total"] == 0.0

        # And a rent NO import ever carried counts as the fixed lane.
        crud.create_expense(
            db,
            schemas.ExpenseCreate(
                name="物业费", nature="essential", category="housing", amount=300,
                currency="CNY", frequency="monthly", start_date=_day(CUR_LO, 8),
            ),
        )
        actuals = budgeting.month_actuals(db, CUR)
        assert actuals["fixed_total"] == 300.0
        assert actuals["spent_total"] == 4830.0


def test_a_budget_line_resolves_by_month_and_never_blocks_a_row():
    with SessionLocal() as db:
        # A repeating line from PREV is in force this month; a one-off line
        # for this month overrides it for this month alone.
        crud.create_budget(
            db, schemas.BudgetCreate(year_month=PREV, category="dining", amount=2000, repeat=True)
        )
        assert budgeting.effective_budgets(db, CUR)["dining"].amount == 2000

        crud.create_budget(
            db, schemas.BudgetCreate(year_month=CUR, category="dining", amount=800, repeat=False)
        )
        assert budgeting.effective_budgets(db, CUR)["dining"].amount == 800
        assert budgeting.effective_budgets(db, NEXT)["dining"].amount == 2000

        # Overspending is a fact the overview reports, not something the
        # store refuses: the row goes in and the ratio says what it means.
        _entry(db, _day(CUR_LO, 12), 5000, "dining", counterparty="年夜饭")
        overview = budgeting.budget_overview(db, CUR)
        slice_ = next(s for s in overview["slices"] if s["category"] == "dining")
        assert slice_["budget"] == 800.0
        assert slice_["spent"] == 5000.0
        assert slice_["remaining"] == -4200.0
        assert slice_["ratio"] > 1.0


def test_the_daily_allowance_reads_the_days_left():
    with SessionLocal() as db:
        crud.create_budget(db, schemas.BudgetCreate(year_month=NEXT, category="dining", amount=3100, repeat=False))
        _entry(db, _day(CUR_LO, 12), 100, "dining")
        overview = budgeting.budget_overview(db, NEXT)
        slice_ = next(s for s in overview["slices"] if s["category"] == "dining")
        # A future month: nothing spent, every day of it left.
        days = (budgeting.month_window(NEXT)[1] - budgeting.month_window(NEXT)[0]).days + 1
        assert slice_["spent"] == 0.0
        assert slice_["days_left"] == days
        assert slice_["daily"] == round(3100.0 / days, 2)


def test_a_reviews_attribution_names_the_rows_behind_it():
    with SessionLocal() as db:
        _entry(db, _day(PREV_HI, 10), 200, "dining", counterparty="食堂")
        _entry(db, _day(CUR_LO, 8), 800, "education", counterparty="牙医")
        e2 = _entry(db, _day(CUR_LO, 9), 300, "education", counterparty="牙医")
        _entry(db, _day(CUR_LO, 10), 1500, "education", counterparty="钢琴课")

        review = budgeting.month_review(db, CUR)
        mover = next(m for m in review["movers"] if m["category"] == "education")
        assert mover["delta"] == 2600.0  # 800 + 300 + 1500, against nothing before
        assert mover["prev_spent"] == 0.0
        # The counterparty that moved the most money in it: the piano class.
        assert mover["reason_counterparty"] == "钢琴课"
        assert mover["reason_count"] == 1
        # The sentence and its evidence: every row of the category is named.
        assert set(mover["entry_ids"]) >= {e2.id}
        assert len(mover["entry_ids"]) == 3
        # And the totals are the same ledger read whole.
        assert review["expenses"] == 2600.0
        assert review["prev_expenses"] == 200.0


def test_a_suggestion_is_taken_into_next_months_budget_and_stops_returning():
    with SessionLocal() as db:
        crud.create_budget(
            db, schemas.BudgetCreate(year_month=PREV, category="gift", amount=500, repeat=True)
        )
        # Two months over: the rule that says a line should move.
        _entry(db, _day(PREV_HI, 12), 1200, "gift", counterparty="份子钱")
        _entry(db, _day(CUR_LO, 12), 1300, "gift", counterparty="份子钱")
        _entry(db, _day(CUR_LO, 20), 50, None)  # a row with no category is another matter

        review = budgeting.month_review(db, CUR)
        kinds = [s["kind"] for s in review["suggestions"]]
        assert "raise" in kinds
        raise_one = next(s for s in review["suggestions"] if s["kind"] == "raise")
        assert raise_one["category"] == "gift"
        # Proposed at the biggest of this month and the two before it,
        # rounded to hundreds — never under what the reader just spent.
        assert raise_one["proposed_amount"] == 1300.0

        # Taken: the amount lands as NEXT month's line, and this month keeps
        # the budget it had.
        budgeting.resolve_suggestion(db, CUR, raise_one["key"], "accepted")
        crud.upsert_budget(db, NEXT, "gift", raise_one["proposed_amount"])
        assert budgeting.effective_budgets(db, CUR)["gift"].amount == 500
        assert budgeting.effective_budgets(db, NEXT)["gift"].amount == 1300

        # Resolved means gone: the same review does not ask twice.
        again = budgeting.month_review(db, CUR)
        assert all(s["key"] != raise_one["key"] for s in again["suggestions"])
        assert again["resolved"][raise_one["key"]] == "accepted"
