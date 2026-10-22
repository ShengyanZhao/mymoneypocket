"""What a loan costs, worked out rather than remembered (PRD v3 §4.4).

负债 2.0. Three questions, all arithmetic. What does the schedule look like —
the month's payment, its split into principal and interest, and the balance
walking down (等额本息 and 等额本金, the two ways Chinese mortgages are
written). What does paying 200,000 today actually save — and is saving it
better than investing it. And what does a 12-period instalment really cost
per year when the fee is called a fee.

Numbers first and words after: everything here is a pure function of the
plan's own fields, so the page, the forecast and the tests read the same
figures from the same place. The READER's balance stays the anchor —
`LiabilityBalance` rows say what the bank says, and the plan beside them is
a projection whose difference from the anchor is always named (it is usually
a prepayment, and the page says so).

The IRR is solved the way `planning.required_annual_return` solves its own —
bisection on the monthly rate — because a second numerical method in one
codebase is a second set of edge cases for no gain."""

from __future__ import annotations

import datetime
import math
from dataclasses import dataclass

from app.analytics import add_months

# How the loan is repaid. 等额本息: the payment never changes and the split
# inside it does; 等额本金: the principal part never changes and the payment
# shrinks. Nearly every Chinese mortgage is one of the two.
ANNUITY = "annuity"
EQUAL_PRINCIPAL = "equal_principal"


@dataclass(frozen=True)
class Payment:
    """One period of a loan: what leaves, what it is made of, what is left."""

    period: int
    date: str
    payment: float
    principal: float
    interest: float
    remaining: float


def _validate(part: dict) -> tuple[float, int, float]:
    principal = float(part["principal"])
    months = int(part["term_months"])
    rate = float(part.get("rate") or 0.0)
    if principal <= 0 or months <= 0:
        raise ValueError("a loan part needs a positive principal and term")
    return principal, months, rate / 12.0


def remaining_after(part: dict, periods: int | None = None) -> float:
    """What is left of a part after `periods` payments (default: all its
    paid ones). The closed forms every bank's schedule agrees with.

    等额本息:  B = P·((1+i)^n − (1+i)^k) / ((1+i)^n − 1)
    等额本金:  B = P·(1 − k/n)"""
    principal, months, i = _validate(part)
    k = int(part.get("paid_periods") or 0) if periods is None else periods
    k = max(0, min(k, months))
    if part.get("method") == EQUAL_PRINCIPAL:
        return round(principal * (1 - k / months), 2)
    if i == 0:
        return round(principal * (1 - k / months), 2)
    g = (1 + i) ** months
    return round(principal * (g - (1 + i) ** k) / (g - 1), 2)


def annuity_payment(principal: float, months: int, monthly_rate: float) -> float:
    """The payment that clears `principal` in `months` periods — 等额本息."""
    if monthly_rate == 0:
        return round(principal / months, 2)
    g = (1 + monthly_rate) ** months
    return round(principal * monthly_rate * g / (g - 1), 2)


def part_schedule(part: dict) -> list[Payment]:
    """Every payment still to come on one part, from the next period to the
    last. The dates are the start's day of each month (clamped to a short
    month's end, the way every recurrence here clamps).

    The balance runs at FULL precision and only the printed figures are
    rounded: rounding every step's principal is how a schedule drifts cents
    per period and hands the drift to the last payment — 2.43 on a 30-year
    mortgage, measured before this was fixed. The last payment absorbs
    whatever is genuinely left, as a bank's does."""
    principal, months, i = _validate(part)
    start = datetime.date.fromisoformat(part["start_date"])
    paid = max(0, min(int(part.get("paid_periods") or 0), months))
    method = part.get("method") or ANNUITY
    remaining = remaining_after(part, paid)  # the rounded anchor the page shows

    out: list[Payment] = []
    if method == EQUAL_PRINCIPAL:
        per_principal = principal / months
        remaining = principal - per_principal * paid
        for k in range(paid, months):
            interest = remaining * i
            principal_part = per_principal if k < months - 1 else remaining
            payment = principal_part + interest
            remaining -= principal_part
            out.append(
                Payment(
                    period=k + 1,
                    date=add_months(start, k + 1).isoformat(),
                    payment=round(payment, 2),
                    principal=round(principal_part, 2),
                    interest=round(interest, 2),
                    remaining=max(0.0, round(remaining, 2)),
                )
            )
    else:
        payment = annuity_payment(principal, months, i)
        if i == 0:
            remaining = principal - principal / months * paid
        else:
            g = (1 + i) ** months
            remaining = principal * (g - (1 + i) ** paid) / (g - 1)
        for k in range(paid, months):
            interest = remaining * i
            principal_part = payment - interest
            pay = payment
            if k == months - 1:
                principal_part = remaining
                pay = remaining + interest
            remaining -= principal_part
            out.append(
                Payment(
                    period=k + 1,
                    date=add_months(start, k + 1).isoformat(),
                    payment=round(pay, 2),
                    principal=round(principal_part, 2),
                    interest=round(interest, 2),
                    remaining=max(0.0, round(remaining, 2)),
                )
            )
    return out


def merged_schedule(parts: list[dict]) -> list[dict]:
    """A household's payments, month by month: every part's periods merged
    and summed by date — a 公积金 loan and a commercial loan are two
    schedules the family experiences as one payment (or two on two days)."""
    by_date: dict[str, dict] = {}
    for part in parts:
        for p in part_schedule(part):
            row = by_date.setdefault(
                p.date,
                {"date": p.date, "payment": 0.0, "principal": 0.0, "interest": 0.0},
            )
            row["payment"] = round(row["payment"] + p.payment, 2)
            row["principal"] = round(row["principal"] + p.principal, 2)
            row["interest"] = round(row["interest"] + p.interest, 2)
    rows = sorted(by_date.values(), key=lambda r: r["date"])
    remaining = sum(remaining_after(pt) for pt in parts)
    for row in rows:
        remaining = round(remaining - row["principal"], 2)
        row["remaining"] = remaining
    return rows


def interest_by_year(parts: list[dict]) -> list[dict]:
    """Interest grouped by the calendar year it is paid in — what has been
    paid (up to the paid periods) and what is still to come, so the page can
    say both without a second walk."""
    paid_cut = datetime.date.today()
    buckets: dict[int, dict] = {}
    for part in parts:
        start = datetime.date.fromisoformat(part["start_date"])
        principal, months, i = _validate(part)
        remaining = principal
        method = part.get("method") or ANNUITY
        payment = annuity_payment(principal, months, i) if method == ANNUITY else 0.0
        per_principal = round(principal / months, 2)
        for k in range(months):
            interest = round(remaining * i, 2)
            if method == EQUAL_PRINCIPAL:
                principal_part = per_principal if k < months - 1 else remaining
            else:
                principal_part = round(payment - interest, 2)
                if k == months - 1:
                    principal_part = remaining
            remaining = round(remaining - principal_part, 2)
            date = add_months(start, k + 1)
            bucket = buckets.setdefault(date.year, {"year": date.year, "paid": 0.0, "due": 0.0})
            if k < int(part.get("paid_periods") or 0) and date <= paid_cut:
                bucket["paid"] = round(bucket["paid"] + interest, 2)
            else:
                bucket["due"] = round(bucket["due"] + interest, 2)
    return [buckets[y] for y in sorted(buckets)]


def _interest_left(parts: list[dict]) -> float:
    return sum(p.interest for part in parts for p in part_schedule(part))


def effective_annual_rate(
    principal: float,
    count: int,
    per_payment: float | None = None,
    total_fee: float | None = None,
) -> float | None:
    """What an instalment plan really costs per year — the IRR of its cash
    flows, annualised. "名义费率 7.2%" is arithmetic on the fee; this is what
    the money costs, because the principal is paid down every period while
    the fee is charged on the original sum.

    Either say what each period pays (`per_payment`), or say the fee the
    plan charges in total (`total_fee`) and the payment is principal/count
    plus it. Bisection on the monthly rate, as `planning` does; None when no
    rate in the real range makes the flows net to zero."""
    if count <= 0 or principal <= 0:
        return None
    if per_payment is None:
        if total_fee is None:
            return None
        per_payment = (principal + total_fee) / count
    if per_payment * count <= principal:
        return 0.0  # free money: a zero-fee plan costs nothing

    def npv(i: float) -> float:
        return -principal + sum(per_payment / (1 + i) ** k for k in range(1, count + 1))

    lo, hi = -0.99, 1.0  # a monthly rate between −99% and +100%
    if npv(hi) > 0 or npv(lo) < 0:
        return None
    for _ in range(100):
        mid = (lo + hi) / 2
        if npv(mid) > 0:
            lo = mid
        else:
            hi = mid
    monthly = (lo + hi) / 2
    return (1 + monthly) ** 12 - 1


def prepay_comparison(
    parts: list[dict],
    amount: float,
    mode: str,
    expected_return: float = 0.05,
    volatility: float = 0.15,
) -> dict:
    """Paying `amount` today against investing it at `expected_return`.

    `mode` is "shorten" (the payment stays, the loan ends sooner) or
    "reduce" (the term stays, the payment falls). The prepayment is split
    across the parts in proportion to what each still owes — the usual
    treatment of a combined loan — and every figure below is a closed form
    on the remaining plan: interest left = total payments − principal
    repaid, exactly as the schedule would have said it.

    The comparison is honest about its halves: the saved interest is certain
    arithmetic, the investment's number is a projection with a range beside
    it (±`volatility` annualised over the horizon, the width a diversified
    stock portfolio shows — an assumption the reader can argue with, stated
    as one)."""
    if amount <= 0:
        raise ValueError("the amount must be positive")
    left = sum(remaining_after(p) for p in parts)
    if amount > left + 0.01:
        raise ValueError("the amount exceeds what is left")

    old_interest = _interest_left(parts)
    old_payment = monthly_payment(parts)
    new_interest = 0.0
    new_payment = 0.0
    new_terms: list[int] = []
    old_terms: list[int] = []
    for part in parts:
        remaining = remaining_after(part)
        months_left = int(part["term_months"]) - int(part.get("paid_periods") or 0)
        old_terms.append(months_left)
        share = (remaining / left) if left else 0.0
        take = round(amount * share, 2)
        new_remaining = round(remaining - take, 2)
        i = float(part.get("rate") or 0.0) / 12.0
        method = part.get("method") or ANNUITY

        if new_remaining <= 0:
            new_terms.append(0)
            continue

        if method == EQUAL_PRINCIPAL:
            per_principal = round(float(part["principal"]) / int(part["term_months"]), 2)
            if mode == "reduce":
                per_new = new_remaining / months_left
                n = months_left
                payment_now = round(per_new + new_remaining * i, 2)
            else:
                per_new = per_principal
                n = max(1, math.ceil(new_remaining / per_new))
                payment_now = round(per_new + new_remaining * i, 2)
            # i·(n·B − per·n(n−1)/2): interest on a balance walking down in
            # equal steps.
            new_interest += i * (n * new_remaining - per_new * n * (n - 1) / 2)
            new_payment += payment_now
            new_terms.append(n)
        else:
            current_payment = annuity_payment(
                float(part["principal"]), int(part["term_months"]), i
            )
            if mode == "reduce":
                n = months_left
                payment_now = annuity_payment(new_remaining, n, i)
            else:
                payment_now = current_payment
                if i == 0:
                    n = max(1, math.ceil(new_remaining / payment_now)) if payment_now else months_left
                elif payment_now > new_remaining * i:
                    n = max(
                        1,
                        math.ceil(-math.log(1 - new_remaining * i / payment_now) / math.log(1 + i)),
                    )
                else:
                    n = months_left
            new_interest += n * payment_now - new_remaining
            new_payment += payment_now
            new_terms.append(n)

    saved = round(old_interest - round(new_interest, 2), 2)
    months_left_total = max(old_terms) if old_terms else 0
    new_total = max(new_terms) if new_terms else 0

    horizon = months_left_total / 12.0
    invested = amount * (1 + expected_return) ** horizon
    spread = invested * volatility * math.sqrt(horizon)
    return {
        "mode": mode,
        "amount": round(amount, 2),
        "saved_interest": saved,
        "months_saved": (months_left_total - new_total) if mode == "shorten" else 0,
        "old_payment": old_payment,
        "new_payment": round(new_payment, 2),
        "expected_return": expected_return,
        "invested_value": round(invested, 2),
        "invested_range": [round(invested - spread, 2), round(invested + spread, 2)],
        "volatility": volatility,
    }


def monthly_payment(parts: list[dict]) -> float:
    """What one month of the plan costs now: the sum of each part's next
    payment."""
    total = 0.0
    for part in parts:
        schedule = part_schedule(part)
        if schedule:
            total += schedule[0].payment
    return round(total, 2)
