import re

with open('./legal_researcher/database_manager.py', 'r') as f:
    code = f.read()

# Replace sqlite3 import
code = re.sub(
    r'^import sqlite3$', 
    'import os\nif os.getenv("TURSO_DATABASE_URL"):\n    import libsql_experimental as sqlite3\nelse:\n    import sqlite3\n', 
    code, flags=re.MULTILINE
)

with open('./legal_researcher/database_manager.py', 'w') as f:
    f.write(code)
