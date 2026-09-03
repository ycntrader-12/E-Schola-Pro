import os
from sqlalchemy import inspect, text
from app.db.database import engine


def run_migration():
    """Database-agnostic schema sync for user profiles (PostgreSQL & SQLite)."""
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "users" in tables:
            existing_cols = [c["name"] for c in inspector.get_columns("users")]
            new_columns = [
                ("username", "VARCHAR"),
                ("nom", "VARCHAR"),
                ("prenom", "VARCHAR"),
                ("date_naissance", "VARCHAR"),
                ("cin", "VARCHAR"),
                ("telephone", "VARCHAR"),
                ("adresse", "TEXT"),
                ("ville", "VARCHAR"),
                ("pays", "VARCHAR"),
                ("departement", "VARCHAR"),
                ("specialisation", "VARCHAR"),
            ]
            with engine.begin() as conn:
                for col_name, col_type in new_columns:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        print(f"Migration: added column '{col_name}' ({col_type}) to 'users'.")
                
                # Backfill username with email prefix if empty for existing accounts
                try:
                    conn.execute(text("UPDATE users SET username = email WHERE username IS NULL OR username = ''"))
                except Exception as e:
                    print(f"Backfill note: {e}")

            print("User profiles schema migration completed successfully.")
    except Exception as e:
        print(f"User profiles migration check note: {e}")


if __name__ == "__main__":
    run_migration()
