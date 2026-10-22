"""REST endpoints for liabilities (debts) and their dated balances.

A liability (mortgage, loan, ...) tracks its outstanding principal as dated
balances, mirroring real-asset valuations. Net worth subtracts the latest
balance of each debt. A liability may optionally link to the real asset it
finances (404 if that asset does not exist).
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import amortization, crud, fx, models, schemas
from app.database import get_db
from app.routers.deps import get_or_404

router = APIRouter(prefix="/api", tags=["liabilities"])


def _require_linked_asset(db: Session, real_asset_id: int | None) -> None:
    """404 if the liability names a real asset that does not exist. Null is
    allowed: a debt secured on nothing is a debt, not a dangling reference."""
    if real_asset_id is not None:
        get_or_404(db, models.RealAsset, real_asset_id)


@router.post(
    "/liabilities",
    response_model=schemas.LiabilityRead,
    status_code=status.HTTP_201_CREATED,
)
def create_liability(
    payload: schemas.LiabilityCreate,
    db: Session = Depends(get_db),
) -> schemas.LiabilityRead:
    """Create a new liability (404 if the linked real asset does not exist)."""
    _require_linked_asset(db, payload.real_asset_id)
    return crud.create_liability(db, payload)


@router.get("/liabilities", response_model=list[schemas.LiabilityRead])
def list_liabilities(db: Session = Depends(get_db)) -> list[schemas.LiabilityRead]:
    """List all liabilities."""
    return crud.get_liabilities(db)


@router.get("/liabilities/{liability_id}", response_model=schemas.LiabilityRead)
def get_liability(
    liability_id: int,
    db: Session = Depends(get_db),
) -> schemas.LiabilityRead:
    """Return a single liability, or 404 if it does not exist."""
    return get_or_404(db, models.Liability, liability_id)


@router.put("/liabilities/{liability_id}", response_model=schemas.LiabilityRead)
def update_liability(
    liability_id: int,
    payload: schemas.LiabilityCreate,
    db: Session = Depends(get_db),
) -> schemas.LiabilityRead:
    """Update a liability (404 if it, or the linked real asset, does not exist)."""
    _require_linked_asset(db, payload.real_asset_id)
    get_or_404(db, models.Liability, liability_id)
    return crud.update_liability(db, liability_id, payload)


@router.delete("/liabilities/{liability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_liability(liability_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a liability (cascades to its balances)."""
    get_or_404(db, models.Liability, liability_id)
    crud.delete_liability(db, liability_id)


@router.post(
    "/liabilities/{liability_id}/balances",
    response_model=schemas.LiabilityBalanceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_balance(
    liability_id: int,
    payload: schemas.LiabilityBalanceCreate,
    db: Session = Depends(get_db),
) -> schemas.LiabilityBalanceRead:
    """Add a dated balance to a liability (409 if one already exists for that date)."""
    get_or_404(db, models.Liability, liability_id)
    try:
        return crud.create_liability_balance(db, liability_id, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A balance for liability {liability_id} on "
                f"{payload.date.isoformat()} already exists"
            ),
        )


@router.get(
    "/liabilities/{liability_id}/balances",
    response_model=list[schemas.LiabilityBalanceRead],
)
def list_balances(
    liability_id: int,
    db: Session = Depends(get_db),
) -> list[schemas.LiabilityBalanceRead]:
    """List a liability's balances (chronological order)."""
    get_or_404(db, models.Liability, liability_id)
    return crud.get_balances_for_liability(db, liability_id)


@router.put(
    "/liability-balances/{balance_id}",
    response_model=schemas.LiabilityBalanceRead,
)
def update_balance(
    balance_id: int,
    payload: schemas.LiabilityBalanceCreate,
    db: Session = Depends(get_db),
) -> schemas.LiabilityBalanceRead:
    """Update a balance (409 if another balance exists for that liability+date)."""
    get_or_404(db, models.LiabilityBalance, balance_id)
    try:
        return crud.update_liability_balance(db, balance_id, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A balance for this liability and date already exists",
        )


@router.delete(
    "/liability-balances/{balance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_balance(balance_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a liability balance."""
    get_or_404(db, models.LiabilityBalance, balance_id)
    crud.delete_liability_balance(db, balance_id)


# --- The loan's plan, and the choice about paying early (PRD v3 §4.4) ----


def _parts_of(liability) -> list[dict]:
    terms = json.loads(liability.terms) if liability.terms else {}
    return terms.get("parts") or []


@router.get("/liabilities/{liability_id}/plan", response_model=schemas.LoanPlanRead)
def loan_plan(liability_id: int, db: Session = Depends(get_db)) -> dict:
    """The schedule the loan's own terms describe, beside the balance the
    reader recorded. `difference` is the gap between them — usually a
    prepayment, and named rather than left silent."""
    liability = crud.get_liability(db, liability_id)
    if liability is None:
        raise HTTPException(status_code=404, detail="No such debt")
    parts = _parts_of(liability)
    if not parts and not liability.installment_plan:
        raise HTTPException(status_code=422, detail="This debt has no plan on record")
    plan_remaining = sum(amortization.remaining_after(p) for p in parts)
    stated = liability.latest_balance
    return {
        "liability_id": liability_id,
        "name": liability.name,
        "currency": liability.currency,
        "parts": [
            {
                **p,
                "remaining": amortization.remaining_after(p),
                "monthly_payment": (
                    amortization.part_schedule(p)[0].payment
                    if amortization.part_schedule(p)
                    else 0.0
                ),
            }
            for p in parts
        ],
        "schedule": amortization.merged_schedule(parts),
        "interest_by_year": amortization.interest_by_year(parts),
        "monthly_payment": amortization.monthly_payment(parts),
        "plan_remaining": plan_remaining,
        "stated_balance": stated,
        "difference": (round(stated - plan_remaining, 2) if stated is not None else None),
        "installment": _installment_view(liability),
        "base_currency": fx.base_currency(db),
    }


def _installment_view(liability) -> dict | None:
    """The instalment plan with both its rates. The nominal figure is the fee
    arithmetic every advertisement quotes; the real one is the IRR of the
    plan's own flows (`amortization`), which is what the money costs."""
    plan = json.loads(liability.installment_plan) if liability.installment_plan else None
    if not plan:
        return None
    principal = float(plan.get("principal") or 0)
    count = int(plan.get("count") or 0)
    per = float(plan.get("per_period") or 0)
    real = amortization.effective_annual_rate(principal, count, per_payment=per) if principal and count else None
    total_fee = per * count - principal if principal and count else 0.0
    years = count / 12 if count else 1.0
    nominal = (total_fee / principal / years) if principal and years else None
    return {
        **plan,
        "total_fee": round(total_fee, 2),
        "nominal_rate": round(nominal, 6) if nominal is not None else None,
        "effective_rate": round(real, 6) if real is not None else None,
    }


@router.post("/liabilities/{liability_id}/prepay", response_model=schemas.PrepayComparison)
def prepay(
    liability_id: int, payload: schemas.PrepayRequest, db: Session = Depends(get_db)
) -> dict:
    """What paying `amount` early saves, against what it would earn invested.
    With no mode named, BOTH answers arrive — the decision card compares
    them side by side. Moves nothing: saving the comparison is a Decision,
    and executing it is a dated balance the reader writes."""
    liability = crud.get_liability(db, liability_id)
    if liability is None:
        raise HTTPException(status_code=404, detail="No such debt")
    parts = _parts_of(liability)
    if not parts:
        raise HTTPException(status_code=422, detail="This debt has no plan on record")
    modes = [payload.mode] if payload.mode else ["shorten", "reduce"]
    options = [
        amortization.prepay_comparison(
            parts, payload.amount, m, payload.expected_return, payload.volatility
        )
        for m in modes
    ]
    return {
        "liability_id": liability_id,
        "base_currency": fx.base_currency(db),
        "options": options,
    }


# --- Decisions: what was weighed and chosen, moving nothing --------------


@router.get("/decisions", response_model=list[schemas.DecisionRead])
def list_decisions(db: Session = Depends(get_db)) -> list:
    """Every comparison the reader saved, newest first."""
    return crud.get_decisions(db)


@router.post("/decisions", response_model=schemas.DecisionRead, status_code=status.HTTP_201_CREATED)
def create_decision(payload: schemas.DecisionCreate, db: Session = Depends(get_db)) -> object:
    """Keep a choice. This writes no balance and moves no money — executing
    the choice is a dated balance row the reader writes when it happens."""
    return crud.create_decision(db, payload)
