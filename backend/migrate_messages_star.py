from sqlalchemy import inspect, text
from app.db.database import engine


def run_migration():
    """Database-agnostic schema sync for messages is_starred (PostgreSQL & SQLite)."""
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "messages" in tables:
            existing_cols = [c["name"] for c in inspector.get_columns("messages")]
            if "is_starred" not in existing_cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE messages ADD COLUMN is_starred BOOLEAN DEFAULT FALSE"))
                    print("Migration: added column 'is_starred' to 'messages'.")
    except Exception as e:
        print(f"Messages star migration check note: {e}")


if __name__ == "__main__":
    run_migration()
