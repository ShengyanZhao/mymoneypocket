"""Budgets and the monthly review (PRD v3 §4.2, 预算与复盘).

Thin router over `budgeting`, which does the arithmetic. Two shapes of one
sentence: a BUDGET says what a month may reach, a REVIEW says what a month
did and what to look at first. Neither blocks a row — spending is a fact —
and the review is computed from the ledger every time it is read, so its
attributions name the rows they came from.

Suggestion words are NOT here: the page composes them in its own language
from the structured facts (`ReviewSuggestion`), the way every other sentence
in this app is built."""

from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import budgeting, crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api", tags=["budgets"])

MONTH_QUERY = Query(default=None, pattern=r"^\d{4}-\d{2}$", description="YYYY-MM; default the current month")


@router.get("/budgets", response_model=list[schemas.BudgetRead])
def list_budgets(db: Session = Depends(get_db)) -> list:
    """Every budget line, oldest first."""
    return crud.get_budgets(db)


@router.post("/budgets", response_model=schemas.BudgetRead, status_code=status.HTTP_201_CREATED)
def create_budget(payload: schemas.BudgetCreate, db: Session = Depends(get_db)) -> object:
    """A budget line. One per (month, category): to change a line from a
    month onward is to add a new line starting there, which supersedes the
    old one exactly where it should."""
    if crud.get_budget_at(db, payload.year_month, payload.category) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That month and category already has a budget line",
        )
    return crud.create_budget(db, payload)


@router.patch("/budgets/{budget_id}", response_model=schemas.BudgetRead)
def update_budget(
    budget_id: int, payload: schemas.BudgetUpdate, db: Session = Depends(get_db)
) -> object:
    """Change how much a line allows, or its habits. Its month and category
    are its identity — those changes are a new line."""
    row = crud.update_budget(db, budget_id, payload)
    if row is None:
        raise HTTPException(status_code=404, detail="No such budget line")
    return row


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: int, db: Session = Depends(get_db)) -> None:
    if not crud.delete_budget(db, budget_id):
        raise HTTPException(status_code=404, detail="No such budget line")


@router.get("/budgets/overview", response_model=schemas.BudgetOverview)
def overview(month: str | None = MONTH_QUERY, db: Session = Depends(get_db)) -> dict:
    """Every line of `month` against what has been spent of it: progress,
    what is left, and the daily allowance the days left allow."""
    return budgeting.budget_overview(db, month)


@router.get("/months/actuals", response_model=schemas.MonthActuals)
def actuals(month: str | None = MONTH_QUERY, db: Session = Depends(get_db)) -> dict:
    """What actually moved in a month, per category, each payment once."""
    return budgeting.month_actuals(db, month or _this_month())


@router.get("/reviews", response_model=schemas.MonthReviewRead)
def review(month: str | None = MONTH_QUERY, db: Session = Depends(get_db)) -> dict:
    """The month, computed from its rows: the totals and their change, where
    the budget went, what moved most (with the rows that moved it), and at
    most three suggestions."""
    return budgeting.month_review(db, month or _this_month())


@router.post("/reviews/resolutions", response_model=dict[str, str])
def resolve(payload: schemas.ReviewResolution, db: Session = Depends(get_db)) -> dict:
    """Record what the reader did with one suggestion.

    ACCEPTED WITH AN AMOUNT writes that amount into the category's budget
    from the month after the review — "调至 1,200" is a change to next
    month's line, and the current month keeps what it was. Ignoring only
    stops the suggestion coming back."""
    if payload.action not in ("accepted", "ignored"):
        raise HTTPException(status_code=422, detail="action is accepted or ignored")
    kind, _, rest = payload.key.partition(":")
    if payload.action == "accepted" and payload.amount is not None and kind in ("raise", "lower"):
        category = rest or None
        target = budgeting.next_month(payload.year_month)
        crud.upsert_budget(db, target, category, payload.amount)
    return budgeting.resolve_suggestion(db, payload.year_month, payload.key, payload.action)


def _this_month() -> str:
    return datetime.date.today().strftime("%Y-%m")
