"""A household has members; every row of money may name one.

PRD v3 §4.1 (CN, 家庭账本). The north star becomes a HOUSEHOLD's complete
picture rather than one person's: `members` holds the people, and the nine
tables that carry money gain a nullable `member_id` naming whose it is. Null
is 共同 — shared, the household's own — and every existing row keeps it, so
this migration changes no total and no calculation by itself.

One new table and nine nullable columns, no defaults and no backfill: the
batch-assign tool (`POST /api/institutions/{id}/assign`) is what stamps an
account's history later, when the reader says whose card a statement was.
FKs are SET NULL: deleting a member leaves its rows shared, never orphaned.

The columns are added in batch mode (the copy-and-move the SQLite dialect
asks for), because a FOREIGN KEY is a table's constraint and SQLite cannot
add one by ALTER — an unadorned `add_column` would store the column bare, and
a migrated database would then answer "whose is this row?" differently from a
fresh one.

Revision ID: a83f0c2d91bb
Revises: c8d2e1b35f22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a83f0c2d91bb"
down_revision = "c8d2e1b35f22"
branch_labels = None
depends_on = None

# The tables that carry money and may name whose it is. Snapshots, holdings,
# valuations and balances deliberately stay out: a photograph of an account is
# ascribed through the account, and a dated figure through its parent.
TABLES = [
    "institutions",
    "real_assets",
    "liabilities",
    "income_sources",
    "expenses",
    "transfers",
    "goals",
    "transactions",
    "cash_entries",
]


def upgrade() -> None:
    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
    )
    for table in TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("member_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                f"fk_{table}_member_id",
                "members",
                ["member_id"],
                ["id"],
                ondelete="SET NULL",
            )
    # Only the entries list filters by member; the other tables are walked
    # whole by the summaries and would gain nothing from an index.
    op.create_index("ix_cash_entries_member_id", "cash_entries", ["member_id"])


def downgrade() -> None:
    op.drop_index("ix_cash_entries_member_id", table_name="cash_entries")
    for table in reversed(TABLES):
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_constraint(f"fk_{table}_member_id", type_="foreignkey")
            batch_op.drop_column("member_id")
    op.drop_table("members")
