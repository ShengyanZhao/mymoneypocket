"""A ledger entry says when its second half lands.

PRD §4.3 (CN). One trade has two settlement moments: an OTC fund bought on
the 3rd takes its cash on the 3rd and its units on the 4th (T+1, T+2 for
QDII), and a redemption leaves its units when it is made and pays days later.
`transactions.date` stays the trade; the new nullable `confirm_date` names
the later moment. Null is "nothing lagged", which is every existing row and
most new ones — the column changes no row and no calculation by itself.

One nullable column, no index: the projections walk every entry of a
position (they are few) and sort in Python, so an index would buy nothing.

Revision ID: c8d2e1b35f22
Revises: b7c1d0a24e11
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c8d2e1b35f22"
down_revision = "b7c1d0a24e11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("confirm_date", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "confirm_date")
