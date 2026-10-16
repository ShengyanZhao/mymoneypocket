"""One trade, two settlement moments (PRD §4.3).

An OTC fund bought on the 3rd takes its CASH on the 3rd and its UNITS on the
4th — the NAV day the fund confirms on (T+1; T+2 for QDII) — and a redemption
leaves its units when it is made and pays days later. `date` is the trade,
`confirm_date` names the later half, and which half lags follows the kind.

What this asserts is the arithmetic of that split, and the one invariant it
must not break: a photograph taken between the two halves contains neither
half twice. Money that has left and units that have not arrived is IN
transit — the net worth says so by being lower, which is the truth of those
days, and nothing invents the units early to make it look better."""

from __future__ import annotations

from app import positions
from app.database import SessionLocal


def _account(client) -> int:
    return client.post(
        "/api/institutions", json={"name": "天天基金", "type": "fund_otc"}
    ).json()["id"]


def _anchor(client, iid: int, date: str, amount: float) -> None:
    r = client.post(
        f"/api/institutions/{iid}/cash-anchors",
        json={"date": date, "amount": amount, "currency": "CNY"},
    )
    assert r.status_code == 201, r.text


def _entry(client, iid: int, **fields) -> dict:
    r = client.post(
        "/api/transactions",
        json={
            "kind": "buy",
            "asset_name": "易方达优质精选混合",
            "symbol": "110011",
            "asset_class": "fund_etf",
            "currency": "CNY",
            "price_currency": "CNY",
            "institution_id": iid,
            "quantity": 100,
            "unit_price": 2.0,
            **fields,
        },
    )
    assert r.status_code in (200, 201), r.text
    return r.json()


def _cash(client, iid: int, as_of: str) -> float:
    return client.get(
        f"/api/institutions/{iid}/cash", params={"as_of": as_of}
    ).json()["projected"]


def _qty(symbol: str, day: str) -> float:
    db = SessionLocal()
    try:
        return sum(
            p.quantity
            for p in positions.project(db, as_of=day)
            if p.symbol == symbol
        )
    finally:
        db.close()


# --- The two halves --------------------------------------------------------


def test_a_buy_pays_at_the_trade_and_takes_its_units_at_its_confirmation(client):
    iid = _account(client)
    _anchor(client, iid, "2026-03-01", 10000.0)
    _entry(client, iid, date="2026-03-10", confirm_date="2026-03-11")

    # The money is gone on the trade day — it is what "in transit" means.
    assert _cash(client, iid, "2026-03-10") == 9800.0
    assert _cash(client, iid, "2026-03-11") == 9800.0
    # The units are nobody's until the fund confirms them at its NAV.
    assert _qty("110011", "2026-03-10") == 0.0
    assert _qty("110011", "2026-03-11") == 100.0


def test_a_buy_with_no_confirmation_takes_both_halves_at_once(client):
    """Every row written before `confirm_date` existed, and most after it."""
    iid = _account(client)
    _anchor(client, iid, "2026-03-01", 10000.0)
    _entry(client, iid, date="2026-03-10")

    assert _cash(client, iid, "2026-03-10") == 9800.0
    assert _qty("110011", "2026-03-10") == 100.0


def test_a_sale_leaves_its_units_at_the_trade_and_pays_later(client):
    iid = _account(client)
    _anchor(client, iid, "2026-03-01", 10000.0)
    _entry(client, iid, date="2026-03-05", confirm_date="2026-03-06")
    _entry(
        client,
        iid,
        kind="sell",
        date="2026-03-10",
        confirm_date="2026-03-17",  # a redemption pays days after its units left
        quantity=40,
        unit_price=3.0,
    )

    # Units: 100 from the 6th, 60 the moment the sale is made.
    assert _qty("110011", "2026-03-09") == 100.0
    assert _qty("110011", "2026-03-10") == 60.0
    # Money: the buy's 200 is out on the 5th; the 120 of proceeds lands on
    # the 17th, and not a day before.
    assert _cash(client, iid, "2026-03-09") == 9800.0
    assert _cash(client, iid, "2026-03-16") == 9800.0
    assert _cash(client, iid, "2026-03-17") == 9920.0


# --- The photograph between them -------------------------------------------


def test_a_photograph_after_the_confirmation_is_not_doubled(client):
    """A situation taken once the units HAVE landed already contains them:
    the trade before it is not applied again — the anchor rule, kept across
    the gap between the two halves."""
    iid = _account(client)
    _anchor(client, iid, "2026-03-01", 10000.0)
    _entry(client, iid, date="2026-03-10", confirm_date="2026-03-11")
    r = client.post(
        f"/api/institutions/{iid}/snapshots", json={"date": "2026-03-12"}
    )
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    # The photograph records the units that landed on the 11th.
    r = client.post(
        f"/api/snapshots/{sid}/holdings",
        json={
            "asset_name": "易方达优质精选混合",
            "asset_class": "fund_etf",
            "symbol": "110011",
            "quantity": 100,
            "unit_price": 2.1,
            "currency": "CNY",
        },
    )
    assert r.status_code == 201, r.text

    assert _qty("110011", "2026-03-15") == 100.0, "the buy is in the photo already"


def test_a_photograph_between_the_halves_sees_only_what_landed(client):
    """Taken on the trade day, a situation holds no units of it — they arrive
    tomorrow — and the buy counts after it rather than being swallowed."""
    iid = _account(client)
    _anchor(client, iid, "2026-03-01", 10000.0)
    _entry(client, iid, date="2026-03-10", confirm_date="2026-03-11")
    r = client.post(
        f"/api/institutions/{iid}/snapshots", json={"date": "2026-03-10"}
    )
    assert r.status_code == 201, r.text

    assert _qty("110011", "2026-03-10") == 0.0
    assert _qty("110011", "2026-03-12") == 100.0


# --- The shape of the row --------------------------------------------------


def test_an_entry_cannot_settle_before_it_happens(client):
    iid = _account(client)
    r = client.post(
        "/api/transactions",
        json={
            "kind": "buy",
            "asset_name": "易方达优质精选混合",
            "symbol": "110011",
            "currency": "CNY",
            "price_currency": "CNY",
            "institution_id": iid,
            "quantity": 1,
            "unit_price": 2.0,
            "date": "2026-03-10",
            "confirm_date": "2026-03-09",
        },
    )
    assert r.status_code == 422
    assert "settle" in r.text or "confirm_date" in r.text


def test_the_confirmation_round_trips(client):
    iid = _account(client)
    made = _entry(client, iid, date="2026-03-10", confirm_date="2026-03-11")
    assert made["confirm_date"] == "2026-03-11"
    read = client.get(f"/api/transactions/{made['id']}").json()
    assert read["confirm_date"] == "2026-03-11"
