"""The category vocabularies, in one place the API hands out.

Categories used to be two lists in the frontend (`INCOME_CATEGORIES`,
`EXPENSE_CATEGORIES` in `CashFlow.tsx`) — and a list typed into a form is not
a vocabulary: the importer's rules could not see it, the chat could not write
to it, and the two ends drifted the day anyone added a category on one side
only (the same defect `CashFlowItemMixin` was written to end). So the words
live here, and `GET /api/taxonomy` is how every caller gets them.

The vocabularies are the China iteration's (PRD §3): 餐饮/交通/红包/还贷 … in
the place of food/transport/leisure. A row stored under an OLD code stays
readable through `ALIASES`, which names the new code for each old one; nothing
rewrites rows, because a migration that renames what the reader once chose
silently is the wrong kind of tidy. The frontend maps for display, and a row
edited into the new list keeps the code it is saved with.

`entry` is what a statement row may be filed under: every expense word plus
the two that only ever describe a movement between the reader's own pockets —
a transfer is neither income nor spending, and filing it as either is how
monthly figures go wrong."""

from __future__ import annotations

# Income (a flow in): wages and the four other things that replace work.
INCOME: tuple[str, ...] = (
    "wage",
    "bonus",
    "red_packet",
    "reimbursement",
    "investment_income",
    "rental",
    "side_hustle",
    "pension",
    "other",
)

# Expense (a flow out): the spending a Chinese household actually has.
EXPENSE: tuple[str, ...] = (
    "dining",
    "transport",
    "shopping",
    "housing",
    "utilities",
    "telecom",
    "medical",
    "education",
    "entertainment",
    "travel",
    "insurance",
    "debt_payment",
    "gift",
    "social_security",
    "tax",
    "other",
)

# A statement entry may also be a movement that is neither.
ENTRY: tuple[str, ...] = EXPENSE + ("transfer", "investment")

# What the old codes are called now. Old rows are shown through these; the
# dropdowns offer only the new words, so the vocabulary converges as rows are
# touched instead of by a migration that rewrites the reader's history.
ALIASES: dict[str, str] = {
    # income
    "salary": "wage",
    "freelance": "side_hustle",
    "business": "side_hustle",
    "dividends": "investment_income",
    "interest": "investment_income",
    # expense
    "food": "dining",
    "health": "medical",
    "debt": "debt_payment",
    "leisure": "entertainment",
}


def display_code(code: str | None) -> str | None:
    """What a stored code reads as in the current vocabulary: the code itself
    when it is one of today's, its new name when it is an old one, and as
    stored when it is neither — a row typed before this module existed, or a
    word the reader invented, stays visible rather than falling to nothing."""
    if not code:
        return code
    return ALIASES.get(code, code)
