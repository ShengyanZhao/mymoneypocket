"""A declared tax estimate — deliberately not a tax engine.

WHAT THIS IS NOT, AND WHY THAT IS THE DESIGN. A real engine for Italy alone
would need: 26% on capital gains but 12.5% on white-list government bonds,
harmonised versus non-harmonised funds, losses that cannot offset gains from
harmonised ETFs, a four-year basket, stamp duty, IVAFE, administered versus
declarative regime. Multiply that by every country this app is meant to serve.
The failure mode of building it is being PRECISE AND WRONG, which in tax
matters is worse than being openly approximate: a reader shown "roughly 26%,
stated as an estimate" checks it against their broker, and a reader shown a
confident figure does not.

So there is exactly ONE rule here, applied flat, and it is the reader's own:
a percentage they can see and overwrite. If a future edit ever adds a second
rule for a special kind of instrument — a bond rate, a fund wrapper, a holding
period — that is the line being crossed, and the honest move is to delete this
module rather than grow it.

AMENDED 2026-10-16 (CN, PRD §5.1). The paragraph above names a holding-period
rule as the future edit that crosses its line, and China's dividend tax walked
over that line deliberately: 股息红利差别化 (财税[2015]101号) is not a carve-out
beside a headline rate — 20% / 10% / 免征 BY HOLDING PERIOD is the headline,
keyed on one fact the ledger already holds, the age of the shares that earned
the dividend. What keeps this module the thing it was, three ways: the
schedule is still a DECLARATION the reader can see and overwrite (a flat rate
typed beside it wins), it is still applied only to figures the ledger already
holds, and its figure still never enters a total. And the table's own contract
is kept rather than waved through — every carve-out the schedule does NOT
model (基金分红免征, 港股通 H 股 20%, 境外股票 20%, 印花税, the works) is named
in `omits`, which remains the reason these tables are allowed to be this
short. Precise-and-wrong is still the failure this file exists to avoid; the
schedule is the one place the law itself is a schedule.

WHERE IT APPLIES. Two places, both of which already hold the number:
the realized capital gain the ledger computed, and the dividends the ledger
collected. Nowhere else.

THE GOLDEN RULE. The figure this module produces never enters a total. Not
the net worth, not the book value, not a position's value. It travels BESIDE
them, carrying the rate it used and the word estimated, which is what keeps it
an aid to deciding instead of something impersonating a tax return.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

# The three keys, in `settings` — already a key->value table, so this needs no
# schema of its own (the same reason the catalogue's two entries live there).
COUNTRY = "tax_country"
CAPITAL_GAINS = "capital_gains_rate"
DIVIDEND_WITHHOLDING = "dividend_withholding_rate"
# The one schedule (the amendment at the top): a JSON list of [days_max, rate]
# pairs, the last days_max null. Stored apart from the flat rate because one
# box cannot hold three numbers, and typed OVER by the flat rate whenever the
# reader declares one.
DIVIDEND_TIERS = "dividend_tiers"

# Rates are stored and handled as PERCENT, never as a fraction. The app already
# has one rate on a model — `Liability.interest_rate`, printed as "%/yr" — and
# a codebase where 26 means 26% in one table and 0.26 means 26% in another has
# a factor-of-100 bug waiting in whichever direction a reader guesses wrong.


@dataclass(frozen=True, slots=True)
class Default:
    """A country's headline rate, and what it leaves out.

    `omits` is not a disclaimer bolted on afterwards — it is the reason this
    table is allowed to be this short. Each entry names the carve-outs it is
    knowingly flattening, so a reader can see whether the flat number is close
    enough for them before they trust it, and correct it when it is not.

    `dividend_tiers` is the one schedule this table may carry (the amendment
    above): (days-held cap INCLUSIVE, rate PERCENT) ascending, the last cap
    None meaning "beyond every cap". A country whose dividend rate is not one
    number leaves `dividend_withholding` None and carries its schedule here,
    which is what makes the pre-fill honest — one box cannot hold three
    rates."""

    capital_gains: float
    dividend_withholding: float | None
    regime: str
    omits: str
    dividend_tiers: tuple[tuple[int | None, float], ...] | None = None


# WHICH DEFAULTS SHIP, AND WHY SO FEW. Every country here is a claim this
# project maintains, and a stale rate is worse than an absent one: France's
# moved 1.4 points on 1 January 2026 when the CSG rose, which is exactly how a
# table like this goes quietly wrong. So it holds only countries whose headline
# rate is genuinely ONE flat number for both gains and dividends. Spain's
# savings scale (19-28%), the UK's allowances and bands, the Netherlands' box 3
# (a deemed-return wealth tax, not a gains tax at all) are all shapes this
# module cannot represent, and inventing a single number for them would be the
# precise-and-wrong failure this whole file exists to avoid.
#
# A country that is NOT here loses nothing but the pre-fill. The rates are what
# every reader downstream reads; the country is a label on the estimate. Typing
# your own two figures gives you the identical feature, and a rate you looked
# up yourself is better than any table shipped here — which is why even a
# listed country's defaults are only a starting point.
#
# Each rate is the statutory headline rate as of 2026.
DEFAULTS: dict[str, Default] = {
    "Italy": Default(
        26.0,
        26.0,
        "imposta sostitutiva, 26% on both",
        "White-list government bonds are taxed at 12.5%, and crypto at 33% from "
        "2026. Neither carve-out is applied: this is one flat rate.",
    ),
    "Germany": Default(
        26.375,
        26.375,
        "Abgeltungsteuer 25% + 5.5% Solidaritätszuschlag",
        "Church tax (a further 8-9% of the tax) is not included, and the first "
        "€1,000 of investment income (Sparer-Pauschbetrag) is exempt, so a small "
        "portfolio is over-estimated here.",
    ),
    "France": Default(
        31.4,
        31.4,
        "PFU 12.8% income tax + 18.6% prélèvements sociaux",
        "The PFU rose from 30% to 31.4% on 1 January 2026 with the CSG. Electing "
        "the progressive scale instead can cost less, and life insurance keeps "
        "the older 17.2% social rate.",
    ),
    "China": Default(
        0.0,
        None,
        "股息红利差别化 20%/10%/免征 by holding period (财税[2015]101号); "
        "A 股与公募基金转让价差暂免征收个人所得税",
        "The schedule beside this entry covers A-share cash dividends only, "
        "and by the age of the shares that earned them (先进先出, estimated). "
        "Left out, each of which is its own number: 基金分红免征个人所得税; "
        "境外股票股息与转让价差 20%; 港股通 H 股股息 20%; 印花税 0.05% on a "
        "sale only (already inside the broker's fees the ledger records); "
        "过户费/经手费; and 工资薪金个税 (a different table entirely). "
        "capital gains 0 here is the 暂免 for mainland listings — a gain on "
        "something OUTSIDE the mainland is 20% and is not this line.",
        dividend_tiers=((30, 20.0), (365, 10.0), (None, 0.0)),
    ),
}


def default_for(country: str | None) -> Default | None:
    """The shipped default for a country name, matched loosely on case and
    spacing. None for every country not in the table, which is not an error
    state — see the note above `DEFAULTS`."""
    if not country:
        return None
    wanted = country.strip().casefold()
    for name, d in DEFAULTS.items():
        if name.casefold() == wanted:
            return d
    return None


@dataclass(frozen=True, slots=True)
class Rates:
    """What the reader declared. Any of them may be unset, and unset is a
    real answer — distinct from zero, which would be a reader claiming they pay
    no tax.

    `dividend_tiers` is the declared schedule (the amendment at the top):
    (days-held cap INCLUSIVE, rate PERCENT) ascending, the last cap None. It
    is not an alternative the module reaches for on its own — the reader
    declares it, or types a flat rate beside it and the flat rate wins."""

    country: str | None
    capital_gains: float | None
    dividend_withholding: float | None
    dividend_tiers: tuple[tuple[int | None, float], ...] | None = None

    @property
    def any_set(self) -> bool:
        return (
            self.capital_gains is not None
            or self.dividend_withholding is not None
            or self.dividend_tiers is not None
        )


def _get(db: Session, key: str) -> str | None:
    row = db.execute(text("SELECT value FROM settings WHERE key = :k"), {"k": key}).first()
    return row[0] if row and row[0] not in (None, "") else None


def _set(db: Session, key: str, value: str | None) -> None:
    """Store a value, or remove the key entirely when there is none.

    Clearing DELETES rather than writing an empty string, so "the reader never
    set this" has one representation instead of three that read the same on
    screen and differently in a query."""
    if value is None or value == "":
        db.execute(text("DELETE FROM settings WHERE key = :k"), {"k": key})
        return
    db.execute(
        text(
            "INSERT INTO settings (key, value) VALUES (:k, :v)"
            " ON CONFLICT(key) DO UPDATE SET value = :v"
        ),
        {"k": key, "v": value},
    )


def _rate(raw: str | None) -> float | None:
    """A stored rate as a number, or None if it is absent or unreadable.

    Unreadable is treated as absent on purpose: `settings.value` is free text
    that nothing but this app writes, but a row hand-edited into "26%" must not
    take down the portfolio page for a figure that sits beside the totals."""
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _tiers(raw: str | None) -> tuple[tuple[int | None, float], ...] | None:
    """A stored schedule as pairs, or None when there is none or it will not
    read. Unreadable is absent, for `_rate`'s reason: a hand-edited row must
    not take down the portfolio page for a figure that sits beside totals."""
    if raw is None:
        return None
    try:
        rows = json.loads(raw)
        pairs = tuple(
            (None if cap is None else int(cap), float(rate)) for cap, rate in rows
        )
    except (ValueError, TypeError):
        return None
    return pairs or None


def _tiers_json(tiers: tuple[tuple[int | None, float], ...] | None) -> str | None:
    if not tiers:
        return None
    return json.dumps([[cap, rate] for cap, rate in tiers])


def read_rates(db: Session) -> Rates:
    """The declared rates and schedule, as they stand."""
    return Rates(
        country=_get(db, COUNTRY),
        capital_gains=_rate(_get(db, CAPITAL_GAINS)),
        dividend_withholding=_rate(_get(db, DIVIDEND_WITHHOLDING)),
        dividend_tiers=_tiers(_get(db, DIVIDEND_TIERS)),
    )


def write_rates(
    db: Session,
    *,
    country: str | None,
    capital_gains: float | None,
    dividend_withholding: float | None,
    dividend_tiers: tuple[tuple[int | None, float], ...] | None = None,
) -> Rates:
    """Replace them all. Each is independently clearable — a reader who knows
    their dividend rate and not their gains rate is in a legitimate state, and
    the estimate says which half it could not compute. A flat dividend rate
    and a schedule can be set at once; the flat one wins (`estimate`), because
    it is the more specific declaration."""
    _set(db, COUNTRY, (country or "").strip() or None)
    _set(db, CAPITAL_GAINS, None if capital_gains is None else str(capital_gains))
    _set(
        db,
        DIVIDEND_WITHHOLDING,
        None if dividend_withholding is None else str(dividend_withholding),
    )
    _set(db, DIVIDEND_TIERS, _tiers_json(dividend_tiers))
    db.commit()
    return read_rates(db)


# What every reader of this figure is told, always, because none of it stops
# being true once a rate is set. These live here rather than in the screen and
# the advisor prompt separately: the same caveats reach the page, the chat and
# any outside assistant, and there is one place to correct them.
BASIS_CAVEATS = (
    "This is a flat percentage you declared applied to two figures the ledger "
    "already holds. It is not a tax calculation and no return should be filed "
    "from it.",
    "The realized gain is computed at AVERAGE cost. Tax authorities generally "
    "are not: Italy matches disposals LIFO, Germany FIFO, so the gain a real "
    "return reports will differ from this one even at the same rate.",
    "It covers the whole recorded ledger, not a tax year, and nothing here "
    "carries losses forward or offsets them against gains across years.",
)


def _tier_rate(
    tiers: tuple[tuple[int | None, float], ...], days: int
) -> float:
    """The schedule's rate for a holding period of `days`: the first cap the
    age fits under, caps inclusive — 30 days is the "one month or less" tier of
    财税[2015]101号 and 365 the "one year or less", and only a day past either
    moves down. The uncapped tail is the last pair."""
    for cap, rate in tiers:
        if cap is None or days <= cap:
            return rate
    return tiers[-1][1]


def estimate(
    rates: Rates,
    *,
    realized: float,
    dividends_estimated: float,
    dividends_recorded: float,
    dividends_held_for: list[tuple[float, int]] | None = None,
) -> dict:
    """The estimate, from the bases the portfolio already computed.

    Pure: it takes numbers, not a session, so what it claims can be checked
    without a database.

    `dividends_estimated` is the gross subset — the rows still carrying the
    market's figure. `dividends_recorded` is the rest, which the reader
    replaced with the credit their broker actually paid. THE WITHHOLDING IS
    APPLIED ONLY TO THE FIRST. Applying it to the sum would tax a second time
    exactly the rows somebody took the trouble to correct, which is the
    diligent reader being punished for their diligence — a bug this project has
    already paid for once under that name.

    `dividends_held_for` is the estimated dividends as (gross amount, days the
    shares that earned it had been held) — the ledger's own rows, aged by the
    walk that collected them (`positions.replay`). Given, and with a schedule
    declared, each amount takes its TIER's rate (`_tier_rate`) and
    `dividends_by_rate` says what fell where. A declared FLAT rate is the more
    specific declaration and wins over any schedule. Given neither, the
    dividend half is one of the `missing_rates` — a schedule without ages is a
    rate that cannot be picked.
    """
    taxable_gain = max(realized, 0.0)
    realized_loss = max(-realized, 0.0)

    cg_tax = (
        taxable_gain * rates.capital_gains / 100.0
        if rates.capital_gains is not None
        else None
    )
    dividends_by_rate: list[dict] = []
    if rates.dividend_withholding is not None:
        div_tax = dividends_estimated * rates.dividend_withholding / 100.0
    elif rates.dividend_tiers is not None and dividends_held_for:
        by_rate: dict[float, float] = {}
        for amount, days in dividends_held_for:
            rate = _tier_rate(rates.dividend_tiers, days)
            by_rate[rate] = by_rate.get(rate, 0.0) + amount
        div_tax = sum(a * r / 100.0 for r, a in by_rate.items())
        dividends_by_rate = [{"rate": r, "amount": a} for r, a in sorted(by_rate.items())]
    else:
        div_tax = None

    # A total only when every base that has something in it has a rate to
    # apply. Summing the halves that happen to be computable would produce a
    # figure the reader reads as "my tax" while it silently omits the other
    # half — the same claim-shaped absence the app refuses everywhere else.
    missing: list[str] = []
    if taxable_gain > 0 and rates.capital_gains is None:
        missing.append("capital gains")
    if dividends_estimated > 0 and div_tax is None:
        missing.append("dividend withholding")
    total = (
        (cg_tax or 0.0) + (div_tax or 0.0)
        if not missing and (cg_tax is not None or div_tax is not None)
        else None
    )

    # NO AMOUNTS IN THIS PROSE. Every figure here is already a field on the
    # result, and only the caller knows how to punctuate one: the frontend has
    # exactly one currency formatter and it follows the reader's locale, so a
    # "177.60" baked in here would land beside a "EUR 178" it was supposed to
    # match. The rule the app already runs on — the currency is designed, the
    # locale is whatever the reader has — applies to a sentence as much as to
    # a column.
    caveats = list(BASIS_CAVEATS)
    if realized_loss > 0:
        caveats.append(
            "The ledger's realized result is a LOSS, so no gain is estimated on "
            "it. Most regimes let a loss offset later gains; this does not track "
            "that."
        )
    if dividends_recorded > 0:
        caveats.append(
            "Some of the dividends collected are figures you corrected by hand, "
            "so they are already net of whatever your broker withheld. No rate is "
            "applied to them."
        )
    if dividends_by_rate:
        caveats.append(
            "The dividend schedule was applied to the age of the shares that "
            "earned each dividend, aged against your recorded purchases "
            "(first bought, first aged). A share whose purchase the ledger does "
            "not know is aged from the situation that first recorded it, which "
            "is the earliest date this app has for it."
        )
    known = default_for(rates.country)
    if known is not None:
        caveats.append(f"{rates.country}: {known.omits}")

    return {
        "country": rates.country,
        "capital_gains_rate": rates.capital_gains,
        "dividend_withholding_rate": rates.dividend_withholding,
        "configured": rates.any_set,
        "realized_gain": realized,
        "taxable_gain": taxable_gain,
        "capital_gains_tax": cg_tax,
        "dividends_gross_estimated": dividends_estimated,
        "dividends_recorded_net": dividends_recorded,
        "dividend_withholding": div_tax,
        # What fell in which tier of a declared schedule — the schedule's own
        # reading of the base, beside the flat figure above. Empty whenever no
        # schedule was applied.
        "dividends_by_rate": dividends_by_rate,
        "total": total,
        "missing_rates": missing,
        "regime": known.regime if known is not None else None,
        "caveats": caveats,
    }
