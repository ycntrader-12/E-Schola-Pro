import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "eschola.db")

if not os.path.exists(db_path):
    print("Database eschola.db not found. Creating it or it uses a different name.")
    db_path = os.path.join(os.path.dirname(__file__), "sql_app.db")

if os.path.exists(db_path):
    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE tasks ADD COLUMN attachment_url TEXT;")
        print("Successfully added attachment_url column to tasks table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column attachment_url already exists.")
        else:
            print(f"Error: {e}")
            
    conn.commit()
    conn.close()
else:
    print("No database found to migrate.")

