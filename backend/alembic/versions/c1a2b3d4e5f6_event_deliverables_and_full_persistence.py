"""event_deliverables_and_full_persistence
Revision ID: c1a2b3d4e5f6
Revises: b863afb6a5e3
Create Date: 2026-09-03 14:20:00.000000

Creates event_deliverables table and ensures full schema consistency for PostgreSQL & SQLite.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "c1a2b3d4e5f6"
down_revision: Union[str, None] = "b863afb6a5e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. Create event_deliverables table if it does not already exist
    if "event_deliverables" not in existing_tables:
        op.create_table(
            "event_deliverables",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("event_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("file_url", sa.String(), nullable=True),
            sa.Column("link_url", sa.String(), nullable=True),
            sa.Column("submitted_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_event_deliverables_id"), "event_deliverables", ["id"], unique=False)

    # 2. Ensure group_name column exists on users
    if "users" in existing_tables:
        user_cols = [c["name"] for c in inspector.get_columns("users")]
        with op.batch_alter_table("users") as batch_op:
            if "group_name" not in user_cols:
                batch_op.add_column(sa.Column("group_name", sa.String(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    if "event_deliverables" in existing_tables:
        op.drop_table("event_deliverables")
