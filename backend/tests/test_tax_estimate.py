"""The declared tax estimate (app/tax.py).

What these tests defend is a LINE, not a calculation: that this stays a flat
percentage the reader declared, applied to two figures the ledger already
holds, and that the figure it produces never reaches a total.

The sharpest one is `test_withholding_skips_the_dividends_the_reader_corrected`.
Only auto-recorded dividends are gross; correcting a row with the broker's real
credit replaces the amount AND clears `estimated` in the same gesture, and
there is no gross/net column to recover the distinction from afterwards. So a
withholding applied to every dividend taxes a second time exactly the rows
somebody took the trouble to correct — the diligent reader punished for their
diligence, which this project has already paid for once (f8c8b5b).
"""

from __future__ import annotations

import datetime

from sqlalchemy import text

from app import advisor, prices, tax
from app.database import SessionLocal


def _institution(client, name="Broker A") -> int:
    return client.post(
        "/api/institutions", json={"name": name, "type": "broker"}
    ).json()["id"]


def _dist_snapshot(client, iid: int, date: str, qty: float = 100) -> int:
    """A distributing position, which is what the dividend catch-up looks for."""
    sid = client.post(
        f"/api/institutions/{iid}/snapshots", json={"date": date}
    ).json()["id"]
    client.post(
        f"/api/snapshots/{sid}/holdings",
        json={
            "asset_name": "Vanguard All-World Dist",
            "asset_class": "fund_etf",
            "symbol": "VWRL.MI",
            "quantity": qty,
            "unit_price": 100,
            "distribution_policy": "dist",
            "currency": "EUR",
        },
    )
    return sid


def _set_rates(client, **kw):
    payload = {
        "country": None,
        "capital_gains_rate": None,
        "dividend_withholding_rate": None,
        **kw,
    }
    r = client.put("/api/settings/tax", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def _portfolio(client) -> dict:
    return client.get("/api/dashboard/portfolio").json()


# --- The trap ---------------------------------------------------------------


def test_auto_recorded_dividends_are_gross_and_a_correction_clears_the_flag(
    client, monkeypatch
):
    """The documented behaviour this whole feature rests on, measured rather
    than trusted: `models.py` says editing a row clears `estimated`, and if
    that ever stopped being true the withholding below would silently start
    double-taxing corrected rows."""
    iid = _institution(client)
    _dist_snapshot(client, iid, "2026-01-01", qty=100)
    monkeypatch.setattr(
        prices,
        "get_dividends_since",
        lambda sym, since: prices.DividendWindow(
            answered=True,
            dividends=[
                {"date": "2026-03-20", "dps": 1.0},
                {"date": "2026-06-20", "dps": 2.0},
            ],
        ),
    )
    created = client.post("/api/transactions/catch-up").json()["created"]
    assert [(t["amount"], t["estimated"]) for t in created] == [
        (100.0, True),
        (200.0, True),
    ]

    # Correct the first with the real net credit: 100 gross became 74 in the
    # account. One gesture replaces the amount and retires the flag.
    tx = created[0]
    corrected = client.put(
        f"/api/transactions/{tx['id']}",
        json={
            "date": tx["date"],
            "institution_id": iid,
            "kind": "dividend",
            "asset_name": tx["asset_name"],
            "symbol": tx["symbol"],
            "quantity": tx["quantity"],
            "unit_price": 0.74,
            "amount": 74.0,
            "currency": "EUR", "price_currency": "EUR",
        },
    ).json()
    assert corrected["amount"] == 74.0 and corrected["estimated"] is False


def test_withholding_skips_the_dividends_the_reader_corrected(client, monkeypatch):
    """The point of the whole brief.

    Two dividends, 100 and 200 gross. The reader corrects the first to its real
    net credit of 74. The remaining gross base is 200, NOT the 274 the ledger
    now sums to: 26% of 274 would take a second bite out of the 74 that was
    already net when it was typed in."""
    iid = _institution(client)
    _dist_snapshot(client, iid, "2026-01-01", qty=100)
    monkeypatch.setattr(
        prices,
        "get_dividends_since",
        lambda sym, since: prices.DividendWindow(
            answered=True,
            dividends=[
                {"date": "2026-03-20", "dps": 1.0},
                {"date": "2026-06-20", "dps": 2.0},
            ],
        ),
    )
    created = client.post("/api/transactions/catch-up").json()["created"]
    tx = created[0]
    client.put(
        f"/api/transactions/{tx['id']}",
        json={
            "date": tx["date"],
            "institution_id": iid,
            "kind": "dividend",
            "asset_name": tx["asset_name"],
            "symbol": tx["symbol"],
            "quantity": tx["quantity"],
            "unit_price": 0.74,
            "amount": 74.0,
            "currency": "EUR", "price_currency": "EUR",
        },
    )
    _set_rates(client, country="Italy", dividend_withholding_rate=26)

    p = _portfolio(client)
    assert p["total_dividends"] == 274.0  # what was actually collected
    assert p["total_dividends_estimated"] == 200.0  # only the uncorrected row

    est = p["tax_estimate"]
    assert est["dividends_gross_estimated"] == 200.0
    assert est["dividends_recorded_net"] == 74.0
    assert est["dividend_withholding"] == 52.0  # 26% of 200, not of 274
    assert any("corrected by hand" in c for c in est["caveats"])
    assert not any("74" in c for c in est["caveats"])  # the amount is a field


def test_the_gross_share_is_a_per_row_figure_too(client, monkeypatch):
    """`dividends_estimated` sits on the row as well as the total, so a reader
    can see WHICH position is still carrying a market figure."""
    iid = _institution(client)
    _dist_snapshot(client, iid, "2026-01-01", qty=100)
    monkeypatch.setattr(
        prices,
        "get_dividends_since",
        lambda sym, since: prices.DividendWindow(answered=True, dividends=[{"date": "2026-03-20", "dps": 1.0}]),
    )
    client.post("/api/transactions/catch-up")
    row = _portfolio(client)["rows"][0]
    assert row["dividends"] == 100.0 and row["dividends_estimated"] == 100.0


# --- The realized gain ------------------------------------------------------


def _bought_and_sold(client, iid: int, proceeds: float) -> None:
    """Buy 10 at 100, sell all 10 for `proceeds` — realized = proceeds − 1000."""
    client.post(
        "/api/transactions",
        json={
            "date": "2026-02-01",
            "institution_id": iid,
            "asset_name": "Vanguard All-World",
            "symbol": "VWCE.MI",
            "asset_class": "fund_etf",
            "quantity": 10,
            "unit_price": 100,
            "currency": "EUR",
            "price_currency": "EUR",
        },
    )
    client.post(
        "/api/transactions",
        json={
            "date": "2026-05-01",
            "institution_id": iid,
            "kind": "sell",
            "asset_name": "Vanguard All-World",
            "symbol": "VWCE.MI",
            "asset_class": "fund_etf",
            "quantity": 10,
            "unit_price": proceeds / 10,
            "amount": proceeds,
            "currency": "EUR", "price_currency": "EUR",
        },
    )


def test_a_realized_gain_is_taxed_at_the_declared_rate(client):
    iid = _institution(client)
    _bought_and_sold(client, iid, proceeds=1400)
    _set_rates(client, country="Italy", capital_gains_rate=26)

    est = _portfolio(client)["tax_estimate"]
    assert est["realized_gain"] == 400.0
    assert est["taxable_gain"] == 400.0
    assert est["capital_gains_tax"] == 104.0  # 26% of 400
    assert est["regime"] == "imposta sostitutiva, 26% on both"


def test_a_realized_loss_produces_no_negative_tax_and_says_why(client):
    """A loss is not a refund. Letting the rate run over a negative base would
    print a credit the reader does not have, and netting it into a total would
    make the app's tax figure go DOWN when an investment went badly."""
    iid = _institution(client)
    _bought_and_sold(client, iid, proceeds=700)
    _set_rates(client, country="Italy", capital_gains_rate=26)

    est = _portfolio(client)["tax_estimate"]
    assert est["realized_gain"] == -300.0  # kept signed and visible
    assert est["taxable_gain"] == 0.0
    assert est["capital_gains_tax"] == 0.0
    assert any("is a LOSS" in c for c in est["caveats"])
    assert any("offset later gains" in c for c in est["caveats"])
    # No amount is baked into the prose: the figure is a FIELD, because only
    # the caller knows how to punctuate a currency for this reader.
    assert not any("300" in c for c in est["caveats"])


def test_the_average_cost_basis_is_disclosed_not_hidden(client):
    """The estimate is approximate for a second reason beyond the flat rate:
    `realized_pl` is computed at average cost, and Italy matches disposals LIFO
    while Germany uses FIFO. A reader comparing this against a broker's report
    must be told that before they conclude one of them is broken."""
    iid = _institution(client)
    _bought_and_sold(client, iid, proceeds=1400)
    _set_rates(client, country="Italy", capital_gains_rate=26)
    est = _portfolio(client)["tax_estimate"]
    assert any("AVERAGE cost" in c and "LIFO" in c for c in est["caveats"])
    assert any("not a tax year" in c for c in est["caveats"])


# --- Nothing set at all -----------------------------------------------------


def test_no_rate_set_is_an_absence_with_a_reason_not_a_zero(client):
    """"Nobody answered" and "there is nothing there" are different claims.
    With no rate the estimate reports the BASES — which are real, and worth
    reading on their own — and null for every figure derived from a rate."""
    iid = _institution(client)
    _bought_and_sold(client, iid, proceeds=1400)

    est = _portfolio(client)["tax_estimate"]
    assert est["configured"] is False
    assert est["capital_gains_rate"] is None
    assert est["capital_gains_tax"] is None  # null, never 0.0
    assert est["total"] is None
    assert est["taxable_gain"] == 400.0  # the base is still stated
    assert est["missing_rates"] == ["capital gains"]


def test_a_half_set_rate_refuses_to_total(client, monkeypatch):
    """One rate set, two non-empty bases. The half that can be computed is
    shown; the TOTAL is withheld, because a sum missing one of its halves reads
    as the whole tax and is not."""
    iid = _institution(client)
    _bought_and_sold(client, iid, proceeds=1400)
    _dist_snapshot(client, iid, "2026-01-01", qty=100)
    monkeypatch.setattr(
        prices,
        "get_dividends_since",
        lambda sym, since: prices.DividendWindow(answered=True, dividends=[{"date": "2026-03-20", "dps": 1.0}]),
    )
    client.post("/api/transactions/catch-up")
    _set_rates(client, country="Italy", capital_gains_rate=26)

    est = _portfolio(client)["tax_estimate"]
    assert est["capital_gains_tax"] == 104.0
    assert est["dividend_withholding"] is None
    assert est["total"] is None
    assert est["missing_rates"] == ["dividend withholding"]


def test_a_base_that_is_empty_needs_no_rate_to_total(client):
    """The mirror image: no dividends at all, so the missing dividend rate is
    not missing from anything and the total stands."""
    iid = _institution(client)
    _bought_and_sold(client, iid, proceeds=1400)
    _set_rates(client, country="Italy", capital_gains_rate=26)

    est = _portfolio(client)["tax_estimate"]
    assert est["missing_rates"] == []
    assert est["total"] == 104.0


# --- The golden rule --------------------------------------------------------


def test_the_tax_figure_enters_no_total(client, monkeypatch):
    """The rule that keeps this an aid to deciding rather than a return.

    Every total is captured before a rate exists and compared after — not
    asserted against hand-computed constants, because the point is that setting
    a rate CHANGED NOTHING, and only the same-numbers-before-and-after shape
    says that."""
    iid = _institution(client)
    client.post(
        f"/api/institutions/{iid}/cash-anchors",
        json={"date": "2026-01-01", "amount": 5000, "currency": "EUR"},
    )
    _bought_and_sold(client, iid, proceeds=1400)
    _dist_snapshot(client, iid, "2026-01-01", qty=100)
    monkeypatch.setattr(
        prices,
        "get_dividends_since",
        lambda sym, since: prices.DividendWindow(answered=True, dividends=[{"date": "2026-03-20", "dps": 1.0}]),
    )
    client.post("/api/transactions/catch-up")

    def _totals() -> dict:
        p = _portfolio(client)
        s = client.get("/api/dashboard/summary").json()
        return {
            "total_book": p["total_book"],
            "total_market": p["total_market"],
            "total_realized": p["total_realized"],
            "total_dividends": p["total_dividends"],
            "net_worth": s["net_worth"],
            "financial_total": s["financial_total"],
        }

    before = _totals()
    _set_rates(
        client, country="Italy", capital_gains_rate=26, dividend_withholding_rate=26
    )
    after = _totals()

    assert before == after
    assert _portfolio(client)["tax_estimate"]["total"] > 0  # and it did compute one


# --- The settings themselves ------------------------------------------------


def test_defaults_are_offered_and_never_applied_behind_the_reader(client):
    """Naming a country does not set a rate. A figure that changed itself
    because a text field changed is a figure nobody declared, and the reader
    could not tell it apart from one they typed."""
    body = _set_rates(client, country="Italy")
    assert body["country"] == "Italy"
    assert body["capital_gains_rate"] is None
    assert body["dividend_withholding_rate"] is None
    assert _portfolio(client)["tax_estimate"]["configured"] is False

    known = {c["country"]: c for c in body["known_countries"]}
    assert set(known) == {"Italy", "Germany", "France", "China"}
    assert known["Italy"]["capital_gains_rate"] == 26.0
    assert known["Germany"]["capital_gains_rate"] == 26.375
    assert known["France"]["capital_gains_rate"] == 31.4
    # China ships NO flat dividend rate: its rate is a schedule by holding
    # period, and one box cannot hold three numbers (PRD §5.1). The schedule
    # arrives as data for the reader to adopt — adopted or not, naming the
    # country set nothing, same as the flat rates above.
    assert known["China"]["dividend_withholding_rate"] is None
    assert known["China"]["dividend_tiers"] == [
        {"days_max": 30, "rate": 20.0},
        {"days_max": 365, "rate": 10.0},
        {"days_max": None, "rate": 0.0},
    ]
    assert body["dividend_tiers"] is None
    # Every shipped rate names the regime it came from and what it flattens.
    assert all(c["regime"] and c["omits"] for c in body["known_countries"])


def test_an_unlisted_country_is_not_a_lesser_case(client):
    """The country is a label and a seed, never a gate. A reader in a country
    this app ships nothing for types their own two figures and gets the
    identical estimate — the only thing being listed buys is the pre-fill."""
    iid = _institution(client)
    _bought_and_sold(client, iid, proceeds=1400)
    _set_rates(client, country="Portugal", capital_gains_rate=28)

    est = _portfolio(client)["tax_estimate"]
    assert est["country"] == "Portugal"
    assert est["configured"] is True
    assert est["capital_gains_tax"] == 112.0  # 28% of 400
    assert est["regime"] is None  # nothing is claimed about a regime we lack
    assert est["total"] == 112.0


def test_a_rate_clears_back_to_unset_rather_than_to_zero(client):
    """Zero is a claim: "I pay no tax". Absent is the other claim: "I have not
    said". Clearing must reach the second, so the key is deleted rather than
    written empty."""
    _set_rates(client, country="Italy", capital_gains_rate=26)
    body = _set_rates(client, country="Italy", capital_gains_rate=None)
    assert body["capital_gains_rate"] is None

    with SessionLocal() as db:
        assert tax.read_rates(db).capital_gains is None
        rows = dict(db.execute(text("SELECT key, value FROM settings")).all())
    assert tax.CAPITAL_GAINS not in rows  # deleted, not stored as ""


def test_an_impossible_rate_is_refused(client):
    for bad in (-1, 101):
        r = client.put(
            "/api/settings/tax",
            json={
                "country": "Italy",
                "capital_gains_rate": bad,
                "dividend_withholding_rate": None,
            },
        )
        assert r.status_code == 422


def test_an_unreadable_stored_rate_degrades_instead_of_breaking_the_page(client):
    """`settings.value` is free text. A row hand-edited to "26%" must not take
    down the portfolio for a figure that sits beside its totals."""
    with SessionLocal() as db:
        db.execute(
            text("INSERT INTO settings (key, value) VALUES (:k, '26%')"),
            {"k": tax.CAPITAL_GAINS},
        )
        db.commit()
    r = client.get("/api/dashboard/portfolio")
    assert r.status_code == 200
    assert r.json()["tax_estimate"]["capital_gains_rate"] is None


# --- What the models are told ----------------------------------------------


def test_the_rate_reaches_the_shared_context_already_computed(client, monkeypatch):
    """`build_context` is read in three places — the advisor chain, the chat,
    and any outside assistant through the MCP server. The rate, the base and
    the product all arrive as text so no model has to compute a tax, which is
    the one thing a model will happily invent a rule for."""
    iid = _institution(client)
    _bought_and_sold(client, iid, proceeds=1400)
    _dist_snapshot(client, iid, "2026-01-01", qty=100)
    monkeypatch.setattr(
        prices,
        "get_dividends_since",
        lambda sym, since: prices.DividendWindow(answered=True, dividends=[{"date": "2026-03-20", "dps": 1.0}]),
    )
    client.post("/api/transactions/catch-up")
    _set_rates(
        client, country="Italy", capital_gains_rate=26, dividend_withholding_rate=26
    )

    with SessionLocal() as db:
        ctx = advisor.build_context(db)

    assert "TAX (declared estimate, NOT in any total above)" in ctx
    assert "realized gain 400.00 at 26% (Italy) = 104.00" in ctx
    assert "gross dividends 100.00 at 26% (Italy) = 26.00" in ctx
    assert "estimated total: 130.00" in ctx
    assert "caveat: " in ctx


def test_a_loss_reads_as_a_loss_in_the_context_not_as_a_zero_tax(client):
    """"Gain 0.00 at 26% = 0.00" would be true and useless. A model reading it
    cannot tell a portfolio that sold nothing from one that sold badly."""
    iid = _institution(client)
    _bought_and_sold(client, iid, proceeds=700)
    _set_rates(client, country="Italy", capital_gains_rate=26)
    with SessionLocal() as db:
        ctx = advisor.build_context(db)
    assert "realized LOSS of 300.00; nothing estimated on it" in ctx


def test_the_context_names_the_corrected_dividends_it_left_alone(client, monkeypatch):
    """Saying only what WAS taxed leaves the model to wonder what happened to
    the rest of a dividend total it can also see."""
    iid = _institution(client)
    _dist_snapshot(client, iid, "2026-01-01", qty=100)
    monkeypatch.setattr(
        prices,
        "get_dividends_since",
        lambda sym, since: prices.DividendWindow(
            answered=True,
            dividends=[
                {"date": "2026-03-20", "dps": 1.0},
                {"date": "2026-06-20", "dps": 2.0},
            ],
        ),
    )
    created = client.post("/api/transactions/catch-up").json()["created"]
    tx = created[0]
    client.put(
        f"/api/transactions/{tx['id']}",
        json={
            "date": tx["date"],
            "institution_id": iid,
            "kind": "dividend",
            "asset_name": tx["asset_name"],
            "symbol": tx["symbol"],
            "quantity": tx["quantity"],
            "unit_price": 0.74,
            "amount": 74.0,
            "currency": "EUR", "price_currency": "EUR",
        },
    )
    _set_rates(client, country="Italy", dividend_withholding_rate=26)
    with SessionLocal() as db:
        ctx = advisor.build_context(db)
    assert "gross dividends 200.00 at 26% (Italy) = 52.00" in ctx
    assert "a further 74.00 was corrected by hand and is already net" in ctx
    # Nothing was sold, so no gain FIGURE line is printed at all — "0.00 at
    # 26%" is a true sentence and one more number for a model to misread. The
    # phrase still occurs in the average-cost caveat, which is why this matches
    # the rendered line rather than the words.
    assert "- realized gain" not in ctx


def test_with_no_rate_the_context_says_so_instead_of_going_quiet(client):
    """Silence would read as "no tax applies". The document names the bases a
    rate would have applied to and tells the model not to invent one."""
    iid = _institution(client)
    _bought_and_sold(client, iid, proceeds=1400)
    with SessionLocal() as db:
        ctx = advisor.build_context(db)
    assert "TAX: no rate set, so no estimate is made" in ctx
    assert "The realized result is +400.00" in ctx
    assert "do not estimate a tax yourself" in ctx


def test_a_declared_rate_travels_even_with_nothing_to_tax(client):
    """The screen hides a zero row; the context does not hide the RATE.

    "What would I pay if I sold this" is a question the model gets asked, and
    with no figure in front of it a model reaches for a rule it half-remembers.
    A page and a prompt want different silences."""
    _institution(client)
    _set_rates(client, country="Italy", capital_gains_rate=26)
    with SessionLocal() as db:
        ctx = advisor.build_context(db)
    assert "nothing realized and no gross dividends to estimate on yet" in ctx
    assert "capital gains 26% (Italy)" in ctx or "(Italy) are capital gains 26%" in ctx
    assert "do not substitute your own" in ctx


def test_with_no_rate_and_nothing_to_tax_the_context_stays_silent(client):
    """A prompt for a setting nothing would use is noise. The absence is only
    worth stating when there is a base it is an absence of."""
    _institution(client)
    with SessionLocal() as db:
        ctx = advisor.build_context(db)
    assert "TAX" not in ctx


# --- The line this must not cross ------------------------------------------


def test_there_is_exactly_one_rule_per_figure(client):
    """A guard on the brief's own boundary rather than on an output — and on
    the one place that boundary was deliberately crossed (PRD §5.1, the
    amendment at the top of app/tax.py).

    The paragraph this test was written from named a holding-period rule as
    the edit that ends the module. China's dividend tax IS a holding-period
    rule — 20%/10%/免征 is the headline — so the schedule was let in as the
    single exception, shaped so the rest of the boundary still holds
    STRUCTURALLY rather than by discipline:

    - one figure takes EITHER a flat rate OR a schedule's step, never both: a
      flat rate typed beside a schedule wins (`tax.estimate`);
    - `Default` still carries nothing but rates and prose — a schedule is
      data (days-held -> rate), not a rule keyed by what an instrument IS, so
      there is still no second rule in here;
    - every entry still names its carve-outs in `omits`, which is what keeps
      this table honest at any width.

    What would still end the module: a bond rate, a fund wrapper, anything
    keyed by instrument or account type. Those stay unrepresentable on
    purpose, and this asserts it."""
    import dataclasses

    fields = {f.name for f in dataclasses.fields(tax.Default)}
    assert fields == {
        "capital_gains",
        "dividend_withholding",
        "regime",
        "omits",
        "dividend_tiers",
    }
    for name, d in tax.DEFAULTS.items():
        assert isinstance(d.capital_gains, float)
        assert d.dividend_withholding is None or isinstance(d.dividend_withholding, float)
        if d.dividend_tiers is not None:
            # A schedule stands in for the flat rate on the SAME figure rather
            # than adding a rule beside it, and its last step is the uncapped
            # tail — one figure, one answer, at every holding age.
            assert d.dividend_withholding is None
            assert d.dividend_tiers[-1][0] is None
        assert d.omits, f"{name} flattens carve-outs and must name them"


# --- The schedule (PRD §5.1) ----------------------------------------------


CN = tax.Rates(
    country="China",
    capital_gains=0.0,
    dividend_withholding=None,
    dividend_tiers=((30, 20.0), (365, 10.0), (None, 0.0)),
)


def test_a_declared_schedule_taxes_each_dividend_at_its_own_tier():
    """A股股息红利差别化: 20% held a month or less, 10% up to a year, nothing
    beyond — applied to each dividend at the age of the shares that earned it,
    and the split shown rather than folded into one figure."""
    est = tax.estimate(
        CN,
        realized=1000.0,
        dividends_estimated=300.0,
        dividends_recorded=0.0,
        dividends_held_for=[(100.0, 20), (100.0, 200), (100.0, 800)],
    )
    assert est["capital_gains_tax"] == 0.0  # A 股转让价差暂免
    assert est["dividend_withholding"] == 30.0  # 20 + 10 + 0
    assert est["dividends_by_rate"] == [
        {"rate": 0.0, "amount": 100.0},
        {"rate": 10.0, "amount": 100.0},
        {"rate": 20.0, "amount": 100.0},
    ]
    assert est["total"] == 30.0
    assert est["missing_rates"] == []


def test_the_tier_boundaries_are_the_law_s_own():
    """1 个月以内 20%, 1 个月以上至 1 年 10%, 1 年以上免征: the caps are
    inclusive, and only a day past one moves down (财税[2015]101号)."""
    tiers = CN.dividend_tiers
    assert tax._tier_rate(tiers, 0) == 20.0
    assert tax._tier_rate(tiers, 30) == 20.0
    assert tax._tier_rate(tiers, 31) == 10.0
    assert tax._tier_rate(tiers, 365) == 10.0
    assert tax._tier_rate(tiers, 366) == 0.0


def test_a_flat_rate_typed_beside_a_schedule_wins():
    """The more specific declaration: one number the reader typed beats any
    schedule they adopted."""
    flat = tax.Rates(
        country="China",
        capital_gains=0.0,
        dividend_withholding=25.0,
        dividend_tiers=CN.dividend_tiers,
    )
    est = tax.estimate(
        flat,
        realized=0.0,
        dividends_estimated=300.0,
        dividends_recorded=0.0,
        dividends_held_for=[(100.0, 20), (200.0, 800)],
    )
    assert est["dividend_withholding"] == 75.0
    assert est["dividends_by_rate"] == []


def test_a_schedule_with_no_ages_picks_no_tier_and_says_so():
    """A rate cannot be picked without the fact it keys on. The half is named
    in `missing_rates` exactly like an unset rate — the reader is told what to
    supply, not shown a figure the schedule never chose."""
    est = tax.estimate(
        CN, realized=0.0, dividends_estimated=300.0, dividends_recorded=0.0
    )
    assert est["dividend_withholding"] is None
    assert est["missing_rates"] == ["dividend withholding"]


def test_a_declared_schedule_round_trips_through_the_settings(client):
    body = _set_rates(
        client,
        country="China",
        capital_gains_rate=0.0,
        dividend_tiers=[
            {"days_max": 30, "rate": 20.0},
            {"days_max": 365, "rate": 10.0},
            {"days_max": None, "rate": 0.0},
        ],
    )
    assert body["dividend_tiers"] == [
        {"days_max": 30, "rate": 20.0},
        {"days_max": 365, "rate": 10.0},
        {"days_max": None, "rate": 0.0},
    ]
    cleared = _set_rates(client)
    assert cleared["dividend_tiers"] is None


def test_a_dividend_is_aged_across_the_shares_that_earned_it():
    """Where the ages come from (PRD §4.1): one dividend check covers every
    lot held on its ex-date, and each lot's share of it has been held its own
    number of days — first bought, first aged (先进先出). The opening units of
    a photograph carry the photograph's date, the earliest the walk knows."""
    from app import models, positions

    txs = [
        models.Transaction(
            kind="buy",
            date="2026-01-01",
            quantity=10.0,
            unit_price=2.0,
            amount=20.0,
            currency="CNY",
            asset_name="易方达优质精选混合",
            symbol="110011",
        ),
        models.Transaction(
            kind="dividend",
            date="2026-03-31",
            quantity=20.0,
            unit_price=5.0,
            amount=100.0,
            currency="CNY",
            asset_name="易方达优质精选混合",
            symbol="110011",
            estimated=True,
        ),
    ]
    walked = positions.replay(
        txs, start_qty=10.0, start_date="2025-01-01", start_book=20.0
    )
    split = dict(
        (days, amount) for amount, days in walked.dividends_held
    )
    old = (datetime.date(2026, 3, 31) - datetime.date(2025, 1, 1)).days
    new = (datetime.date(2026, 3, 31) - datetime.date(2026, 1, 1)).days
    assert split[old] == 50.0  # the photograph's units, aged from the photo
    assert split[new] == 50.0  # January's purchase, aged from its own day


def test_a_disposal_takes_the_oldest_shares_first():
    """FIFO, both for the age and for what is left: the shares sold are the
    ones held longest, which is what a Chinese broker's 持股期限 assumes."""
    from app import models, positions

    txs = [
        models.Transaction(
            kind="sell",
            date="2025-06-01",
            quantity=5.0,
            unit_price=3.0,
            amount=15.0,
            currency="CNY",
            asset_name="易方达优质精选混合",
            symbol="110011",
        ),
        models.Transaction(
            kind="dividend",
            date="2026-03-31",
            quantity=5.0,
            unit_price=2.0,
            amount=10.0,
            currency="CNY",
            asset_name="易方达优质精选混合",
            symbol="110011",
            estimated=True,
        ),
    ]
    walked = positions.replay(
        txs, start_qty=10.0, start_date="2025-01-01", start_book=10.0
    )
    # The sale took the oldest half; what paid the dividend is the rest, still
    # aged from the opening.
    days = {d for _, d in walked.dividends_held}
    old = (datetime.date(2026, 3, 31) - datetime.date(2025, 1, 1)).days
    assert days == {old}
