import os
import libsql_experimental as sqlite3
os.environ["TURSO_DATABASE_URL"] = "libsql://nyayzephyr-atharvavdeo.aws-ap-south-1.turso.io"

try:
    print("Testing Turso connection")
    # Actually without Token I cannot connect effectively to query
    pass
except Exception as e:
    print(e)
