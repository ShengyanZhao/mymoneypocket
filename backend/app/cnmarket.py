"""The home market: A shares, the Shanghai funds, and Hong Kong — read from
the Chinese sources that carry them natively.

Yahoo prices these listings too (600519.SS, 00700.HK), and through a proxy it
is a fine source. Without one it is the only endpoint that does NOT answer
(the 2026-10 measurement in ROADMAP: 403/429 from a Beijing line while every
other dependency worked), so the mainland chain is home source first and
Yahoo behind it (`prices._fetch_*` dispatches by symbol family). The two
sources agree to the cent on every close compared so far, and where they
would not, the home market is the one its own exchange publishes.

Three sources, each with one job, each PARSE-ONLY where possible so the
reading of an answer is tested without a network in the way:

- Tencent quotes (`qt.gtimg.cn`): the latest price, the name, the currency,
  one request per batch. GBK text, `v_sh600519="1~贵州茅台~600519~..."`.
- Tencent k-lines (`web.ifzq.gtimg.cn`): the daily closes of a window, JSON,
  UNadjusted (`day`, not `qfq`) — the same policy as Yahoo's
  `auto_adjust=False`: a close is what the day traded at, and a dividend goes
  on its own row rather than quietly rewriting history.
- Eastmoney dividends (`datacenter-web.eastmoney.com`): the cash dividends of
  an A share, per-share and tax-UNWITHHELD, only the ones actually
  IMPLEMENTED (实施分配) — an announced plan is not a payment.

Symbols arrive in the normalized shape `resolve_symbol` produces
(600519.SS, 000001.SZ, 00700.HK, 830799.BJ); `tencent_code` is where that
becomes `sh600519`. A suffix this module does not know is not a home-market
symbol and nothing here is asked about it.

HK dividends are NOT here: Eastmoney's report covers the mainland, and an HK
dividend history still comes from Yahoo (the fallback in `_fetch_dividends`)."""

from __future__ import annotations

import datetime
import json
import re
import urllib.parse
import urllib.request

# The suffixes `resolve_symbol` puts on a bare CN code. One place: the
# mapping, the dispatch in `prices` and these checks must not disagree.
SUFFIXES = ("SS", "SZ", "HK", "BJ")

# How long one source may take. Short: these are the same calls the catch-up
# makes at every start, and a slow home source must not be the reason a page
# fails to appear.
_TIMEOUT = 8

_TENCENT_PREFIX = {"SS": "sh", "SZ": "sz", "HK": "hk", "BJ": "bj"}

# What a quote's currency field may say. Scanned rather than indexed: the
# field's position differs between the A-share and the HK answer (measured
# 2026-10-16: CNY around 85, HKD around 88), and a version that moved would
# price a dollar into a yuan without a word.
_CURRENCIES = {"CNY", "HKD", "USD"}


def is_cn(symbol: str) -> bool:
    """Whether `symbol` is one of this module's: a normalized home-market
    listing. Anything else goes to Yahoo and only to Yahoo."""
    return any((symbol or "").upper().endswith("." + s) for s in SUFFIXES)


def tencent_code(symbol: str) -> str | None:
    """'600519.SS' -> 'sh600519', '00700.HK' -> 'hk00700', else None.

    HK codes are five digits and a reader types 700 as often as 00700;
    mainland codes are already six."""
    code, _, suffix = (symbol or "").upper().partition(".")
    prefix = _TENCENT_PREFIX.get(suffix)
    if not prefix or not code:
        return None
    if suffix == "HK":
        code = code.zfill(5)
    return prefix + code.lower()


def _get(url: str) -> bytes:
    """One GET, its bytes. Network call. No headers to forge: these endpoints
    answer a bare client (measured 2026-10-16)."""
    request = urllib.request.Request(url, headers={"User-Agent": "aurelio/1.0"})
    with urllib.request.urlopen(request, timeout=_TIMEOUT) as response:
        return response.read()


# --- Quotes ---------------------------------------------------------------


def parse_quotes(text: str) -> dict[str, dict]:
    """Tencent's answer read: {tencent_code: {price, name, currency, as_of}}.

    Each line is `v_sh600519="1~贵州茅台~600519~1314.41~1312.97~..."`
    (GBK, decoded before this sees it). Fields by position that has not moved
    between the two markets measured: 1 name, 3 the last price, 4 the previous
    close, 30 the timestamp. A line whose shape is anything else is skipped:
    one unreadable quote must not take the batch down with it."""
    out: dict[str, dict] = {}
    for line in (text or "").splitlines():
        m = re.match(r'v_([a-z]{2}[0-9a-z]+)="([^"]*)"', line.strip())
        if not m:
            continue
        code, body = m.group(1), m.group(2)
        fields = body.split("~")
        if len(fields) < 31:
            continue
        try:
            price = float(fields[3])
        except ValueError:
            continue
        day = _quote_date(fields[30])
        if day is None:
            continue
        currency = next((f for f in fields if f in _CURRENCIES), None)
        out[code] = {
            "price": price,
            "name": fields[1] or None,
            "currency": currency,
            "as_of": day,
        }
    return out


def _quote_date(stamp: str) -> str | None:
    """A quote's timestamp as its day: '20261016132850' and
    '2026/10/16 13:13:41' both say 2026-10-16 (the two markets spell it
    differently). None when it says nothing."""
    digits = re.sub(r"\D", "", stamp or "")
    if len(digits) < 8:
        return None
    try:
        return datetime.date.fromisoformat(
            f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
        ).isoformat()
    except ValueError:
        return None


def fetch_quotes(symbols: list[str]) -> dict[str, dict]:
    """{symbol: {price, name, currency, as_of}} for the home-market listings
    among `symbols`. One request for the batch. Symbols with no answer are
    absent — the caller falls back or prices nothing for them."""
    wanted = [(s, tencent_code(s)) for s in symbols]
    wanted = [(s, c) for s, c in wanted if c]
    if not wanted:
        return {}
    url = "https://qt.gtimg.cn/q=" + ",".join(c for _, c in wanted)
    text = _get(url).decode("gbk", errors="replace")
    parsed = parse_quotes(text)
    return {
        symbol: parsed[code]
        for symbol, code in wanted
        if code in parsed and parsed[code]["price"] > 0
    }


# --- K-lines --------------------------------------------------------------


def parse_klines(payload: dict, code: str) -> dict[str, float]:
    """{day_iso: close} from a Tencent k-line answer, UNadjusted (`day` rows).

    Each row is [date, open, close, high, low, volume] — close is the third
    (index 2), which is the one field whose position the sample checked and
    the reason the row is read by index here at all."""
    data = (payload or {}).get("data") or {}
    rows = ((data.get(code) or {}).get("day")) or []
    out: dict[str, float] = {}
    for row in rows:
        if len(row) < 3:
            continue
        try:
            out[str(row[0])[:10]] = float(row[2])
        except (TypeError, ValueError):
            continue
    return out


def fetch_closes(symbol: str, start: datetime.date, end: datetime.date) -> dict[str, float]:
    """{day_iso: close} for the sessions of `symbol` in [start, end). Network
    call. Days the market was closed are simply absent, which is what the
    close-window seam's caller expects: a missing row and a holiday are the
    same fact at this level, and `_close_on` tells them apart by what came
    after."""
    code = tencent_code(symbol)
    if code is None:
        return {}
    # 300 rows is years of daily closes; the caller asks for a window of days.
    url = (
        "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?"
        + urllib.parse.urlencode(
            {"param": f"{code},day,{start.isoformat()},{end.isoformat()},300,"}
        )
    )
    payload = json.loads(_get(url).decode("utf-8", errors="replace"))
    # The API's end date is INCLUSIVE and the seam's contract is [start, end):
    # a window that ends on a day must not see that day's row, or a caller
    # asking "what ended before today" reads today's still-trading prices.
    return {
        day: close
        for day, close in parse_klines(payload, code).items()
        if start.isoformat() <= day < end.isoformat()
    }


# --- Dividends ------------------------------------------------------------


def parse_dividends(payload: dict) -> list[dict]:
    """[{date, dps}] — every IMPLEMENTED cash dividend of an A share,
    ascending, as `_read_dividend` reads one.

    Two readings the report forces. `PRETAX_BONUS_RMB` is per TEN shares
    ("10派280.2423元"), and every per-share figure this app carries is per
    ONE, so it is divided here — once, at the source, rather than trusting
    every reader to know. And only 实施分配 rows are payments: 预案 and
    股东大会通过 are announcements, and recording one as a dividend credits
    cash the broker has not paid. A row with no cash (送转 only) is not a
    dividend and is left out, as a zero is in `prices._read_dividend`."""
    rows = ((payload or {}).get("result") or {}).get("data") or []
    out: list[dict] = []
    for row in rows:
        if row.get("ASSIGN_PROGRESS") != "实施分配":
            continue
        per_ten = row.get("PRETAX_BONUS_RMB")
        day = str(row.get("EX_DIVIDEND_DATE") or "")[:10]
        try:
            dps = float(per_ten) / 10.0
        except (TypeError, ValueError):
            continue
        if not day or dps <= 0:
            continue
        out.append({"date": day, "dps": dps})
    return sorted(out, key=lambda d: d["date"])


def fetch_dividends(symbol: str) -> list[dict]:
    """Every implemented cash dividend of an A share. Network call.

    Only the mainland: Eastmoney's dividend report covers the A market, and
    an HK history still comes from Yahoo (`prices._fetch_dividends` keeps the
    fallback). An answer nobody returns raises, which the caller reads as
    "not answered" — never as "pays nothing"."""
    code = tencent_code(symbol)
    if code is None or not code.startswith(("sh", "sz")):
        return []
    security = code[2:]
    url = (
        "https://datacenter-web.eastmoney.com/api/data/v1/get?"
        + urllib.parse.urlencode(
            {
                "reportName": "RPT_SHAREBONUS_DET",
                "columns": "ALL",
                "pageNumber": 1,
                "pageSize": 50,
                "sortTypes": -1,
                "sortColumns": "EX_DIVIDEND_DATE",
                "filter": f'(SECURITY_CODE="{security}")',
            }
        )
    )
    payload = json.loads(
        _get(url).decode("utf-8", errors="replace")
    )
    return parse_dividends(payload)
