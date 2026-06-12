import sqlite3
import os

db_path = "/home/guss/Documentos/POLLA/APP/db/database.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create settings table
cursor.execute("""
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL
)
""")

# Insert default settings
cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('points_exact', 3)")
cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('points_outcome', 1)")
cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('points_fail', 0)")

conn.commit()
conn.close()
print("Settings table added and initialized successfully.")
