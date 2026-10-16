"""The cash register's two voices: each payment counted once.

A recurring flow says what REPEATS (a rent on the 5th); a statement entry says
what HAPPENED (the money left on the 6th). When they describe one payment the
entry speaks for it — its date and its exact sum are the truer ones — and the
flow's occurrence counts nothing. When they do not match, each counts on its
own: the flow keeps forecasting, the entry moves what it moved.

`analytics._covered_by_entries` is the rule; this file is what it promises.
"""

from __future__ import annotations


def _account(client) -> int:
    return client.post(
        "/api/institutions", json={"name": "支付宝", "type": "payment_wallet"}
    ).json()["id"]


def _anchor(client, iid: int, date: str, amount: float) -> None:
    r = client.post(
        f"/api/institutions/{iid}/cash-anchors",
        json={"date": date, "amount": amount, "currency": "CNY"},
    )
    assert r.status_code == 201, r.text


def _rent(client, iid: int, amount: float = 2000.0) -> None:
    r = client.post(
        "/api/expenses",
        json={
            "name": "房租",
            "amount": amount,
            "currency": "CNY",
            "frequency": "monthly",
            "start_date": "2026-09-05",
            "institution_id": iid,
            "nature": "essential",
        },
    )
    assert r.status_code == 201, r.text


def _entry(client, iid: int, date: str, amount: float, direction: str = "out") -> dict:
    r = client.post(
        "/api/cash-entries",
        json={
            "date": date,
            "direction": direction,
            "amount": amount,
            "currency": "CNY",
            "institution_id": iid,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _cash(client, iid: int, as_of: str) -> dict:
    return client.get(f"/api/institutions/{iid}/cash", params={"as_of": as_of}).json()


def test_a_flow_alone_moves_the_register_as_it_always_did(client):
    iid = _account(client)
    _anchor(client, iid, "2026-09-01", 1000.0)
    _rent(client, iid)

    cash = _cash(client, iid, "2026-09-30")
    assert cash["expenses"] == 2000.0
    assert cash["entries_net"] == 0.0
    assert cash["projected"] == -1000.0


def test_an_entry_that_is_the_payment_replaces_the_flow(client):
    """The rent's money left on the 6th, stated by the statement. One figure
    moves the register: the entry's exact −2000, and the flow's occurrence
    nothing. Counting both would read −3000 of an account that paid 2000."""
    iid = _account(client)
    _anchor(client, iid, "2026-09-01", 1000.0)
    _rent(client, iid)
    _entry(client, iid, "2026-09-06", 2000.0)

    cash = _cash(client, iid, "2026-09-30")
    assert cash["expenses"] == 0.0, "the flow's occurrence is the entry's now"
    assert cash["entries_net"] == -2000.0
    assert cash["projected"] == -1000.0


def test_an_entry_of_another_sum_is_not_the_payment(client):
    """1950 is not 2000 — a partial payment, a stranger's bill, anything.
    Nothing is claimed for it: both figures count, each as it is."""
    iid = _account(client)
    _anchor(client, iid, "2026-09-01", 1000.0)
    _rent(client, iid)
    _entry(client, iid, "2026-09-06", 1950.0)

    cash = _cash(client, iid, "2026-09-30")
    assert cash["expenses"] == 2000.0
    assert cash["entries_net"] == -1950.0
    assert cash["projected"] == -2950.0


def test_an_entry_outside_the_window_is_not_the_payment(client):
    """The same sum on the 25th is a second payment (or the flow's date is
    wrong), not the one due on the 5th: ±5 days is the window."""
    iid = _account(client)
    _anchor(client, iid, "2026-09-01", 1000.0)
    _rent(client, iid)
    _entry(client, iid, "2026-09-25", 2000.0)

    cash = _cash(client, iid, "2026-09-30")
    assert cash["expenses"] == 2000.0
    assert cash["entries_net"] == -2000.0
    assert cash["projected"] == -3000.0


def test_an_income_entry_replaces_an_income_flow_the_same_way(client):
    iid = _account(client)
    _anchor(client, iid, "2026-09-01", 1000.0)
    r = client.post(
        "/api/income-sources",
        json={
            "name": "房租收入",
            "amount": 3000.0,
            "currency": "CNY",
            "frequency": "monthly",
            "start_date": "2026-09-10",
            "institution_id": iid,
            "kind": "passive",
        },
    )
    assert r.status_code == 201, r.text
    _entry(client, iid, "2026-09-10", 3000.0, direction="in")

    cash = _cash(client, iid, "2026-09-30")
    assert cash["income"] == 0.0
    assert cash["entries_net"] == 3000.0
    assert cash["projected"] == 4000.0
