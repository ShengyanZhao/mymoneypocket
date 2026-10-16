"""The category vocabularies, handed to every form and every importer.

One route over `app/taxonomy.py`: the lists themselves are code, not data, and
a route is how the frontend stops owning its own copy of them.
"""

from __future__ import annotations

from fastapi import APIRouter

from app import schemas, taxonomy

router = APIRouter(prefix="/api", tags=["taxonomy"])


@router.get("/taxonomy", response_model=schemas.TaxonomyRead)
def get_taxonomy() -> schemas.TaxonomyRead:
    """The words each form offers: income, expense, statement entry — and the
    alias map that makes rows stored under an old code readable."""
    return schemas.TaxonomyRead(
        income=list(taxonomy.INCOME),
        expense=list(taxonomy.EXPENSE),
        entry=list(taxonomy.ENTRY),
        aliases=dict(taxonomy.ALIASES),
    )
