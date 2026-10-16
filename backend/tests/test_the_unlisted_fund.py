"""The fund no exchange lists: priced at its NAV, and read from the report
that names its distributions.

An OTC fund (bought through 支付宝 or 天天基金) has a six-digit code and a
price computed once a day after the close — no ticker, no trades, nothing
either quote screen carries. `otcfund` is its source, and this file is about
the two things the report forces on a reader:

- the distribution is per TEN shares and is divided to per-share at the
  source, once;
- a dividend is what the report NAMES (`FHFCZ10`/`FHSP`), never a difference
  of NAVs — LJJZ − DWJZ jitters ±0.001 daily from rounding (measured
  2026-10-16 on 100032), and deriving from it would file a dividend most
  days of the year.
"""

from __future__ import annotations

import datetime

import pytest

from app import otcfund, prices

REAL_FETCH_CLOSE_WINDOW = prices._fetch_close_window
REAL_FETCH_CURRENCY = prices._fetch_currency
REAL_FETCH_DIVIDENDS = prices._fetch_dividends


# --- Which symbol is a fund -----------------------------------------------


@pytest.mark.parametrize(
    "symbol, code",
    [
        ("110011", "110011"),
        ("110011.OF", "110011"),   # the explicit mark, for the ambiguous band
        ("110011.of", "110011"),
        ("600519.SS", None),       # a listing is not a fund
        ("00700.HK", None),
        ("AAPL", None),
        ("11001", None),           # five digits is a code nothing is
    ],
)
def test_which_symbol_is_an_otc_fund(symbol, code):
    assert otcfund.fund_code(symbol) == code
    assert otcfund.is_fund(symbol) == (code is not None)


# --- Reading the NAV report -----------------------------------------------


def _row(day, nav, cum, fhfcz10="", fhsp=""):
    return {
        "FSRQ": day,
        "DWJZ": str(nav),
        "LJJZ": str(cum),
        "FHFCZ10": fhfcz10,
        "FHSP": fhsp,
    }


def test_a_nav_row_is_read_and_the_distribution_comes_per_share():
    payload = {
        "Data": {
            # The report pages BACKWARDS; what a reader gets is ascending.
            "LSJZList": [
                _row("2025-02-07", 2.15, 2.80),
                _row("2025-02-06", 2.10, 2.815, fhfcz10="0.65"),
                _row("2025-02-05", 2.20, 2.85),
            ]
        }
    }
    assert otcfund.parse_nav_history(payload) == [
        {"date": "2025-02-05", "nav": 2.2, "dps": None},
        {"date": "2025-02-06", "nav": 2.1, "dps": pytest.approx(0.065)},
        {"date": "2025-02-07", "nav": 2.15, "dps": None},
    ]


@pytest.mark.parametrize(
    "fhfcz10, fhsp, dps",
    [
        ("0.7", "", 0.07),                          # the named number wins
        ("", "每10份派现金0.3000元", 0.03),          # the sentence's fallback
        ("", "每份派现金0.0500元", 0.05),            # per ONE, as written
        ("", "每10份基金份额折算1.2份", None),        # a split is not cash
        ("", "", None),
    ],
)
def test_the_distribution_is_the_field_that_names_one(fhfcz10, fhsp, dps):
    row = _row("2025-02-06", 2.1, 2.815, fhfcz10=fhfcz10, fhsp=fhsp)
    got = otcfund._distribution(row)
    if dps is None:
        assert got is None
    else:
        assert got == pytest.approx(dps)


def test_a_row_without_a_number_is_left_out_rather_than_guessed():
    payload = {"Data": {"LSJZList": [
        {"FSRQ": "2025-02-06", "DWJZ": "not-a-number", "LJJZ": "2.8"},
    ]}}
    assert otcfund.parse_nav_history(payload) == []


def test_the_name_is_read_from_its_own_page():
    text = '/** x */\nvar ishb=false;/*基金或股票信息*/var fS_name = "易方达优质精选混合(QDII)";var fS_code = "110011";'
    assert otcfund.parse_name(text) == "易方达优质精选混合(QDII)"
    assert otcfund.parse_name("var fS_name = \"\";") is None
    assert otcfund.parse_name("nothing here") is None


# --- The dispatch, one level up -------------------------------------------


NAV_ROWS = [
    {"date": "2025-02-05", "nav": 2.2, "dps": None},
    {"date": "2025-02-06", "nav": 2.1, "dps": 0.065},
    {"date": "2025-02-07", "nav": 2.15, "dps": None},
]


def test_a_fund_close_window_is_its_navs(monkeypatch):
    seen: list[tuple[str, datetime.date, datetime.date]] = []

    def fake(code, start, end):
        seen.append((code, start, end))
        return NAV_ROWS

    monkeypatch.setattr(otcfund, "fetch_nav", fake)
    rows = REAL_FETCH_CLOSE_WINDOW(
        "110011", datetime.date(2025, 2, 5), datetime.date(2025, 2, 8)
    )
    assert rows == [("2025-02-05", 2.2), ("2025-02-06", 2.1), ("2025-02-07", 2.15)]
    # The seam's window is [start, end); the report's own end is inclusive, so
    # the day taken off here is the contract being kept one level down.
    assert seen == [("110011", datetime.date(2025, 2, 5), datetime.date(2025, 2, 7))]


def test_a_fund_is_valued_in_yuan_with_nothing_to_ask():
    assert REAL_FETCH_CURRENCY("110011") == "CNY"


def test_a_funds_dividends_are_the_report_rows(monkeypatch):
    monkeypatch.setattr(otcfund, "fetch_nav", lambda code, start, end: NAV_ROWS)
    window = REAL_FETCH_DIVIDENDS("110011", "max")
    assert window.answered is True
    assert window.dividends == ({"date": "2025-02-06", "dps": 0.065},)
