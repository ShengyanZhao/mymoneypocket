"""A bill knows the day it falls due.

PRD v3 §4.3 (CN, 账单日历). `bill_schedules` holds the payments the flow
vocabulary cannot name: the credit card's due date, the tuition of the
school's own months, the salary of the LAST WORKDAY rather than a fixed day.
Amounts are optional — a card's bill varies, and the forecast shows its date
and says 金额未定 rather than counting a guess.

One new table, no column touched. Existing rows gain no bill and lose
nothing; a fixed schedule and a recurring flow that describe one payment are
kept from counting twice by the coverage rule the forecast shares with the
cash register.

Revision ID: c5e1a9d4b27f
Revises: b4f2e8c7a103
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c5e1a9d4b27f"
down_revision = "b4f2e8c7a103"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bill_schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=True),
        sa.Column("direction", sa.String(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(), nullable=True),
        sa.Column("institution_id", sa.Integer(), sa.ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("due_day", sa.Integer(), nullable=True),
        sa.Column("due_last_workday", sa.Boolean(), nullable=False),
        sa.Column("months", sa.Text(), nullable=True),
        sa.Column("remind_days", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.String(), nullable=True),
        sa.Column("end_date", sa.String(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("bill_schedules")
