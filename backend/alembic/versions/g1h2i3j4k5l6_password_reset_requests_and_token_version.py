"""password_reset_requests_and_token_version

Revision ID: g1h2i3j4k5l6
Revises: f8a1b2c3d4e5
Create Date: 2026-09-20 15:05:00.000000

Safely and idempotently creates password_reset_requests table and adds token_version to users table.
100% compatible with PostgreSQL and SQLite, preserves all existing data without data loss.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "g1h2i3j4k5l6"
down_revision: Union[str, None] = "f8a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. Table: password_reset_requests
    if "password_reset_requests" not in existing_tables:
        op.create_table(
            "password_reset_requests",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("otp_hash", sa.String(255), nullable=False),
            sa.Column("reset_token_hash", sa.String(255), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.Column("ip_address", sa.String(100), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_password_reset_requests_id", "password_reset_requests", ["id"], unique=False)
        op.create_index("ix_password_reset_requests_user_id", "password_reset_requests", ["user_id"], unique=False)
        op.create_index("ix_password_reset_requests_email", "password_reset_requests", ["email"], unique=False)
        op.create_index("ix_password_reset_requests_reset_token_hash", "password_reset_requests", ["reset_token_hash"], unique=False)

    # 2. Add token_version to users table if missing
    if "users" in existing_tables:
        user_cols = [c["name"] for c in inspector.get_columns("users")]
        if "token_version" not in user_cols:
            op.add_column(
                "users",
                sa.Column("token_version", sa.Integer(), nullable=False, server_default="1"),
            )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "password_reset_requests" in existing_tables:
        op.drop_table("password_reset_requests")

    if "users" in existing_tables:
        user_cols = [c["name"] for c in inspector.get_columns("users")]
        if "token_version" in user_cols:
            op.drop_column("users", "token_version")
