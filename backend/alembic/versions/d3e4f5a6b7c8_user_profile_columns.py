"""user_profile_columns
Revision ID: d3e4f5a6b7c8
Revises: c1a2b3d4e5f6
Create Date: 2026-09-03 18:25:00.000000

Adds user profile columns and ensures full schema consistency for PostgreSQL & SQLite.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "c1a2b3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "users" in existing_tables:
        existing_cols = [c["name"] for c in inspector.get_columns("users")]
        
        new_columns = [
            ("username", sa.String(), True),
            ("nom", sa.String(), True),
            ("prenom", sa.String(), True),
            ("date_naissance", sa.String(), True),
            ("cin", sa.String(), True),
            ("telephone", sa.String(), True),
            ("adresse", sa.Text(), True),
            ("ville", sa.String(), True),
            ("pays", sa.String(), True),
            ("departement", sa.String(), True),
            ("specialisation", sa.String(), True),
        ]

        with op.batch_alter_table("users") as batch_op:
            for col_name, col_type, nullable in new_columns:
                if col_name not in existing_cols:
                    batch_op.add_column(sa.Column(col_name, col_type, nullable=nullable))

        # Ensure index on username
        existing_indices = [idx["name"] for idx in inspector.get_indexes("users")]
        if "ix_users_username" not in existing_indices:
            try:
                op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
            except Exception:
                pass

        # Backfill username with email prefix if empty
        try:
            conn.execute(sa.text("UPDATE users SET username = email WHERE username IS NULL OR username = ''"))
        except Exception:
            pass


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "users" in existing_tables:
        existing_cols = [c["name"] for c in inspector.get_columns("users")]
        cols_to_drop = [
            "username", "nom", "prenom", "date_naissance", "cin",
            "telephone", "adresse", "ville", "pays", "departement", "specialisation"
        ]
        with op.batch_alter_table("users") as batch_op:
            for col_name in cols_to_drop:
                if col_name in existing_cols:
                    batch_op.drop_column(col_name)
