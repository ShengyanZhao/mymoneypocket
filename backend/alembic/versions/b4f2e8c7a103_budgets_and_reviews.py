"""A month has a budget, and a review the reader answers to.

PRD v3 §4.2 (CN, 预算与月度复盘). `budgets` holds what a month's spending may
reach — one row per category per month it starts applying from, the household
ceiling included as the row whose category is NULL. `monthly_reviews` holds
only the reader's decisions about a review's suggestions: the review's own
numbers are always computed from the ledger (see `budgeting.month_review`),
so nothing here can drift from the rows it describes.

Two new tables, no column touched: every existing row gains no budget and
loses nothing. Amounts are in the base currency.

Revision ID: b4f2e8c7a103
Revises: a83f0c2d91bb
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b4f2e8c7a103"
down_revision = "a83f0c2d91bb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "budgets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("year_month", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("repeat", sa.Boolean(), nullable=False),
        sa.Column("rollover", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.UniqueConstraint("year_month", "category", name="uq_budget_month_category"),
    )
    op.create_index("ix_budgets_year_month", "budgets", ["year_month"])
    op.create_table(
        "monthly_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("year_month", sa.String(), nullable=False, unique=True),
        sa.Column("resolved", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("monthly_reviews")
    op.drop_index("ix_budgets_year_month", table_name="budgets")
    op.drop_table("budgets")
