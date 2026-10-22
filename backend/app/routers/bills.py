"""Bills, the calendar and the forecast (PRD v3 §4.3, 账单日历与现金流预测).

Thin router over `forecasting`, which does the walking. The three reads are
three questions about the same events: what falls due this month
(`/calendar`), what the balances do before then (`/forecast`), and what is
due in the days ahead (`/bills/upcoming`). The writes are the bill rows
themselves (`/bills`): a credit card's due date, the school's own months,
the salary of the last workday.

Caveats travel with the numbers, never behind them: a movement whose sum is
not known says so (`stated`), and the calendar carries the workday table's
own reach (`calendar_covers`) so a guessed day can be told from a known one."""

from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import budgeting, crud, forecasting, schemas
from app.database import get_db

router = APIRouter(prefix="/api", tags=["bills"])


@router.get("/bills", response_model=list[schemas.BillScheduleRead])
def list_bills(db: Session = Depends(get_db)) -> list:
    return crud.get_bill_schedules(db)


@router.post("/bills", response_model=schemas.BillScheduleRead, status_code=status.HTTP_201_CREATED)
def create_bill(payload: schemas.BillScheduleCreate, db: Session = Depends(get_db)) -> object:
    return crud.create_bill_schedule(db, payload)


@router.patch("/bills/{bill_id}", response_model=schemas.BillScheduleRead)
def update_bill(
    bill_id: int, payload: schemas.BillScheduleUpdate, db: Session = Depends(get_db)
) -> object:
    row = crud.update_bill_schedule(db, bill_id, payload)
    if row is None:
        raise HTTPException(status_code=404, detail="No such bill")
    return row


@router.delete("/bills/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(bill_id: int, db: Session = Depends(get_db)) -> None:
    if not crud.delete_bill_schedule(db, bill_id):
        raise HTTPException(status_code=404, detail="No such bill")


@router.get("/calendar", response_model=schemas.CalendarPage)
def calendar(month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"), db: Session = Depends(get_db)) -> dict:
    """The month's expected movements, by day: flows, bills, entries already
    recorded, transfers dated ahead and the plan's buys — one payment once."""
    month = month or datetime.date.today().strftime("%Y-%m")
    lo, hi = budgeting.month_window(month)
    data = forecasting.cash_calendar(db, lo, hi)
    return {"month": month, **data}


@router.get("/forecast", response_model=schemas.CashForecast)
def forecast(days: int = Query(default=30, ge=7, le=180), db: Session = Depends(get_db)) -> dict:
    """Every account's balance for the days ahead, and where one runs thin:
    the gap's date, its deficit, the movements that got it there, and which
    accounts could cover it. A suggestion to move money — never a move made."""
    return forecasting.forecast_cash(db, horizon_days=days)


@router.get("/bills/upcoming", response_model=list[schemas.UpcomingBill])
def upcoming(within: int = Query(default=7, ge=1, le=60), db: Session = Depends(get_db)) -> list[dict]:
    """What is due in the days ahead, soonest first, each with whether the
    account holds enough for it today."""
    return forecasting.upcoming_bills(db, within_days=within)
