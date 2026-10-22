"""The forecast sees what is coming, and counts each payment once.

PRD v3 §4.3 (账单日历与现金流预测). The promises: a bill's day is worked out
by ITS rule (a day of the month, the last workday, the school's own months),
the workday rule is pinned here against a table the test writes itself —
this file tests rules, and `calendar_cn` is data, checked by reading it. One
payment is one line however many voices described it. A gap names its date,
its deficit and the movements that got it there. And a sum nobody knows
counts as nothing rather than as a guess.
"""

from __future__ import annotations

import datetime

from app import calendar_cn, crud, forecasting, models, schemas
from app.database import SessionLocal

TODAY = datetime.date.today()
DAY = datetime.timedelta(days=1)
CUR = TODAY.strftime("%Y-%m")


def _bill(db, **kw) -> models.BillSchedule:
    return crud.create_bill_schedule(
        db,
        schemas.BillScheduleCreate(
            name=kw.pop("name", "账单"),
            direction=kw.pop("direction", "out"),
            **kw,
        ),
    )


def _entry(db, date: str, amount: float, category: str | None = None, inst=None):
    return crud.create_cash_entry(
        db,
        schemas.CashEntryCreate(
            date=date,
            direction="out",
            amount=amount,
            currency="CNY",
            category=category,
            institution_id=inst.id if inst else None,
        ),
    )


def test_a_bill_falls_on_its_own_kind_of_day(monkeypatch):
    """Three rules, one table each: the day of the month (clamped to a short
    one), the bill's own months, and the last WORKDAY — which the test
    decides with its own holiday table, so the rule is what is on trial and
    not the real table's rows."""
    # The test's own February: the 28th is a Saturday the country works
    # (调休), the 27th is a holiday. The last workday is the 28th — a
    # weekend — and nothing else.
    monkeypatch.setattr(
        calendar_cn,
        "_HOLIDAYS",
        {2030: {datetime.date(2030, 2, 27)}},
    )
    monkeypatch.setattr(
        calendar_cn,
        "_MAKEUP_WORKDAYS",
        {2030: {datetime.date(2030, 2, 28)}},
    )

    with SessionLocal() as db:
        monthly = _bill(db, name="房贷", due_day=31, amount=14500)  # clamped to short months
        tuition = _bill(db, name="学费", due_day=10, months=[2, 9], amount=8000)
        payday = _bill(db, name="工资", direction="in", due_last_workday=True, amount=23000)

        lo, hi = datetime.date(2030, 1, 1), datetime.date(2030, 12, 31)
        assert forecasting.schedule_dates(monthly, lo, hi) == [
            datetime.date(2030, 1, 31),
            datetime.date(2030, 2, 28),  # clamped, not March 3rd
            datetime.date(2030, 3, 31),
            datetime.date(2030, 4, 30),
            datetime.date(2030, 5, 31),
            datetime.date(2030, 6, 30),
            datetime.date(2030, 7, 31),
            datetime.date(2030, 8, 31),
            datetime.date(2030, 9, 30),
            datetime.date(2030, 10, 31),
            datetime.date(2030, 11, 30),
            datetime.date(2030, 12, 31),
        ]
        assert forecasting.schedule_dates(tuition, lo, hi) == [
            datetime.date(2030, 2, 10),
            datetime.date(2030, 9, 10),
        ]
        # February 2030's last workday is the 28th — a Saturday the table
        # says people work — and the holiday on the 27th is passed over.
        dates = forecasting.schedule_dates(payday, lo, hi)
        assert datetime.date(2030, 2, 28) in dates
        assert datetime.date(2030, 2, 27) not in dates
        assert len(dates) == 12  # every month answers, one day each


def test_one_payment_is_one_line_however_many_voices_said_it():
    """The rent as a flow AND as a bill is one line on one day: the bill
    speaks for it, the same way an entry speaks for a flow."""
    with SessionLocal() as db:
        inst = crud.create_institution(db, schemas.InstitutionCreate(name="工资卡"))
        day = TODAY + datetime.timedelta(days=5)
        crud.create_expense(
            db,
            schemas.ExpenseCreate(
                name="房租", nature="essential", category="housing", amount=4500,
                currency="CNY", frequency="monthly",
                start_date=day.isoformat(), institution_id=inst.id,
            ),
        )
        _bill(db, name="房租", kind="rent", due_day=day.day, amount=4500, institution_id=inst.id)

        cal = forecasting.cash_calendar(db, TODAY, TODAY + datetime.timedelta(days=40))
        rows = cal["days"].get(day.isoformat(), [])
        assert len(rows) == 1
        assert rows[0]["source"] == "bill"  # the more specific voice speaks


def test_a_gap_names_its_day_its_deficit_and_what_got_it_there():
    with SessionLocal() as db:
        inst = crud.create_institution(db, schemas.InstitutionCreate(name="工资卡"))
        other = crud.create_institution(db, schemas.InstitutionCreate(name="货基"))
        crud.create_cash_anchor(
            db, inst.id,
            schemas.CashAnchorCreate(date=(TODAY - DAY).isoformat(), amount=1000, currency="CNY"),
        )
        crud.create_cash_anchor(
            db, other.id,
            schemas.CashAnchorCreate(date=(TODAY - DAY).isoformat(), amount=50000, currency="CNY"),
        )
        # A big expense five days out walks the account under zero.
        day = TODAY + datetime.timedelta(days=5)
        crud.create_expense(
            db,
            schemas.ExpenseCreate(
                name="孩子学费", nature="essential", category="education", amount=1500,
                currency="CNY", frequency="one_off", start_date=day.isoformat(),
                institution_id=inst.id,
            ),
        )

        f = forecasting.forecast_cash(db, horizon_days=30)
        assert f["gaps"], "the walk must find the thin day"
        gap = f["gaps"][0]
        assert gap["date"] == day.isoformat()
        assert gap["deficit"] == 500.0
        assert gap["causes"] and gap["causes"][0]["name"] == "孩子学费"
        assert gap["cover"] and gap["cover"][0]["institution_name"] == "货基"
        # The curve passes through the same numbers the gap names.
        points = next(a for a in f["accounts"] if a["institution_id"] == inst.id)["points"]
        assert points[-1]["balance"] == -500.0


def test_a_sum_nobody_knows_counts_as_nothing():
    """A card's bill varies: its date is kept, its sum counts as nothing —
    a guess would be a number the ledger cannot trace."""
    with SessionLocal() as db:
        inst = crud.create_institution(db, schemas.InstitutionCreate(name="工资卡"))
        crud.create_cash_anchor(
            db, inst.id,
            schemas.CashAnchorCreate(date=(TODAY - DAY).isoformat(), amount=3000, currency="CNY"),
        )
        _bill(db, name="招行信用卡", kind="credit_card", due_day=20, amount=None, institution_id=inst.id)

        f = forecasting.forecast_cash(db, horizon_days=60)
        points = f["accounts"][0]["points"]
        # Every day is the balance it was: no sum was invented for the card.
        assert all(p["balance"] == 3000.0 for p in points)
        assert f["unpriced"] >= 1


def test_a_reminder_says_whether_the_account_holds_enough():
    with SessionLocal() as db:
        inst = crud.create_institution(db, schemas.InstitutionCreate(name="工资卡"))
        crud.create_cash_anchor(
            db, inst.id,
            schemas.CashAnchorCreate(date=(TODAY - DAY).isoformat(), amount=1200, currency="CNY"),
        )
        soon = _bill(db, name="招行信用卡", due_day=(TODAY + datetime.timedelta(days=3)).day, amount=800, institution_id=inst.id)
        far = _bill(db, name="房贷", due_day=(TODAY + datetime.timedelta(days=20)).day, amount=900, institution_id=inst.id)

        bills = forecasting.upcoming_bills(db, within_days=7)
        names = {b["name"] for b in bills}
        assert "招行信用卡" in names
        assert "房贷" not in names  # outside the window the reminder asks about
        card = next(b for b in bills if b["name"] == "招行信用卡")
        assert card["days_until"] == 3
        assert card["balance_today"] == 1200.0
        assert card["enough"] is True
        assert soon and far  # both rows exist; the window is what narrows


def test_the_calendar_and_forecast_answer_the_page(client):
    """The endpoints' own shapes. Every field the page reads is one a
    missing key would turn into a 500 behind a spinner — so the response is
    validated here, against a live bill, not assumed from the functions'
    dict."""
    with SessionLocal() as db:
        crud.create_institution(db, schemas.InstitutionCreate(name="工资卡"))
        _bill(db, name="房贷", due_day=20, amount=14500, institution_id=1)

    page = client.get("/api/calendar", params={"month": CUR}).json()
    assert page["base_currency"]
    assert page["calendar_covers"]["to"]
    assert isinstance(page["days"], dict)

    f = client.get("/api/forecast", params={"days": 30}).json()
    assert f["base_currency"]
    assert "from" in f and f["to"]
    assert isinstance(f["accounts"], list) and isinstance(f["gaps"], list)

    bills = client.get("/api/bills/upcoming", params={"within": 7}).json()
    assert isinstance(bills, list)


def test_the_loan_plan_walks_with_the_others_and_bows_to_them():
    """A mortgage's schedule and an instalment's periods are movements like
    any other (source "loan") — and the LOWEST-priority ones: where the
    reader described the same payment as a bill, the bill speaks and the
    derived line stands down. One payment, once."""
    from app import amortization

    with SessionLocal() as db:
        inst = crud.create_institution(db, schemas.InstitutionCreate(name="工资卡"))
        start = (TODAY + datetime.timedelta(days=5)).replace(day=1)  # first payment lands ~next month
        crud.create_liability(
            db,
            schemas.LiabilityCreate(
                name="房贷",
                currency="CNY",
                terms={
                    "parts": [
                        {
                            "name": "商贷",
                            "principal": 600000,
                            "rate": 0.04,
                            "method": "annuity",
                            "term_months": 24,
                            "start_date": start.isoformat(),
                            "paid_periods": 0,
                        }
                    ],
                    "payment_institution_id": inst.id,
                },
                installment_plan={
                    "count": 3,
                    "per_period": 500,
                    "principal": 1500,
                    "started": (TODAY + datetime.timedelta(days=10)).isoformat(),
                },
            ),
        )
        payment = amortization.annuity_payment(600000, 24, 0.04 / 12)

        cal = forecasting.cash_calendar(db, TODAY, TODAY + datetime.timedelta(days=80))
        loans = [m for rows in cal["days"].values() for m in rows if m["source"] == "loan"]
        mortgage = [m for m in loans if m["name"] == "房贷" and m["amount"] == payment]
        instalment = [m for m in loans if m["amount"] == 500.0]
        assert mortgage, "the schedule's payment is a movement"
        assert len(instalment) == 3  # the plan's three periods, counted where they fall

        # A bill describing the same mortgage payment speaks for it: the
        # plan's line stands down, and the payment is on the calendar once.
        _bill(
            db,
            name="房贷",
            kind="mortgage",
            due_day=int(mortgage[0]["date"][8:]),
            amount=payment,
            institution_id=inst.id,
        )
        cal = forecasting.cash_calendar(db, TODAY, TODAY + datetime.timedelta(days=80))
        day_rows = cal["days"].get(mortgage[0]["date"], [])
        # The instalment shares the debt's name and falls on the same days;
        # what the bill speaks for is the SCHEDULE'S payment, and that sum
        # appears once — as the bill.
        mortgage_rows = [m for m in day_rows if m["amount"] == payment]
        assert len(mortgage_rows) == 1
        assert mortgage_rows[0]["source"] == "bill"
