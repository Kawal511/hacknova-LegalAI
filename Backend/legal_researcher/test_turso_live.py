import os
import libsql_experimental as sqlite3
from database_manager import get_db_router
from dotenv import load_dotenv

load_dotenv()

turso_url = os.getenv("TURSO_DATABASE_URL")
turso_token = os.getenv("TURSO_AUTH_TOKEN")

if not turso_url or not turso_token:
    print("❌ ERROR: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing from your .env file.")
    print("Please export them or add them to your .env file to enable cloud DB.")
else:
    print(f"Connecting to Turso: {turso_url}")
    try:
        router = get_db_router()
        print("✅ DB Router Initialized in Cloud Mode!")
        
        # 1. Master DB Test
        with router.get_master_conn() as conn:
            res = conn.execute("SELECT name FROM sqlite_schema WHERE type='table'").fetchall()
            tables = [r[0] for r in res]
            print(f"✅ Master Connection Successful! Tables: {tables}")

        # 2. Tenant DB Test
        user_id = 999
        with router.get_tenant_conn(user_id) as conn:
            res = conn.execute("SELECT name FROM sqlite_schema WHERE type='table'").fetchall()
            tables = [r[0] for r in res]
            print(f"✅ Tenant Connection Successful! Abstracted Multi-Tenant View initialized.")
            
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
