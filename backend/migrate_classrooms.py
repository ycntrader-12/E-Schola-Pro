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
                for col in ["target_roles", "target_groups"]:
                    if col not in existing_cols:
                        conn.execute(text(f"ALTER TABLE classrooms ADD COLUMN {col} VARCHAR"))
                        print(f"Migration: added column '{col}' to 'classrooms'.")
    except Exception as e:
        print(f"Classroom migration check note: {e}")


if __name__ == "__main__":
    run_migration()
