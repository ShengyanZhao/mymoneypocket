"""The statement lane: import batches and the cash entries they wrote.

CN iteration M1. An Alipay/WeChat statement is made of ONE-OFF movements, and
the recurring flows (`income_sources`/`expenses`) could not hold them without
either lying about a pattern or being rewritten once per payment. So the third
voice of the cash register gets its own pair of tables:

- `import_batches` — one exported file, one batch. Its id is what makes an
  import undoable (delete the batch, and the reader's own hand-typed rows
  around it stay) and what the preview counts against.
- `cash_entries` — one ACTUAL movement per row: date, account, direction,
  amount, currency, category, counterparty, channel. `external_id` is the
  statement's own transaction number, UNIQUE per institution, which is the
  whole of the import's idempotency: the same file twice writes nothing the
  second time. `is_transfer_leg`/`linked_transfer_id` keep a paired transfer
  leg visible without letting the projection count it twice.

Two new tables only. No column of any existing table changes: the projection
rule (a recurring flow counts only where no entry covers it) is application
logic and lands with its own commit and tests.

Revision ID: b7c1d0a24e11
Revises: e62c6f6c8060
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b7c1d0a24e11"
down_revision = "e62c6f6c8060"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "import_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=True),
        sa.Column("rows_seen", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_written", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_duplicate", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("date_from", sa.String(), nullable=True),
        sa.Column("date_to", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
    )
    op.create_table(
        "cash_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("date", sa.String(), nullable=False),
        sa.Column("institution_id", sa.Integer(), sa.ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("direction", sa.String(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("counterparty", sa.String(), nullable=True),
        sa.Column("channel", sa.String(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("external_id", sa.String(), nullable=True),
        sa.Column("import_batch_id", sa.Integer(), sa.ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_transfer_leg", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("linked_transfer_id", sa.Integer(), sa.ForeignKey("transfers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.UniqueConstraint(
            "institution_id", "external_id", name="uq_cash_entry_institution_external"
        ),
    )
    op.create_index("ix_cash_entries_date", "cash_entries", ["date"])
    op.create_index("ix_cash_entries_institution_id", "cash_entries", ["institution_id"])
    op.create_index("ix_cash_entries_import_batch_id", "cash_entries", ["import_batch_id"])
    op.create_index("ix_cash_entries_linked_transfer_id", "cash_entries", ["linked_transfer_id"])


def downgrade() -> None:
    op.drop_index("ix_cash_entries_linked_transfer_id", table_name="cash_entries")
    op.drop_index("ix_cash_entries_import_batch_id", table_name="cash_entries")
    op.drop_index("ix_cash_entries_institution_id", table_name="cash_entries")
    op.drop_index("ix_cash_entries_date", table_name="cash_entries")
    op.drop_table("cash_entries")
    op.drop_table("import_batches")
