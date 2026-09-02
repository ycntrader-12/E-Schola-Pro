import sqlite3

def run_migration():
    conn = sqlite3.connect('backend/eschola.db')
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE classrooms ADD COLUMN target_roles VARCHAR")
        conn.commit()
        print("Migration successful: added 'target_roles' to 'classrooms'.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'target_roles' already exists in 'classrooms'.")
        else:
            print(f"Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
