from sqlalchemy import inspect, text
from app.db.database import engine


def run_migration():
    """Database-agnostic schema sync for tasks attachment_url (PostgreSQL & SQLite)."""
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "tasks" in tables:
            existing_cols = [c["name"] for c in inspector.get_columns("tasks")]
            if "attachment_url" not in existing_cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE tasks ADD COLUMN attachment_url TEXT"))
                    print("Migration: added column 'attachment_url' to 'tasks'.")
    except Exception as e:
        print(f"Tasks migration check note: {e}")


if __name__ == "__main__":
    run_migration()

