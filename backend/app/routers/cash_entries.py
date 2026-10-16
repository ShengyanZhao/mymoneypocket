"""The statement lane: import a file, confirm it, and read or correct what it
wrote.

Two verbs, kept apart on purpose. `POST /api/imports/preview` reads a file and
changes NOTHING: its answer is what the parser saw, what the store already
holds (so the reader can watch the duplicates skip themselves), and which rows
look like one transfer. Only `POST /api/imports/commit` writes, and it writes
one batch — one undoable unit (`crud.delete_import_batch`).

Hand-typed movements have the flat CRUD below, with the same shape as the
imported ones: a row is a row, and only `external_id`/`import_batch_id` say
where it came from.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app import crud, importers, models, schemas
from app.database import get_db

router = APIRouter(prefix="/api", tags=["cash-entries"])


def _candidate(row: dict) -> schemas.ImportCandidate:
    """A parser's row dict as the preview/commit shape. `goods` (the item's
    own description on the statement) becomes the note when the row has no
    other — it is the words the reader recognizes the payment by."""
    return schemas.ImportCandidate(
        date=row["date"],
        direction=row["direction"],
        amount=row["amount"],
        currency="CNY",
        counterparty=row.get("counterparty"),
        channel=None,
        category=importers.suggest_category(row.get("counterparty"), row.get("goods")),
        note=row.get("note") or row.get("goods"),
        external_id=row.get("external_id"),
        raw=row.get("raw"),
    )


@router.post("/imports/preview", response_model=schemas.ImportPreview)
async def preview_import(
    file: UploadFile = File(...),
    source: str | None = Query(default=None, description="Force a parser (alipay | wechat)"),
    institution_id: int | None = Query(
        default=None,
        description="The account the rows will land in; its store is what the duplicate check reads",
    ),
    db: Session = Depends(get_db),
) -> schemas.ImportPreview:
    """Read an exported statement and say what is in it. Nothing is written:
    the reader sees every row, every suggested category, every duplicate that
    the commit would skip, before agreeing to anything."""
    raw = await file.read()
    text = importers.decode(raw)
    chosen, rows, unreadable = importers.parse(text, source)
    if chosen == "unknown" and not rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=unreadable[0] if unreadable else "无法识别的账单格式",
        )

    candidates = [_candidate(r) for r in rows]
    # The duplicates are the ACCOUNT'S, not the file's: two overlapping files
    # only meet in the store. Without an account named there is nothing to ask
    # yet, and the commit checks again anyway (it is the one that writes).
    known = (
        crud.known_external_ids(db, institution_id, [c.external_id for c in candidates])
        if institution_id is not None
        else set()
    )
    duplicates = [
        i for i, c in enumerate(candidates) if c.external_id and c.external_id in known
    ]
    pairs = importers.find_transfer_pairs(rows)
    return schemas.ImportPreview(
        source=chosen,
        filename=file.filename,
        rows_seen=len(rows),
        candidates=candidates,
        duplicates=duplicates,
        transfer_pairs=[
            schemas.TransferPair(out_index=i, in_index=j, confidence=conf) for i, j, conf in pairs
        ],
        unreadable=unreadable,
    )


@router.post("/imports/commit", response_model=schemas.ImportCommitResult)
def commit_import(
    payload: schemas.ImportCommit, db: Session = Depends(get_db)
) -> schemas.ImportCommitResult:
    """Write the confirmed rows as one batch. Idempotent per row: the same
    file twice writes nothing the second time (`crud.commit_import`), and the
    batch is the unit the reader can undo."""
    if crud.get_institution(db, payload.institution_id) is None:
        raise HTTPException(status_code=404, detail="No such account")
    batch, written, duplicates = crud.commit_import(db, payload)
    return schemas.ImportCommitResult(
        batch=schemas.ImportBatchRead.model_validate(batch),
        written=written,
        duplicates_skipped=duplicates,
        transfers=len(payload.pair_indices),
    )


@router.get("/imports", response_model=list[schemas.ImportBatchRead])
def list_imports(db: Session = Depends(get_db)) -> list[models.ImportBatch]:
    """Every import, newest first — the list to undo from."""
    return crud.get_import_batches(db)


@router.delete("/imports/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_import(batch_id: int, db: Session = Depends(get_db)) -> None:
    """Undo one import: its rows go with it, everything else stays."""
    if not crud.delete_import_batch(db, batch_id):
        raise HTTPException(status_code=404, detail="No such import")


@router.get("/cash-entries", response_model=list[schemas.CashEntryRead])
def list_cash_entries(
    institution_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    batch_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[models.CashEntry]:
    """Stored movements, newest first, narrowed by account, window or batch."""
    return crud.get_cash_entries(
        db,
        institution_id=institution_id,
        date_from=date_from,
        date_to=date_to,
        batch_id=batch_id,
    )


@router.post(
    "/cash-entries", response_model=schemas.CashEntryRead, status_code=status.HTTP_201_CREATED
)
def create_cash_entry(
    payload: schemas.CashEntryCreate, db: Session = Depends(get_db)
) -> models.CashEntry:
    """One movement typed by hand — the route for money no file covers."""
    return crud.create_cash_entry(db, payload)


@router.patch("/cash-entries/{entry_id}", response_model=schemas.CashEntryRead)
def update_cash_entry(
    entry_id: int, payload: schemas.CashEntryUpdate, db: Session = Depends(get_db)
) -> models.CashEntry:
    """Correct the reading of a row (category, counterparty, channel, note).
    Its money is not settable — see `schemas.CashEntryUpdate`."""
    entry = crud.update_cash_entry(db, entry_id, payload)
    if entry is None:
        raise HTTPException(status_code=404, detail="No such entry")
    return entry


@router.delete("/cash-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cash_entry(entry_id: int, db: Session = Depends(get_db)) -> None:
    if not crud.delete_cash_entry(db, entry_id):
        raise HTTPException(status_code=404, detail="No such entry")
