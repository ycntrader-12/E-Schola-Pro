import os
import sqlite3

def run_migration():
    db_paths = ['backend/eschola.db', 'eschola.db', 'backend/sql_app.db', 'sql_app.db']
    try:
        from app.core.config import settings
        if settings.DATABASE_URL.startswith("sqlite"):
            configured_path = settings.DATABASE_URL.replace("sqlite:///", "").split("?")[0]
            if configured_path not in db_paths:
                db_paths.insert(0, configured_path)
    except Exception:
        pass

    for db_path in db_paths:
        if not os.path.exists(db_path):
            continue
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        for col in ["target_roles", "target_groups"]:
            try:
                cursor.execute(f"ALTER TABLE classrooms ADD COLUMN {col} VARCHAR")
                conn.commit()
                print(f"[{db_path}] Migration successful: added '{col}' to 'classrooms'.")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    print(f"[{db_path}] Column '{col}' already exists in 'classrooms'.")
                else:
                    print(f"[{db_path}] Note for '{col}': {e}")
        conn.close()

if __name__ == "__main__":
    run_migration()
