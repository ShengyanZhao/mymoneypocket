"""The unlisted fund: an OTC fund's net asset value, from the mainland's own
history report.

A fund bought through 支付宝 or 天天基金 has no exchange listing — no ticker
on any quote screen — only a six-digit code and a NAV published once a day
after the close. It is the one instrument class `cnmarket` cannot price (that
module is quotes and k-lines, things that TRADE) and Yahoo cannot see either,
so it has its own source and its own shape:

- Eastmoney's history report (`api.fund.eastmoney.com/f10/lsjz`): one row per
  valuation day — `FSRQ` the day, `DWJZ` the unit NAV, `LJJZ` the cumulative
  NAV, `FHFCZ10` the distribution, "每10份派现金" as the report itself puts
  it. Twenty rows to a page, paged backwards; `startDate`/`endDate` bound it.
- The fund's name from `fund.eastmoney.com/pingzhongdata/{code}.js`, read a
  few KB and stopped: the name is at the top of a file that is megabytes of
  history below it.

Two readings the report forces, both said where they happen. The dividend is
per TEN shares (like the A-share report) and is divided to per-share HERE,
once. And a dividend is what `FHFCZ10` NAMES, never a difference of NAVs:
LJJZ − DWJZ is the accumulated distribution in theory, but both figures are
rounded to four decimals and their difference jitters ±0.001 every day
(measured 2026-10-16 on 100032's 430 rows) — a derivation that would file a
dividend on most days of the year. The named field was right on the two real
dividends in that window and silent on every other row, which is the check.

Which symbol is one of these: a bare six-digit code, or one marked `.OF`.
Both arrive here only where a LISTING was ruled out first — `resolve_symbol`
maps every code it can place to a market suffix and leaves exactly the
ambiguous band (110011 the fund vs 110079 the convertible) bare. A fund NAV
is in yuan whatever the fund holds: a QDII's overseas assets are converted
into CNY per share, and CNY is what every NAV here returns."""

from __future__ import annotations

import datetime
import json
import re
import urllib.parse
import urllib.request

_TIMEOUT = 8

# How many pages of history one fetch walks. Twenty rows to a page, so this
# is 600 valuation days — years of dividends, and the window a caller asks
# for is bounded by `startDate` long before this is reached. A cap rather
# than "until the end": a fund with a decade of rows must not turn one
# dividend check into thirty requests.
_MAX_PAGES = 30


def fund_code(symbol: str) -> str | None:
    """'110011' or '110011.OF' -> '110011'; anything with another market's
    suffix, or that is not six digits, is not one of these -> None."""
    raw = (symbol or "").strip().upper()
    code, _, suffix = raw.partition(".")
    if suffix and suffix != "OF":
        return None
    return code if re.fullmatch(r"\d{6}", code) else None


def is_fund(symbol: str) -> bool:
    return fund_code(symbol) is not None


def parse_nav_history(payload: dict) -> list[dict]:
    """The report's rows as [{date, nav, dps}], ascending.

    `dps` is the row's distribution per share (None on an ordinary day):
    `FHFCZ10` is per TEN and is divided here. The FHSP sentence ("每10份派现
    金0.6500元") is read as a fallback for the rows that carry words and no
    number; a sentence this does not recognize is left out rather than
    guessed at."""
    rows = ((payload or {}).get("Data") or {}).get("LSJZList") or []
    out: list[dict] = []
    for row in rows:
        day = str(row.get("FSRQ") or "")[:10]
        try:
            nav = float(row.get("DWJZ"))
        except (TypeError, ValueError):
            continue
        if not day:
            continue
        out.append({"date": day, "nav": nav, "dps": _distribution(row)})
    return sorted(out, key=lambda r: r["date"])


def _distribution(row: dict) -> float | None:
    """One row's per-share cash distribution, or None."""
    per_ten = row.get("FHFCZ10")
    try:
        if per_ten not in (None, ""):
            value = float(per_ten) / 10.0
            return value if value > 0 else None
    except (TypeError, ValueError):
        pass
    words = str(row.get("FHSP") or "")
    m = re.search(r"每\s*10\s*份[^0-9]*([0-9.]+)\s*元", words)
    if m:
        value = float(m.group(1)) / 10.0
        return value if value > 0 else None
    m = re.search(r"每\s*份[^0-9]*([0-9.]+)\s*元", words)
    if m:
        value = float(m.group(1))
        return value if value > 0 else None
    return None


def parse_name(text: str) -> str | None:
    """`var fS_name = "易方达优质精选混合(QDII)";` -> the name."""
    m = re.search(r'fS_name\s*=\s*"([^"]+)"', text or "")
    return m.group(1).strip() or None if m else None


def _get(url: str, headers: dict[str, str] | None = None, limit: int | None = None) -> bytes:
    """One GET, its bytes. Network call. `limit` stops reading early — the
    name file is megabytes and its name is in the first few hundred bytes."""
    request = urllib.request.Request(url, headers={"User-Agent": "aurelio/1.0", **(headers or {})})
    with urllib.request.urlopen(request, timeout=_TIMEOUT) as response:
        return response.read(limit) if limit else response.read()


def fetch_nav(code: str, start: datetime.date, end: datetime.date) -> list[dict]:
    """The fund's valuation rows in [start, end], each `{date, nav, dps}`.
    Network call. Paged backwards through the report until the window is
    covered or `_MAX_PAGES` says stop."""
    out: list[dict] = []
    for page in range(1, _MAX_PAGES + 1):
        url = (
            "https://api.fund.eastmoney.com/f10/lsjz?"
            + urllib.parse.urlencode(
                {
                    "fundCode": code,
                    "pageIndex": page,
                    "pageSize": 20,
                    "startDate": start.isoformat(),
                    "endDate": end.isoformat(),
                }
            )
        )
        rows = parse_nav_history(
            json.loads(_get(url, headers={"Referer": "https://fundf10.eastmoney.com/"}).decode("utf-8", errors="replace"))
        )
        out = rows + out  # pages walk BACKWARDS in time
        if len(rows) < 20 or (rows and rows[0]["date"] <= start.isoformat()):
            break
    return out


def fetch_name(code: str) -> str | None:
    """The fund's own name. Network call, a few KB only (see `_get`)."""
    text = _get(
        f"https://fund.eastmoney.com/pingzhongdata/{code}.js", limit=4096
    ).decode("utf-8", errors="replace")
    return parse_name(text)
