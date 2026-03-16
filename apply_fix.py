import os

TARGET_FILE = "Backend/legal_researcher/database_manager.py"

OLD_CODE = """    def get_audit_logs(self, user_id: int, action: str = None, 
                       resource_type: str = None, limit: int = 100) -> List:
        \"\"\"Get audit logs from user's tenant database.\"\"\"
        with self.get_tenant_conn(user_id) as conn:
            query = "SELECT * FROM audit_logs WHERE 1=1"
            params = []
            
            if action:
                query += " AND action = ?"
                params.append(action)
            if resource_type:
                query += " AND resource_type = ?"
                params.append(resource_type)
            
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor = conn.execute(query, params)
            return cursor.fetchall()"""

NEW_CODE = """    def get_audit_logs(self, user_id: int = None, action: str = None, 
                       resource_type: str = None, limit: int = 100) -> List:
        \"\"\"
        Get audit logs from user's tenant database or master auth logs if user_id is None.
        \"\"\"
        if user_id is None:
            # If no user_id, fetch from global auth logs (Admin view)
            with self.get_master_conn() as conn:
                query = "SELECT log_id, timestamp, user_id, action, ip_address, user_agent, status, details FROM auth_audit_logs WHERE 1=1"
                params = []
                
                if action:
                    query += " AND action = ?"
                    params.append(action)
                
                query += " ORDER BY timestamp DESC LIMIT ?"
                params.append(limit)
                
                cursor = conn.execute(query, params)
                rows = cursor.fetchall()
                
                # Adapt to schema expected by API (auth logs don't have resource_type/id)
                results = []
                for row in rows:
                    item = dict(row)
                    item['resource_type'] = 'auth' 
                    item['resource_id'] = None
                    results.append(item)
                return results

        # Existing tenant logic
        with self.get_tenant_conn(user_id) as conn:
            query = "SELECT * FROM audit_logs WHERE 1=1"
            params = []
            
            if action:
                query += " AND action = ?"
                params.append(action)
            if resource_type:
                query += " AND resource_type = ?"
                params.append(resource_type)
            
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()
            
            # Inject user_id into the result since tenant logs don't store it (implied)
            results = []
            for row in rows:
                item = dict(row)
                item['user_id'] = user_id
                results.append(item)
            return results"""

def apply_fix():
    if not os.path.exists(TARGET_FILE):
        print(f"File not found: {TARGET_FILE}")
        return

    with open(TARGET_FILE, 'r') as f:
        content = f.read()

    # Check if already fixed (loose check)
    if "if user_id is None:" in content and "auth_audit_logs" in content:
        print("✅ Fix already applied.")
        return

    # Check if target to replace exists
    # We use a smaller snippet for matching to be robust against formatting differences
    snippet_start = "def get_audit_logs(self, user_id: int, action: str = None"
    
    if snippet_start not in content:
        print("⚠️ Could not locate original code block to replace. It might have changed in the update.")
        # Try to find the function definition and warn
        return

    # For safety, let's just attempt a replace if exact match failed, 
    # but since indenting is tricky in python replace, we'll try to match the block
    # If the user updated the file, the previous replace valid might be gone.
    # We will try to replace the exact block we saw earlier.
    
    # Actually, simpler approach: replace the exact previous state we knew
    new_content = content.replace(OLD_CODE, NEW_CODE)
    
    if new_content == content:
        print("⚠️ Replacement failed - code didn't match memory. Assuming new code might be different.")
    else:
        with open(TARGET_FILE, 'w') as f:
            f.write(new_content)
        print("✅ Patch applied successfully.")

if __name__ == "__main__":
    apply_fix()
