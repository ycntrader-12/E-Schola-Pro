"""tasks_classrooms_and_invitations

Revision ID: f8a1b2c3d4e5
Revises: e7f8g9h0i1j2
Create Date: 2026-09-09 16:30:00.000000

Safely and idempotently creates tasks, task_submissions, classroom_invitations,
and ensures all classroom configuration columns exist in PostgreSQL and SQLite.
Preserves 100% of existing data without destructive DDL.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "f8a1b2c3d4e5"
down_revision: Union[str, None] = "e7f8g9h0i1j2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. Table: tasks
    if "tasks" not in existing_tables:
        op.create_table(
            "tasks",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("course_name", sa.String(), nullable=False, server_default="Général"),
            sa.Column("assigned_by_id", sa.Integer(), nullable=False),
            sa.Column("target_role", sa.String(), nullable=False, server_default="all"),
            sa.Column("target_group", sa.String(), nullable=False, server_default="all"),
            sa.Column("due_date", sa.String(), nullable=False),
            sa.Column("points", sa.Integer(), nullable=False, server_default="20"),
            sa.Column("priority", sa.String(), nullable=False, server_default="moyenne"),
            sa.Column("attachment_url", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["assigned_by_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_tasks_id"), "tasks", ["id"], unique=False)
        op.create_index(op.f("ix_tasks_title"), "tasks", ["title"], unique=False)
    else:
        task_cols = [c["name"] for c in inspector.get_columns("tasks")]
        with op.batch_alter_table("tasks") as batch_op:
            if "attachment_url" not in task_cols:
                batch_op.add_column(sa.Column("attachment_url", sa.String(), nullable=True))
            if "course_name" not in task_cols:
                batch_op.add_column(sa.Column("course_name", sa.String(), nullable=True, server_default="Général"))
            if "target_role" not in task_cols:
                batch_op.add_column(sa.Column("target_role", sa.String(), nullable=True, server_default="all"))
            if "target_group" not in task_cols:
                batch_op.add_column(sa.Column("target_group", sa.String(), nullable=True, server_default="all"))
            if "priority" not in task_cols:
                batch_op.add_column(sa.Column("priority", sa.String(), nullable=True, server_default="moyenne"))

    # 2. Table: task_submissions
    if "task_submissions" not in existing_tables:
        op.create_table(
            "task_submissions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("task_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("content_link", sa.Text(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="submitted"),
            sa.Column("grade", sa.Float(), nullable=True),
            sa.Column("feedback", sa.Text(), nullable=True),
            sa.Column("submitted_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_task_submissions_id"), "task_submissions", ["id"], unique=False)

    # 3. Table: classrooms (ensure all columns exist)
    if "classrooms" in existing_tables:
        classroom_cols = [c["name"] for c in inspector.get_columns("classrooms")]
        with op.batch_alter_table("classrooms") as batch_op:
            if "target_roles" not in classroom_cols:
                batch_op.add_column(sa.Column("target_roles", sa.String(), nullable=True))
            if "target_groups" not in classroom_cols:
                batch_op.add_column(sa.Column("target_groups", sa.String(), nullable=True))
            if "is_private" not in classroom_cols:
                batch_op.add_column(sa.Column("is_private", sa.Boolean(), nullable=True, server_default=sa.text("true" if conn.dialect.name == "postgresql" else "1")))
            if "auto_invitations" not in classroom_cols:
                batch_op.add_column(sa.Column("auto_invitations", sa.Boolean(), nullable=True, server_default=sa.text("false" if conn.dialect.name == "postgresql" else "0")))
            if "allow_screen_sharing" not in classroom_cols:
                batch_op.add_column(sa.Column("allow_screen_sharing", sa.Boolean(), nullable=True, server_default=sa.text("false" if conn.dialect.name == "postgresql" else "0")))
            if "requires_approval" not in classroom_cols:
                batch_op.add_column(sa.Column("requires_approval", sa.Boolean(), nullable=True, server_default=sa.text("true" if conn.dialect.name == "postgresql" else "1")))
            if "allowed_users" not in classroom_cols:
                batch_op.add_column(sa.Column("allowed_users", sa.Text(), nullable=True))

    # 4. Table: classroom_invitations
    if "classroom_invitations" not in existing_tables:
        op.create_table(
            "classroom_invitations",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("classroom_id", sa.Integer(), nullable=False),
            sa.Column("inviter_id", sa.Integer(), nullable=False),
            sa.Column("invitee_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["classroom_id"], ["classrooms.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["inviter_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["invitee_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_classroom_invitations_id"), "classroom_invitations", ["id"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "classroom_invitations" in existing_tables:
        op.drop_table("classroom_invitations")

    if "task_submissions" in existing_tables:
        op.drop_table("task_submissions")

    if "tasks" in existing_tables:
        op.drop_table("tasks")
