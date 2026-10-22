"""A loan knows its schedule, and what paying early actually saves.

PRD v3 §4.4 (负债 2.0). The numbers here are the ones a bank's own schedule
produces: the payment of a 30-year combined loan, the split of its first
payment into interest and principal (the month's interest is a hand
formula), the balance walking to zero, and — the number the family actually
argues about — what 200,000 today saves against what it would earn
invested. The instalment's true annual rate is the IRR of its own flows:
"名义费率 7.2%" is arithmetic on a fee; the money costs what the IRR says.
"""

from __future__ import annotations

import pytest

from app.amortization import (
    ANNUITY,
    EQUAL_PRINCIPAL,
    annuity_payment,
    effective_annual_rate,
    interest_by_year,
    merged_schedule,
    part_schedule,
    prepay_comparison,
    remaining_after,
)

GJJ = {
    "name": "公积金",
    "principal": 1000000,
    "rate": 0.031,
    "method": ANNUITY,
    "term_months": 360,
    "start_date": "2021-07-20",
    "paid_periods": 0,
}
SYD = {
    "name": "商贷",
    "principal": 2100000,
    "rate": 0.04,
    "method": ANNUITY,
    "term_months": 360,
    "start_date": "2021-07-20",
    "paid_periods": 0,
}


def test_the_combined_loan_pays_what_the_banks_schedule_pays():
    """310 万 30 年组合贷（公积金 3.1% / 商贷 4.0%）: each part's payment is
    the annuity formula's, the first period's interest is the balance times
    the monthly rate (a hand formula, not this code's), and the schedule
    walks to zero with its parts adding up exactly."""
    assert annuity_payment(1000000, 360, 0.031 / 12) == pytest.approx(4270.16, abs=0.01)
    assert annuity_payment(2100000, 360, 0.04 / 12) == pytest.approx(10025.72, abs=0.01)

    schedule = part_schedule(GJJ)
    assert len(schedule) == 360
    first = schedule[0]
    assert first.interest == pytest.approx(1000000 * 0.031 / 12, abs=0.01)
    assert first.principal + first.interest == first.payment
    assert first.remaining == pytest.approx(998313.17, abs=0.01)
    assert schedule[-1].remaining == 0.0
    assert sum(p.principal for p in schedule) == pytest.approx(1000000, abs=1)
    # 等额本息: the payment never changes — except the last one, which
    # absorbs the drift of 360 cents-roundings so the balance lands on zero.
    # A bank's schedule closes the same way, within yuan of the monthly sum.
    assert all(p.payment == schedule[0].payment for p in schedule[:-1])
    assert schedule[-1].payment == pytest.approx(schedule[0].payment, abs=3)

    merged = merged_schedule([GJJ, SYD])
    assert merged[0]["payment"] == pytest.approx(14295.88, abs=0.01)
    assert merged[-1]["remaining"] == 0.0


def test_equal_principal_walks_down_in_equal_steps():
    """等额本息 pays the same amount forever; 等额本金 repays the same
    principal every month and the payment shrinks with the interest. A
    12-month, 24%-a-year loan of 12,000: the interest is 2% of each month's
    opening balance — 12,000 then 11,000 then … then 1,000. Summed by hand:
    0.02·(12·12000 − 1000·66) = 1,560."""
    part = {
        "principal": 12000,
        "rate": 0.24,
        "method": EQUAL_PRINCIPAL,
        "term_months": 12,
        "start_date": "2026-01-15",
        "paid_periods": 0,
    }
    schedule = part_schedule(part)
    assert len(schedule) == 12
    assert all(p.principal == 1000 for p in schedule)
    assert sum(p.interest for p in schedule) == pytest.approx(1560, abs=0.01)
    assert schedule[0].payment == pytest.approx(1240, abs=0.01)
    assert schedule[-1].payment < schedule[0].payment
    assert schedule[-1].remaining == 0.0


def test_the_paid_periods_are_the_anchors_reach():
    """`paid_periods` is where the reader's own balance meets the plan: the
    schedule resumes at the next period and the closed form of what is left
    is the anchor's own figure (the difference the page names)."""
    part = {**GJJ, "paid_periods": 63}
    schedule = part_schedule(part)
    assert len(schedule) == 297
    assert schedule[0].period == 64
    assert remaining_after(part) == pytest.approx(schedule[0].remaining + schedule[0].principal, abs=0.02)
    assert remaining_after(part, 360) == 0.0


def test_paying_200000_early_saves_the_interest_the_math_says():
    """The family's actual argument: 20 万 into the loan (shorten the term)
    or into the market. The saved interest is the difference of two closed
    forms — and shortening saves more than reducing, because the payments
    keep coming at the smaller balance for fewer months rather than at a
    smaller amount for the same months."""
    shorten = prepay_comparison([GJJ, SYD], 200000, "shorten")
    assert shorten["saved_interest"] == pytest.approx(364783.50, abs=364783.50 * 0.005)
    assert shorten["months_saved"] == 36
    assert shorten["old_payment"] == pytest.approx(14295.88, abs=0.01)
    assert shorten["new_payment"] == shorten["old_payment"]

    reduce = prepay_comparison([GJJ, SYD], 200000, "reduce")
    assert reduce["new_payment"] == pytest.approx(13373.57, abs=0.01)
    assert reduce["months_saved"] == 0
    assert reduce["saved_interest"] < shorten["saved_interest"]

    # The other half of the card: the same money at 5% for the same horizon,
    # with the range it moves in stated beside it (an assumption, not a fact).
    assert shorten["invested_value"] == pytest.approx(200000 * 1.05**30, abs=1)
    assert shorten["invested_range"][0] < shorten["invested_value"] < shorten["invested_range"][1]

    with pytest.raises(ValueError):
        prepay_comparison([GJJ, SYD], 9_000_000, "shorten")


def test_an_instalments_true_rate_is_its_irr():
    """花呗 12 期、名义费率 7.2%: 12,000 repaid as 12 × 1,072. The fee is
    arithmetic on the original sum; the principal is paid down every month,
    so the money costs what the IRR says — about 13.8% a year, not 7.2%.
    The same answer arrives through the fee or through the payment, because
    they are the same flows."""
    apr = effective_annual_rate(12000, 12, per_payment=1072)
    assert apr == pytest.approx(0.138, abs=0.005)
    assert effective_annual_rate(12000, 12, total_fee=864) == pytest.approx(apr, abs=0.001)
    # A zero-fee plan costs nothing: the flows net to zero at zero.
    assert effective_annual_rate(1200, 12, per_payment=100) == 0.0


def test_interest_grouped_by_year_says_paid_and_due():
    part = {**GJJ, "paid_periods": 6}
    years = interest_by_year([part])
    by_year = {y["year"]: y for y in years}
    assert len(years) == 31  # 2021-08 through 2051-07
    # Six payments were made: five of them in 2021 and the sixth in January
    # 2022 — so 2021 is wholly paid and 2022 holds both sides.
    assert by_year[2021]["paid"] > 0
    assert by_year[2021]["due"] == 0
    assert by_year[2022]["paid"] > 0 and by_year[2022]["due"] > 0
    assert sum(y["paid"] + y["due"] for y in years) == pytest.approx(
        sum(p.interest for p in part_schedule({**part, "paid_periods": 0})), abs=1
    )
