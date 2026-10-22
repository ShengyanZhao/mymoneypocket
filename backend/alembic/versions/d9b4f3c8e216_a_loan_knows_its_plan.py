"""A loan knows its plan, and a choice worth keeping is kept.

PRD v3 §4.4 (CN, 负债 2.0). `liabilities` gains two nullable JSON columns:
`terms` — the loan's own schedule (a combined loan's parts, each with its
principal, rate, method and paid periods) — and `installment_plan`, the
instalment a fee is quoted on. `decisions` keeps what the reader worked out
and chose (a prepayment comparison): the row moves no money and changes no
balance, and that is the point.

Existing rows gain two empty columns and lose nothing: a debt tracked by its
dated balances alone reads exactly as it did.

Revision ID: d9b4f3c8e216
Revises: c5e1a9d4b27f
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d9b4f3c8e216"
down_revision = "c5e1a9d4b27f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("liabilities", sa.Column("terms", sa.Text(), nullable=True))
    op.add_column("liabilities", sa.Column("installment_plan", sa.Text(), nullable=True))
    op.create_table(
        "decisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("decisions")
    op.drop_column("liabilities", "installment_plan")
    op.drop_column("liabilities", "terms")
