"""messaging_enhancements

Revision ID: e7f8g9h0i1j2
Revises: d3e4f5a6b7c8
Create Date: 2026-09-03 22:00:00.000000

Adds messaging enhancement columns (is_broadcast, is_welcome_msg, is_relay, cc_emails) to messages table.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "e7f8g9h0i1j2"
down_revision: Union[str, None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "messages" in existing_tables:
        existing_cols = [c["name"] for c in inspector.get_columns("messages")]

        new_columns = [
            ("is_broadcast", sa.Boolean(), True),
            ("is_welcome_msg", sa.Boolean(), True),
            ("is_relay", sa.Boolean(), True),
            ("cc_emails", sa.String(length=500), True),
        ]

        with op.batch_alter_table("messages") as batch_op:
            for col_name, col_type, nullable in new_columns:
                if col_name not in existing_cols:
                    batch_op.add_column(sa.Column(col_name, col_type, nullable=nullable))

        # Set default values for existing rows
        try:
            conn.execute(sa.text("UPDATE messages SET is_broadcast = FALSE WHERE is_broadcast IS NULL"))
            conn.execute(sa.text("UPDATE messages SET is_welcome_msg = FALSE WHERE is_welcome_msg IS NULL"))
            conn.execute(sa.text("UPDATE messages SET is_relay = FALSE WHERE is_relay IS NULL"))
        except Exception:
            pass


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "messages" in existing_tables:
        existing_cols = [c["name"] for c in inspector.get_columns("messages")]
        cols_to_drop = ["is_broadcast", "is_welcome_msg", "is_relay", "cc_emails"]
        with op.batch_alter_table("messages") as batch_op:
            for col_name in cols_to_drop:
                if col_name in existing_cols:
                    batch_op.drop_column(col_name)
