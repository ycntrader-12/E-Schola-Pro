from sqlalchemy import inspect, text
from app.db.database import engine


def run_migration():
    """Database-agnostic schema sync for classrooms (PostgreSQL & SQLite)."""
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "classrooms" in tables:
            existing_cols = [c["name"] for c in inspector.get_columns("classrooms")]
            with engine.begin() as conn:
                for col in ["target_roles", "target_groups", "allowed_users"]:
                    if col not in existing_cols:
                        conn.execute(text(f"ALTER TABLE classrooms ADD COLUMN {col} VARCHAR"))
                        print(f"Migration: added column '{col}' to 'classrooms'.")
                
                # Boolean fields with default values
                bool_defaults = {
                    "is_private": "TRUE",
                    "auto_invitations": "FALSE",
                    "allow_screen_sharing": "FALSE",
                    "requires_approval": "TRUE",
                }
                for col, default_val in bool_defaults.items():
                    if col not in existing_cols:
                        conn.execute(text(f"ALTER TABLE classrooms ADD COLUMN {col} BOOLEAN DEFAULT {default_val}"))
                        print(f"Migration: added boolean column '{col}' with default {default_val} to 'classrooms'.")

    except Exception as e:
        print(f"Classroom migration check note: {e}")


if __name__ == "__main__":
    run_migration()
