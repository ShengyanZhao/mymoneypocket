"""The household: who this ledger is about, and whose an account is.

PRD v3 §4.1 (家庭账本). Members are an ATTRIBUTION dimension, not logins: one
database, one reader, and a couple who each record their own spending while
reading one household picture. Every row of money may name one member; null
is 共同 (shared), a first-class answer rather than an omission.

The assign route is the migration tool for history already recorded: point an
account at a member and its unattributed rows follow (see
`crud.assign_institution` for exactly what it will and will not stamp).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api", tags=["members"])


@router.get("/members", response_model=list[schemas.MemberRead])
def list_members(db: Session = Depends(get_db)) -> list:
    """The household, oldest first."""
    return crud.get_members(db)


@router.post("/members", response_model=schemas.MemberRead, status_code=status.HTTP_201_CREATED)
def create_member(
    payload: schemas.MemberCreate, db: Session = Depends(get_db)
) -> object:
    """Add someone to the household. Nothing else happens: their first row
    names them when the reader says it does."""
    return crud.create_member(db, payload)


@router.patch("/members/{member_id}", response_model=schemas.MemberRead)
def update_member(
    member_id: int, payload: schemas.MemberUpdate, db: Session = Depends(get_db)
) -> object:
    """Rename a member or change how they are described. Their rows are not
    touched: an edit of the person is not an edit of everything they paid for."""
    member = crud.update_member(db, member_id, payload)
    if member is None:
        raise HTTPException(status_code=404, detail="No such member")
    return member


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(member_id: int, db: Session = Depends(get_db)) -> None:
    """Remove a member. Their rows go on saying what they said, shared (共同):
    the ledger loses an attribution and never a record."""
    if not crud.delete_member(db, member_id):
        raise HTTPException(status_code=404, detail="No such member")


@router.post(
    "/institutions/{institution_id}/assign",
    response_model=schemas.MemberAssignResult,
)
def assign_institution(
    institution_id: int, payload: schemas.MemberAssign, db: Session = Depends(get_db)
) -> schemas.MemberAssignResult:
    """Say whose account this is, and stamp the history on it nobody named.

    Rows that already name somebody keep their attribution — see
    `crud.assign_institution`. `member_id: null` marks the account shared."""
    if payload.member_id is not None and crud.get_member(db, payload.member_id) is None:
        raise HTTPException(status_code=404, detail="No such member")
    if crud.get_institution(db, institution_id) is None:
        raise HTTPException(status_code=404, detail="No such account")
    stamped = crud.assign_institution(db, institution_id, payload.member_id)
    return schemas.MemberAssignResult(
        institution_id=institution_id,
        member_id=payload.member_id,
        stamped=stamped,
    )
