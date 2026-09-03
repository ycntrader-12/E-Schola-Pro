"""legacy_sync
Revision ID: b863afb6a5e3
Revises: 23940a40bfca
Create Date: 2026-09-03 14:15:00.000000

Reconciles legacy revision b863afb6a5e3 with the current codebase,
ensuring target_roles and target_groups on classrooms and attachment_url on tasks.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b863afb6a5e3"
down_revision: Union[str, None] = "23940a40bfca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. Sync classrooms columns
    if "classrooms" in existing_tables:
        existing_cols = [c["name"] for c in inspector.get_columns("classrooms")]
        with op.batch_alter_table("classrooms") as batch_op:
            if "target_roles" not in existing_cols:
                batch_op.add_column(sa.Column("target_roles", sa.String(), nullable=True))
            if "target_groups" not in existing_cols:
                batch_op.add_column(sa.Column("target_groups", sa.String(), nullable=True))

    # 2. Sync tasks attachment_url column
    if "tasks" in existing_tables:
        existing_cols = [c["name"] for c in inspector.get_columns("tasks")]
        with op.batch_alter_table("tasks") as batch_op:
            if "attachment_url" not in existing_cols:
                batch_op.add_column(sa.Column("attachment_url", sa.String(), nullable=True))


def downgrade() -> None:
    pass
