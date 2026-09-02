import os
import sqlite3

def run_migration():
    db_paths = ['backend/eschola.db', 'eschola.db', 'backend/sql_app.db', 'sql_app.db']
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
