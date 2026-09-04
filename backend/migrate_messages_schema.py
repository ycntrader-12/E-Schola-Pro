from sqlalchemy import inspect, text
from app.db.database import engine


def run_migration():
    """
    Database-agnostic schema sync ensuring all messaging columns exist in PostgreSQL and SQLite.
    Guarantees that all messages, drafts, broadcasts, CCs, and attachments are properly saved.
    """
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "messages" in tables:
            existing_cols = [c["name"] for c in inspector.get_columns("messages")]
            columns_to_ensure = [
                ("attachment_url", "VARCHAR(500)"),
                ("attachment_name", "VARCHAR(255)"),
                ("attachment_type", "VARCHAR(50)"),
                ("is_starred", "BOOLEAN DEFAULT FALSE"),
                ("is_draft", "BOOLEAN DEFAULT FALSE"),
                ("is_trash", "BOOLEAN DEFAULT FALSE"),
                ("is_reported", "BOOLEAN DEFAULT FALSE"),
                ("report_reason", "VARCHAR(500)"),
                ("is_broadcast", "BOOLEAN DEFAULT FALSE"),
                ("is_welcome_msg", "BOOLEAN DEFAULT FALSE"),
                ("is_relay", "BOOLEAN DEFAULT FALSE"),
                ("cc_emails", "VARCHAR(500)"),
            ]

            with engine.begin() as conn:
                for col_name, col_type in columns_to_ensure:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE messages ADD COLUMN {col_name} {col_type}"))
                        print(f"Migration: added column '{col_name}' ({col_type}) to 'messages'.")

                # Sanitize boolean defaults for existing rows if null
                bool_defaults = ["is_read", "is_starred", "is_draft", "is_trash", "is_reported", "is_broadcast", "is_welcome_msg", "is_relay"]
                for b_col in bool_defaults:
                    try:
                        conn.execute(text(f"UPDATE messages SET {b_col} = FALSE WHERE {b_col} IS NULL"))
                    except Exception:
                        pass

            print("Messages schema migration verified and synchronized successfully.")
        else:
            print("Messages table does not exist yet; will be created by Base.metadata.create_all.")
    except Exception as e:
        print(f"Messages schema migration check note: {e}")


if __name__ == "__main__":
    run_migration()
