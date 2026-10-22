"""A household has members, and whose a row is never moves a total.

PRD v3 §4.1 (家庭账本). Three promises are written here. A member comes and
goes, and going leaves their rows shared rather than gone. An account's
attribution stamps its NAMED history once and never re-names a row the reader
already named. And the by-member slices of every summary add back to the
household figure exactly — the split is a second reading of one computation,
so a cent that appears in a slice twice is a bug here, not a rounding story.
"""

from __future__ import annotations

import datetime

from app import analytics, crud, models, schemas
from app.database import SessionLocal

TODAY = datetime.date.today().isoformat()
MONTH_AGO = (datetime.date.today() - datetime.timedelta(days=30)).isoformat()


def _member(db, name: str, role: str | None = None) -> models.Member:
    return crud.create_member(db, schemas.MemberCreate(name=name, role=role))


def _account(db, name: str, member_id: int | None = None) -> models.Institution:
    return crud.create_institution(
        db, schemas.InstitutionCreate(name=name, type="bank", member_id=member_id)
    )


def test_a_member_is_added_renamed_and_removed_into_shared():
    with SessionLocal() as db:
        me = _member(db, "陈昊", "self")
        assert crud.get_members(db)[0].name == "陈昊"

        renamed = crud.update_member(db, me.id, schemas.MemberUpdate(role="spouse"))
        assert renamed is not None and renamed.role == "spouse"

        account = _account(db, "招行工资卡", member_id=me.id)
        entry = crud.create_cash_entry(
            db,
            schemas.CashEntryCreate(
                date=TODAY,
                direction="out",
                amount=42.5,
                currency="CNY",
                category="dining",
                institution_id=account.id,
                member_id=me.id,
            ),
        )
        assert entry.member_id == me.id

        # Going leaves the rows shared (共同): an attribution is lost, never a
        # record. The FK is SET NULL and the deletion says so.
        assert crud.delete_member(db, me.id) is True
        db.expire_all()
        gone = db.get(models.CashEntry, entry.id)
        assert gone is not None and gone.member_id is None
        assert db.get(models.Institution, account.id).member_id is None


def test_assign_stamps_unnamed_history_and_never_a_named_row():
    with SessionLocal() as db:
        a = _member(db, "陈昊")
        b = _member(db, "林悦")
        account = _account(db, "浦发信用卡")

        def entry(i: int, member_id: int | None) -> None:
            crud.create_cash_entry(
                db,
                schemas.CashEntryCreate(
                    date=TODAY,
                    direction="out",
                    amount=10.0 + i,
                    currency="CNY",
                    category="dining",
                    institution_id=account.id,
                    member_id=member_id,
                ),
            )

        entry(0, None)  # nobody's yet — this is the history the tool is for
        entry(1, None)
        entry(2, a.id)  # already named: the reader said so, and it stays

        crud.create_expense(
            db,
            schemas.ExpenseCreate(
                name="月供", amount=14500, currency="CNY", frequency="monthly",
                institution_id=account.id,
            ),
        )
        crud.create_transaction(
            db,
            schemas.TransactionCreate(
                kind="buy", date=TODAY, asset_name="沪深300ETF", symbol="510300.SS",
                quantity=100, unit_price=4.0, amount=400.0, currency="CNY",
                price_currency="CNY", institution_id=account.id,
            ),
        )
        crud.create_transfer(
            db,
            schemas.TransferCreate(
                date=TODAY, from_institution_id=account.id, amount=50.0, currency="CNY",
                to_currency="CNY",
            ),
        )

        # 2 unnamed entries + 1 expense + 1 buy + 1 transfer = 5 rows stamped;
        # the account itself is stamped outright, whatever it said before.
        stamped = crud.assign_institution(db, account.id, b.id)
        assert stamped == 5
        db.expire_all()
        assert db.get(models.Institution, account.id).member_id == b.id

        rows = crud.get_cash_entries(db, institution_id=account.id)
        named = sorted(r.member_id for r in rows)
        assert named == [a.id, b.id, b.id]  # the named row kept its own member

        # Shared is the other direction: the account goes back to 共同 and no
        # row is un-named in bulk — null is what unnamed rows already say.
        assert crud.assign_institution(db, account.id, None) == 0
        db.expire_all()
        assert db.get(models.Institution, account.id).member_id is None
        assert sorted(r.member_id for r in crud.get_cash_entries(db, institution_id=account.id)) == [
            a.id,
            b.id,
            b.id,
        ]


def test_the_member_slices_add_back_to_the_household_figures():
    with SessionLocal() as db:
        a = _member(db, "陈昊")
        b = _member(db, "林悦")

        mine = _account(db, "陈昊的工资卡", member_id=a.id)
        hers = _account(db, "林悦的工资卡", member_id=b.id)
        ours = _account(db, "共同账户")
        for account, amount in ((mine, 1000), (hers, 500), (ours, 250)):
            crud.create_cash_anchor(
                db,
                account.id,
                schemas.CashAnchorCreate(date=MONTH_AGO, amount=amount, currency="CNY"),
            )

        crud.create_income_source(
            db,
            schemas.IncomeSourceCreate(
                name="工资", kind="active", amount=2000, currency="CNY",
                frequency="monthly", start_date=TODAY, member_id=a.id,
            ),
        )
        crud.create_expense(
            db,
            schemas.ExpenseCreate(
                name="买菜", nature="essential", amount=500, currency="CNY",
                frequency="monthly", start_date=TODAY,
            ),
        )
        house = crud.create_real_asset(
            db, schemas.RealAssetCreate(name="房子", category="real_estate", currency="CNY", member_id=b.id)
        )
        crud.create_real_asset_valuation(
            db, house.id, schemas.RealAssetValuationCreate(date=MONTH_AGO, value=100000)
        )
        loan = crud.create_liability(
            db, schemas.LiabilityCreate(name="房贷", kind="mortgage", currency="CNY")
        )
        crud.create_liability_balance(
            db, loan.id, schemas.LiabilityBalanceCreate(date=MONTH_AGO, balance=40000)
        )

        summary = analytics.compute_summary(db, datetime.date.fromisoformat(TODAY))
        # 1000 + 500 + 250 + 100000 − 40000, every row in one currency.
        assert summary["net_worth"] == 61750.0
        slices = summary["by_member"]
        assert sum(s["net_worth"] for s in slices) == summary["net_worth"]
        by_id = {s["member_id"]: s["net_worth"] for s in slices}
        assert by_id[a.id] == 1000.0  # their cash
        assert by_id[b.id] == 500 + 100000  # their cash and their house
        assert by_id[None] == 250 - 40000  # shared cash, shared debt
        assert {s["name"] for s in slices if s["member_id"] is not None} == {"陈昊", "林悦"}

        flows = analytics.compute_flows_in_force(db, TODAY)
        assert flows["monthly_income"] == 2000.0
        assert flows["monthly_expenses"] == 500.0
        assert sum(s["monthly_income"] for s in flows["by_member"]) == flows["monthly_income"]
        assert sum(s["monthly_expenses"] for s in flows["by_member"]) == flows["monthly_expenses"]
        flows_by_id = {s["member_id"]: s for s in flows["by_member"]}
        assert flows_by_id[a.id]["monthly_income"] == 2000.0
        assert flows_by_id[None]["monthly_expenses"] == 500.0
