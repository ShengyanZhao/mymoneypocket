"""The home market: A shares, the Shanghai funds and Hong Kong, typed as a
reader types them and read from the sources that carry them natively.

Two promises and the seam between them. A BARE CODE resolves to a listing —
600519 becomes 600519.SS and prices — which is what kept mainland holdings
out of the app before. And what those listings are priced by comes from the
mainland sources first (`cnmarket`), because Yahoo is the one endpoint that
does not answer from a Beijing line: the dispatch lives in `prices._fetch_*`
and falls through to Yahoo whenever the home source is silent.

The PARSE of every answer is tested here without a network: the fetchers are
thin (one GET each) and the reading of the bytes is where the bugs live —
GBK, a per-TEN dividend, a timestamp that spells itself differently in
Shanghai and in Hong Kong.
"""

from __future__ import annotations

import datetime

import pytest

from app import cnmarket, prices

# The real seams, taken before `conftest.offline` replaces them — the same
# trick `test_dividends_are_asked_once_a_day.py` plays.
REAL_FETCH_DIVIDENDS = prices._fetch_dividends
REAL_FETCH_CLOSE_WINDOW = prices._fetch_close_window


def _quote_line(code: str, name: str, price: str, prev: str, date: str, currency: str) -> str:
    """A quote line in Tencent's shape: fields 0-5 as they read, the book and
    filler up to field 30 where the timestamp lives, and the currency along
    the tail. Built rather than pasted so the field POSITIONS being asserted
    are the ones being tested — a moved field is the failure this module
    exists to catch."""
    fields = ["1", name, code[2:], price, prev, price]
    fields += ["0"] * 24  # 6..29: the order book and whatever fills it
    fields += [date, "0.11", "0.02", "0", "0", currency, "0"]
    return f'v_{code}="' + "~".join(fields) + '";'


A_QUOTE = (
    _quote_line("sh600519", "贵州茅台", "1314.41", "1312.97", "20261016132726", "CNY")
    + "\n"
    "not,a,quote,line\n"
    + _quote_line("hk00700", "腾讯控股", "421.200", "417.800", "2026/10/16 13:13:41", "HKD")
    + "\n"
)


# --- What a reader types ---------------------------------------------------


@pytest.mark.parametrize(
    "typed, resolved",
    [
        ("600519", "600519.SS"),    # Kweichow Moutai, Shanghai
        ("000001", "000001.SZ"),    # Ping An Bank, Shenzhen
        ("300750", "300750.SZ"),    # CATL, ChiNext
        ("688981", "688981.SS"),    # SMIC, STAR board
        ("510300", "510300.SS"),    # 沪深300ETF, Shanghai fund
        ("159915", "159915.SZ"),    # 创业板ETF, Shenzhen fund
        ("113050", "113050.SS"),    # a Shanghai convertible
        ("00700", "00700.HK"),      # Tencent, Hong Kong
        ("700", "00700.HK"),        # four digits typed for the same
    ],
)
def test_a_bare_code_resolves_to_a_listing(typed, resolved):
    assert prices.resolve_symbol(typed, "CNY") == resolved


def test_what_is_already_a_symbol_passes_through_untouched():
    for symbol in ("600519.SS", "00700.HK", "VWCE.MI", "AAPL", "BTC-EUR", "110011"):
        assert prices.resolve_symbol(symbol, "CNY") == symbol


def test_a_code_this_cannot_place_stays_as_typed():
    """110011 is an OTC fund code AND the shape of a Shanghai convertible.
    Guessing either way is worse than leaving it: the picker resolves codes,
    and a suffix typed by hand is always believed."""
    assert prices.resolve_symbol("110011", "CNY") == "110011"


def test_a_crypto_name_still_resolves_into_the_base():
    assert prices.resolve_symbol("bitcoin", "CNY") == "BTC-CNY"


@pytest.mark.parametrize(
    "symbol, code",
    [
        ("600519.SS", "sh600519"),
        ("000001.SZ", "sz000001"),
        ("00700.HK", "hk00700"),    # five digits, whatever was typed
        ("830799.BJ", "bj830799"),
        ("AAPL", None),
    ],
)
def test_the_tencent_code_of_a_listing(symbol, code):
    assert cnmarket.tencent_code(symbol) == code
    assert cnmarket.is_cn(symbol) == (code is not None)


# --- Reading Tencent's quotes ---------------------------------------------


def test_a_quote_is_read_for_what_it_carries():
    parsed = cnmarket.parse_quotes(A_QUOTE)
    assert parsed["sh600519"] == {
        "price": 1314.41,
        "name": "贵州茅台",
        "currency": "CNY",
        "as_of": "2026-10-16",
    }
    # Hong Kong spells its timestamp differently (2026/10/16 …) and names its
    # currency further along the line: both read from the words, not a slot.
    hk = parsed["hk00700"]
    assert hk["price"] == 421.2
    assert hk["currency"] == "HKD"
    assert hk["as_of"] == "2026-10-16"


def test_an_unreadable_quote_takes_no_other_quote_down_with_it():
    text = A_QUOTE + 'v_sh000001="51~broken~000001~not-a-price~";\n'
    assert set(cnmarket.parse_quotes(text)) == {"sh600519", "hk00700"}


# --- Reading Tencent's k-lines --------------------------------------------


def test_a_kline_row_is_read_by_its_close():
    payload = {
        "code": 0,
        "data": {
            "sh600519": {
                "day": [
                    ["2026-09-01", "1295.000", "1299.560", "1307.990", "1286.100", "32664.000"],
                    ["2026-09-02", "1302.800", "1297.500", "1303.000", "1291.200", "20308.000"],
                ]
            }
        },
    }
    assert cnmarket.parse_klines(payload, "sh600519") == {
        "2026-09-01": 1299.56,
        "2026-09-02": 1297.5,
    }


# --- Reading Eastmoney's dividends ----------------------------------------


def _dividend_row(day: str, per_ten, progress: str) -> dict:
    return {
        "SECURITY_CODE": "600519",
        "EX_DIVIDEND_DATE": f"{day} 00:00:00",
        "PRETAX_BONUS_RMB": per_ten,
        "ASSIGN_PROGRESS": progress,
    }


def test_a_dividend_is_read_per_share_and_only_once_paid():
    payload = {
        "result": {
            "data": [
                _dividend_row("2026-06-26", 280.2423, "实施分配"),
                _dividend_row("2025-06-27", 276.24, "实施分配"),
                # Announced but not paid: crediting it would book cash the
                # broker has never paid out.
                _dividend_row("2027-06-26", 300.0, "预案"),
                # A share split with no cash is not a dividend.
                _dividend_row("2024-06-28", None, "实施分配"),
            ]
        }
    }
    rows = cnmarket.parse_dividends(payload)
    assert [r["date"] for r in rows] == ["2025-06-27", "2026-06-26"]
    # Per TEN on the report, per ONE here: the division is the whole point of
    # reading it at the source (276.24 / 10 is 27.624 and one bit more).
    assert rows[0]["dps"] == pytest.approx(27.624)
    assert rows[1]["dps"] == pytest.approx(28.02423)


# --- The dispatch, one level up -------------------------------------------


def test_a_mainland_dividend_history_comes_from_the_mainland(monkeypatch):
    """`_fetch_dividends` asks the home report for a Shanghai listing and
    reads its rows the way every other dividend is read (`_read_dividend`).
    The rows it is fed here are what `parse_dividends` produces."""
    monkeypatch.setattr(
        cnmarket,
        "fetch_dividends",
        lambda symbol: [{"date": "2026-06-26", "dps": 28.02423}],
    )
    window = REAL_FETCH_DIVIDENDS("600519.SS")
    assert window.answered is True
    assert window.dividends == ({"date": "2026-06-26", "dps": 28.02423},)


def test_a_home_source_that_is_down_falls_through_to_yahoo(monkeypatch):
    """One source being silent is not an answer about the stock: the Yahoo
    path still runs, and only it being silent too leaves the ticker
    unanswered."""
    import types

    import pandas as pd
    import yfinance

    monkeypatch.setattr(
        cnmarket,
        "fetch_dividends",
        lambda symbol: (_ for _ in ()).throw(OSError("connection refused")),
    )
    index = pd.DatetimeIndex(["2026-03-20"]).tz_localize("Europe/Rome")
    monkeypatch.setattr(
        yfinance,
        "Ticker",
        lambda symbol: types.SimpleNamespace(
            get_dividends=lambda period="max": pd.Series([0.5], index=index)
        ),
    )
    window = REAL_FETCH_DIVIDENDS("600519.SS")
    assert window.answered is True
    assert window.dividends == ({"date": "2026-03-20", "dps": 0.5},)


def test_a_close_window_is_asked_of_the_home_source_first(monkeypatch):
    """The dated window a plan's price comes from (`_close_on`'s rows): the
    home k-lines answer it, and Yahoo is not asked at all."""
    seen: list[tuple[str, datetime.date, datetime.date]] = []

    def fake(symbol, start, end):
        seen.append((symbol, start, end))
        return {"2026-09-01": 1299.56, "2026-09-02": 1297.5}

    monkeypatch.setattr(cnmarket, "fetch_closes", fake)
    rows = REAL_FETCH_CLOSE_WINDOW(
        "600519.SS", datetime.date(2026, 9, 1), datetime.date(2026, 9, 3)
    )
    assert rows == [("2026-09-01", 1299.56), ("2026-09-02", 1297.5)]
    assert seen == [("600519.SS", datetime.date(2026, 9, 1), datetime.date(2026, 9, 3))]
