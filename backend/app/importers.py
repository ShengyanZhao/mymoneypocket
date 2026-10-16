"""Statement parsers: Alipay and WeChat CSV exports, read into candidates.

The app never reaches into an account (see the PRD's non-goals): a statement
arrives as a FILE the reader exported, and this module's whole job is to read
one honestly. Three rules it keeps:

- ENCODING is detected, not assumed. Alipay and WeChat both write GBK (the
  WeChat file says so in its own header); exports re-saved elsewhere may be
  UTF-8 with a BOM. Wrong guesses turn 商家 into mojibake silently, so the
  detector tries BOM first, then gb18030, then utf-8, and the raw line of an
  unreadable row is what the reader sees.

- A row that cannot be read is SAID (`unreadable`), never dropped. A statement
  parser that silently skips is a total that quietly disagrees with the bank.

- Nothing here decides anything: rows come out as `ImportCandidate`s for the
  reader to confirm. Statuses that are not money moving (a closed order, a
  refund) are skipped WITH their line quoted, and category is a suggestion
  (`suggest_category`) the reader may override before the commit.

Deduplication is NOT here: it is the store's (`crud.known_external_ids`),
because two overlapping files only meet in the database.
"""

from __future__ import annotations

import csv
import datetime
import io
import re

# --- Encodings ------------------------------------------------------------

_BOMS = (
    (b"\xef\xbb\xbf", "utf-8-sig"),
    (b"\xff\xfe", "utf-16"),
    (b"\xfe\xff", "utf-16"),
)


def decode(raw: bytes) -> str:
    """The file's text, from its bytes. BOM wins; then gb18030 (which is what
    both apps actually write, and which never fails on a Chinese byte); utf-8
    last, so a genuinely UTF-8 file whose characters gb18030 would mangle is
    read right too — tried last because gb18030 accepts almost anything."""
    for bom, enc in _BOMS:
        if raw.startswith(bom):
            return raw.decode(enc, errors="replace")
    try:
        return raw.decode("gb18030")
    except UnicodeDecodeError:
        return raw.decode("utf-8", errors="replace")


# --- Merchant -> category, the seed rules ---------------------------------

# The 500-merchant table the PRD names starts here, in the same spirit as the
# instrument catalogue: a suggestion the reader can see through, never a
# verdict. First match wins; matched against the counterparty AND the goods
# column, because Alipay puts the merchant in one and WeChat in the other.
CATEGORY_RULES: tuple[tuple[str, str], ...] = (
    ("美团", "dining"),
    ("饿了么", "dining"),
    ("肯德基", "dining"),
    ("麦当劳", "dining"),
    ("星巴克", "dining"),
    ("瑞幸", "dining"),
    ("滴滴", "transport"),
    ("地铁", "transport"),
    ("铁路", "transport"),
    ("12306", "transport"),
    ("航空", "transport"),
    ("加油", "transport"),
    ("停车", "transport"),
    ("淘宝", "shopping"),
    ("天猫", "shopping"),
    ("京东", "shopping"),
    ("拼多多", "shopping"),
    ("物业", "housing"),
    ("房租", "housing"),
    ("国家电网", "utilities"),
    ("电网", "utilities"),
    ("燃气", "utilities"),
    ("自来水", "utilities"),
    ("水务", "utilities"),
    ("移动", "telecom"),
    ("联通", "telecom"),
    ("电信", "telecom"),
    ("话费", "telecom"),
    ("医院", "medical"),
    ("药", "medical"),
    ("教育", "education"),
    ("学费", "education"),
    ("影院", "entertainment"),
    ("电影", "entertainment"),
    ("游戏", "entertainment"),
    ("酒店", "travel"),
    ("机票", "travel"),
    ("保险", "insurance"),
    ("保费", "insurance"),
    ("还款", "debt_payment"),
    ("花呗", "debt_payment"),
    ("白条", "debt_payment"),
    ("信用卡", "debt_payment"),
    ("红包", "gift"),
    ("转账", "transfer"),
    ("余额宝", "transfer"),
    ("零钱通", "transfer"),
    ("提现", "transfer"),
    ("基金", "investment"),
    ("理财", "investment"),
    ("证券", "investment"),
)


def suggest_category(counterparty: str | None, goods: str | None) -> str | None:
    """A category the rules can see in the row's own words, or None. None is
    the honest answer for most rows, and the preview says so rather than
    filing a stranger's name under "other" where nothing will ever find it."""
    for text in (counterparty, goods):
        if not text:
            continue
        for needle, category in CATEGORY_RULES:
            if needle in text:
                return category
    return None


# --- Rows -----------------------------------------------------------------

# `收/支` words as the two apps spell them. Anything else (不计收支, /) is not
# money moving between the reader and the world, and is said rather than guessed.
_DIRECTION = {"收入": "in", "支出": "out"}

# Status words that mean the money never moved. Everything else counts: the
# two apps spell success a dozen ways (支付成功 / 已收钱 / 对方已收钱 / 入账成功 …)
# and a list of successes would be wrong on the next app version. This list
# names what to REFUSE, which is shorter and stays true.
_NOT_MONEY = ("关闭", "失败", "退款", "冻结")


def _amount(text: str) -> float | None:
    """'¥1,234.56' or '-42' -> 1234.56 / 42.0. A sign is read as direction by
    the caller; here the number is absolute. None when there is no number."""
    cleaned = re.sub(r"[^\d.\-]", "", text or "")
    if not cleaned or cleaned in ("-", ".", "-."):
        return None
    try:
        return abs(float(cleaned))
    except ValueError:
        return None


def _signed(text: str) -> float | None:
    """The amount WITH its sign, for rows that carry one (generic exports)."""
    cleaned = re.sub(r"[^\d.\-]", "", text or "")
    if not cleaned or cleaned in ("-", ".", "-."):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _day(text: str) -> datetime.date | None:
    """'2026-11-03 12:00:07' or '2026/11/3' -> the date. None when unparseable."""
    text = (text or "").strip()[:10].replace("/", "-")
    try:
        return datetime.date.fromisoformat(text)
    except ValueError:
        return None


def _rows_of(text: str) -> tuple[str, list[dict[str, str]], list[str]]:
    """(header line, rows as dicts, unreadable lines).

    Both apps wrap their table in prose: a few banner lines, `----…----`
    rules, then the header, then rows, then a footer of counts. The header is
    the first line that parses into ≥4 columns with no empty name; everything
    before it is decoration and everything after the rows is a footer, said if
    it looked like data."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    header_at = None
    for i, line in enumerate(lines):
        try:
            names = [n.strip().strip('"') for n in next(csv.reader([line]))]
        except (csv.Error, StopIteration):
            continue
        if len(names) >= 4 and all(names) and any("时间" in n or "号" in n or "金额" in n for n in names):
            header_at = i
            break
    if header_at is None:
        return "", [], ["\n".join(lines[:3])] if lines else []

    header = [n.strip().strip('"') for n in next(csv.reader([lines[header_at]]))]
    rows: list[dict[str, str]] = []
    unreadable: list[str] = []
    for line in lines[header_at + 1 :]:
        if re.match(r"^-{5,}", line.strip()) or line.startswith("共"):
            continue  # a rule or the footer's count
        try:
            values = [v.strip().strip('"') for v in next(csv.reader([line]))]
        except (csv.Error, StopIteration):
            unreadable.append(line)
            continue
        if len(values) < len(header):
            unreadable.append(line)
            continue
        rows.append(dict(zip(header, values)))
    return lines[header_at], rows, unreadable


def _first(row: dict[str, str], *names: str) -> str | None:
    """The first column of `names` that has something in it. Alipay and WeChat
    rename columns between versions (and translations between languages); a
    parser that needs one exact header breaks on the next app update."""
    for name in names:
        for key, value in row.items():
            if name in key and value:
                return value
    return None


# --- The two statements ---------------------------------------------------


def parse_alipay(text: str) -> list[dict]:
    """Alipay's `alipay_record_*.csv` into row dicts the candidates builder
    reads. Columns by meaning, not position: 交易号, 交易对方, 商品名称,
    金额（元）, 收/支, 交易状态, 付款时间/交易创建时间."""
    _, rows, unreadable = _rows_of(text)
    out: list[dict] = []
    for row in rows:
        raw = ",".join(row.values())
        day = _day(_first(row, "付款时间", "交易创建时间") or "")
        direction = _DIRECTION.get((_first(row, "收/支") or "").strip())
        amount = _amount(_first(row, "金额") or "")
        status = _first(row, "交易状态") or ""
        external_id = _first(row, "交易号")
        if day is None or direction is None or amount is None:
            unreadable.append(raw)
            continue
        if any(word in status for word in _NOT_MONEY):
            unreadable.append(f"{raw}（{status}，未发生成交）")
            continue
        out.append(
            {
                "date": day,
                "direction": direction,
                "amount": amount,
                "counterparty": _first(row, "交易对方"),
                "goods": _first(row, "商品"),
                "external_id": external_id,
                "note": _first(row, "备注"),
                "raw": raw,
            }
        )
    for line in unreadable:
        _KEEP_UNREADABLE.append(line)
    return out


def parse_wechat(text: str) -> list[dict]:
    """WeChat's `微信支付账单-*.csv` into row dicts. Columns by meaning:
    交易单号, 交易时间, 交易对方, 商品, 收/支, 金额(元), 当前状态, 备注."""
    _, rows, unreadable = _rows_of(text)
    out: list[dict] = []
    for row in rows:
        raw = ",".join(row.values())
        day = _day(_first(row, "交易时间") or "")
        direction = _DIRECTION.get((_first(row, "收/支") or "").strip())
        amount = _amount(_first(row, "金额") or "")
        status = _first(row, "当前状态", "交易状态") or ""
        external_id = _first(row, "交易单号", "商户单号")
        if day is None or direction is None or amount is None:
            unreadable.append(raw)
            continue
        if any(word in status for word in _NOT_MONEY):
            unreadable.append(f"{raw}（{status}，未发生成交）")
            continue
        out.append(
            {
                "date": day,
                "direction": direction,
                "amount": amount,
                "counterparty": _first(row, "交易对方"),
                "goods": _first(row, "商品"),
                "external_id": external_id,
                "note": _first(row, "备注"),
                "raw": raw,
            }
        )
    for line in unreadable:
        _KEEP_UNREADABLE.append(line)
    return out


# Where a parser parked the lines it could not read, until `parse` collects
# them. A function-local list cannot: the parsers are called through one entry
# and return rows, not a report. Kept module-level and reset per call, so one
# parse never shows another's leftovers.
_KEEP_UNREADABLE: list[str] = []

_DETECT = (
    ("alipay", ("交易号", "商家订单号"), parse_alipay),
    ("wechat", ("交易单号", "商户单号"), parse_wechat),
    ("wechat", ("交易时间", "交易类型", "收/支"), parse_wechat),
    ("alipay", ("交易创建时间", "收/支", "交易状态"), parse_alipay),
)


def detect(text: str) -> str | None:
    """Which app wrote this file, from its header line alone. None when it is
    neither — the preview then says so instead of guessing."""
    header, _, _ = _rows_of(text)
    for source, needles, _ in _DETECT:
        if all(n in header for n in needles):
            return source
    return None


def parse(text: str, source: str | None = None) -> tuple[str, list[dict], list[str]]:
    """(source, rows, unreadable) for one statement's text.

    `source` forces a parser; without it the header decides. An unknown file
    is not parsed as something close enough: `source` comes out "unknown" and
    the preview refuses rather than inventing rows."""
    _KEEP_UNREADABLE.clear()
    chosen = source or detect(text)
    parser = next((p for s, _, p in _DETECT if s == chosen), None)
    if parser is None:
        return chosen or "unknown", [], ["无法识别的账单格式（既不是支付宝也不是微信支付导出的账单）"]
    rows = parser(text)
    return chosen, rows, list(_KEEP_UNREADABLE)


# --- Transfer pairs -------------------------------------------------------

_TRANSFER_WORDS = ("转账", "转入", "转出", "提现", "余额宝", "零钱通", "红包")


def find_transfer_pairs(candidates: list[dict]) -> list[tuple[int, int, float]]:
    """(out_index, in_index, confidence) for rows that look like one transfer.

    Two rows, one out and one in, the same sum, within 3 days, and one of them
    naming a transfer (提现 to a bank card, 余额宝 moving in). Both sides live
    in ONE statement — money leaving one pocket of the wallet and entering
    another — so recording both moves the balance exactly once each way and
    they cancel. The mark is for the reader (and the category statistics), not
    for arithmetic."""
    pairs: list[tuple[int, int, float]] = []
    taken: set[int] = set()
    for i, out in enumerate(candidates):
        if out["direction"] != "out" or i in taken:
            continue
        for j, inside in enumerate(candidates):
            if inside["direction"] != "in" or j in taken or i == j:
                continue
            if abs(out["amount"] - inside["amount"]) > 0.01:
                continue
            if abs((out["date"] - inside["date"]).days) > 3:
                continue
            words = "".join(
                str(out.get(k) or "") + str(inside.get(k) or "")
                for k in ("counterparty", "goods", "note")
            )
            if not any(w in words for w in _TRANSFER_WORDS):
                continue
            pairs.append((i, j, 0.8))
            taken.add(i)
            taken.add(j)
            break
    return pairs
