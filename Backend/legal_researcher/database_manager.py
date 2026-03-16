"""
This module implements the Multi-Tenant Database Architecture. It defines the DatabaseRouter class which routes queries to isolated tenant databases (lawyer_X.db) or the master authentication database based on user context.
"""

"""
Multi-Tenant Database Router
============================
Implements secure database isolation per lawyer:

- Master DB (master_auth.db): Contains ONLY users table for authentication
- Tenant DBs (lawyer_{user_id}.db): Each lawyer gets their own isolated database

This architecture ensures:
1. Complete data isolation between lawyers
2. No accidental data leaks via SQL query mistakes
3. Easy per-lawyer backup and migration
4. GDPR-compliant data deletion (delete entire file)
"""

import sqlite3
import os
import logging
import bcrypt
from datetime import datetime
from typing import Dict, List, Optional, Any

               
BASE_DB_FOLDER = os.path.join(os.path.dirname(__file__), "databases")
MASTER_DB_NAME = "master_auth.db"

logger = logging.getLogger(__name__)


class DatabaseRouter:
    """
    Routes database connections to the appropriate database file.
    
    - Authentication queries → Master DB
    - All other queries → Tenant DB (per-lawyer)
    """
    
    def __init__(self):
                                            
        if not os.path.exists(BASE_DB_FOLDER):
            os.makedirs(BASE_DB_FOLDER)
            logger.info(f"Created databases folder: {BASE_DB_FOLDER}")
        
                                              
        self._init_master_db()
    
                                                                   
    
    def get_master_conn(self) -> sqlite3.Connection:
        """
        Connect to the Master Database for authentication operations.
        Contains: users table ONLY
        """
        db_path = os.path.join(BASE_DB_FOLDER, MASTER_DB_NAME)
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    
    def get_tenant_conn(self, user_id: int) -> sqlite3.Connection:
        """
        Connect to a specific Lawyer's private database.
        Auto-creates the database with schema if it doesn't exist.
        
        SECURITY: Each lawyer's data is completely isolated in their own file.
        """
        if not user_id:
            raise ValueError("User ID required to access tenant database - security violation!")
        
        db_filename = f"lawyer_{user_id}.db"
        db_path = os.path.join(BASE_DB_FOLDER, db_filename)
        
        is_new = not os.path.exists(db_path)
        
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        
        if is_new:
            logger.info(f"Creating new tenant database for user {user_id}")
            
        # Ensure tables exist (running IF NOT EXISTS is safe schema migration)
        self._init_tenant_tables(conn)
        
        return conn
    
                                                                
    
    def _init_master_db(self):
        """Create the Users table in Master DB - contains NO case data."""
        with self.get_master_conn() as conn:
            cursor = conn.cursor()
            
                                               
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    email TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                )
            """)
            
                                                                
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS auth_audit_logs (
                    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    status TEXT DEFAULT 'success',
                    details TEXT
                )
            """)
            conn.commit()
    
                                                                
    
    def _init_tenant_tables(self, conn: sqlite3.Connection):
        """
        Create all tables for a NEW lawyer's private database.
        
        NOTE: No user_id column needed in these tables because
        the entire FILE belongs to one user - complete isolation!
        """
        cursor = conn.cursor()
        
                                                            
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cases (
                case_id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_name TEXT,
                raw_description TEXT,
                structured_data TEXT,
                progress INTEGER DEFAULT 0,
                stage TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
                         
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER NOT NULL,
                filename TEXT,
                parsed_text TEXT,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(case_id) REFERENCES cases(case_id)
            )
        """)
        
                         
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_logs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER NOT NULL,
                role TEXT,
                content TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(case_id) REFERENCES cases(case_id)
            )
        """)
        
                                 
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action TEXT NOT NULL,
                resource_type TEXT,
                resource_id INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                details TEXT,
                status TEXT DEFAULT 'success'
            )
        """)
        
        conn.commit()
        logger.info("Initialized tenant database schema")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS search_history (
                search_id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                search_type TEXT NOT NULL,
                query TEXT NOT NULL,
                jurisdiction TEXT,
                case_id INTEGER,
                results_count INTEGER DEFAULT 0,
                results_json TEXT,
                FOREIGN KEY(case_id) REFERENCES cases(case_id)
            )
        """)
        
        # Evidence table for visual evidence analysis
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS evidence (
                evidence_id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER NOT NULL,
                file_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                thumbnail_path TEXT,
                original_filename TEXT,
                file_size INTEGER,
                analysis_json TEXT,
                is_nsfw BOOLEAN DEFAULT 0,
                content_warning TEXT,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(case_id) REFERENCES cases(case_id)
            )
        """)
        
        conn.commit()
    
                                                                                  
    
    def register_user(self, username: str, password: str, email: str = None) -> Optional[int]:
        """
        Register a new user in the Master DB.
        Returns user_id on success, None if username exists.
        """
        password_bytes = password.encode('utf-8')
        hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')
        
        try:
            with self.get_master_conn() as conn:
                cursor = conn.execute(
                    "INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)",
                    (username, hashed, email)
                )
                user_id = cursor.lastrowid
                
                                                   
                tenant_conn = self.get_tenant_conn(user_id)
                tenant_conn.close()
                
                return user_id
        except sqlite3.IntegrityError:
            return None                           
    
    def login_user(self, username: str, password: str) -> Optional[Dict]:
        """
        Verify credentials against Master DB.
        Returns user dict with user_id and username, or None if invalid.
        """
        with self.get_master_conn() as conn:
            cursor = conn.execute(
                "SELECT user_id, username, password_hash FROM users WHERE username = ?",
                (username,)
            )
            user = cursor.fetchone()
            
            if user and bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                                   
                conn.execute(
                    "UPDATE users SET last_login = ? WHERE user_id = ?",
                    (datetime.now(), user['user_id'])
                )
                return {"user_id": user['user_id'], "username": user['username']}
        return None
    
    def get_username(self, user_id: int) -> str:
        """Get username by user_id from Master DB."""
        with self.get_master_conn() as conn:
            cursor = conn.execute(
                "SELECT username FROM users WHERE user_id = ?",
                (user_id,)
            )
            user = cursor.fetchone()
            return user['username'] if user else "Unknown"
    
    def log_auth_event(self, action: str, user_id: int = None, ip_address: str = None, 
                       user_agent: str = None, status: str = "success", details: str = None):
        """Log authentication events to Master DB audit log."""
        with self.get_master_conn() as conn:
            conn.execute("""
                INSERT INTO auth_audit_logs (user_id, action, ip_address, user_agent, status, details)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, action, ip_address, user_agent, status, details))
    
                                                                        
    
    def create_case(self, user_id: int, client_name: str, raw_description: str = None, 
                    structured_data: str = "{}") -> int:
        """Create a new case in the user's tenant database."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute(
                "INSERT INTO cases (client_name, raw_description, structured_data) VALUES (?, ?, ?)",
                (client_name, raw_description, structured_data)
            )
            return cursor.lastrowid
    
    def get_user_cases(self, user_id: int) -> List:
        """Get all cases for a user from their tenant database."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute(
                "SELECT * FROM cases ORDER BY created_at DESC"
            )
            return cursor.fetchall()
    
    def get_case(self, user_id: int, case_id: int):
        """Get a specific case from user's tenant database."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute(
                "SELECT * FROM cases WHERE case_id = ?",
                (case_id,)
            )
            return cursor.fetchone()
    
    def update_case(self, user_id: int, case_id: int, **updates) -> bool:
        """Update case fields in user's tenant database."""
        if not updates:
            return False
        
        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        values = list(updates.values()) + [case_id]
        
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute(
                f"UPDATE cases SET {set_clause} WHERE case_id = ?",
                values
            )
            return cursor.rowcount > 0
    
    def update_case_progress(self, user_id: int, case_id: int, progress: int, stage: str) -> bool:
        """Update case progress in user's tenant database."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute(
                "UPDATE cases SET progress = ?, stage = ? WHERE case_id = ?",
                (progress, stage, case_id)
            )
            return cursor.rowcount > 0
    
    def delete_case(self, user_id: int, case_id: int) -> bool:
        """Delete a case from user's tenant database."""
        with self.get_tenant_conn(user_id) as conn:
                                          
            conn.execute("DELETE FROM chat_logs WHERE case_id = ?", (case_id,))
            conn.execute("DELETE FROM documents WHERE case_id = ?", (case_id,))
            cursor = conn.execute("DELETE FROM cases WHERE case_id = ?", (case_id,))
            return cursor.rowcount > 0
    
                                                                            
    
    def add_document(self, user_id: int, case_id: int, filename: str, parsed_text: str) -> int:
        """Add a document to a case in user's tenant database."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute(
                "INSERT INTO documents (case_id, filename, parsed_text) VALUES (?, ?, ?)",
                (case_id, filename, parsed_text)
            )
            return cursor.lastrowid
    
    def get_case_documents(self, user_id: int, case_id: int) -> List:
        """Get all documents for a case from user's tenant database."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute(
                "SELECT * FROM documents WHERE case_id = ?",
                (case_id,)
            )
            return cursor.fetchall()
    
                                                                        
    
    def add_chat_log(self, user_id: int, case_id: int, role: str, content: str):
        """Add a chat message in user's tenant database."""
        with self.get_tenant_conn(user_id) as conn:
            conn.execute(
                "INSERT INTO chat_logs (case_id, role, content) VALUES (?, ?, ?)",
                (case_id, role, content)
            )
    
    def get_chat_history(self, user_id: int, case_id: int, limit: int = 10) -> List:
        """Get chat history for a case from user's tenant database."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute(
                "SELECT role, content FROM chat_logs WHERE case_id = ? ORDER BY timestamp DESC LIMIT ?",
                (case_id, limit)
            )
            rows = cursor.fetchall()
            return rows[::-1]                                  
    
    def clear_chat_history(self, user_id: int, case_id: int):
        """Clear chat history for a case in user's tenant database."""
        with self.get_tenant_conn(user_id) as conn:
            conn.execute("DELETE FROM chat_logs WHERE case_id = ?", (case_id,))
    
                                                                         
    
    def log_audit(self, user_id: int, action: str, resource_type: str = None,
                  resource_id: int = None, ip_address: str = None,
                  user_agent: str = None, details: str = None, status: str = "success"):
        """Log an audit event in the user's tenant database."""
        with self.get_tenant_conn(user_id) as conn:
            conn.execute("""
                INSERT INTO audit_logs (action, resource_type, resource_id, ip_address, user_agent, details, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (action, resource_type, resource_id, ip_address, user_agent, details, status))
    
    def get_audit_logs(self, user_id: int = None, action: str = None, 
                       resource_type: str = None, limit: int = 100) -> List:
        """
        Get audit logs from user's tenant database or master auth logs if user_id is None.
        """
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
            return results
    
    def get_resource_access_history(self, user_id: int, resource_type: str, 
                                     resource_id: int, limit: int = 50) -> List:
        """Get access history for a specific resource."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute("""
                SELECT timestamp, action, ip_address, status, details
                FROM audit_logs 
                WHERE resource_type = ? AND resource_id = ?
                ORDER BY timestamp DESC 
                LIMIT ?
            """, (resource_type, resource_id, limit))
            return cursor.fetchall()
    
    # ============== SEARCH HISTORY ==============
    
    def save_search(self, user_id: int, search_type: str, query: str,
                    jurisdiction: str = None, case_id: int = None,
                    results_count: int = 0, results_json: str = None) -> int:
        """
        Save a search to the user's search history.
        
        search_type: 'acts', 'indian_cases', 'us_cases', 'uk_cases', 'comprehensive'
        """
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute("""
                INSERT INTO search_history (search_type, query, jurisdiction, case_id, results_count, results_json)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (search_type, query, jurisdiction, case_id, results_count, results_json))
            return cursor.lastrowid
    
    def get_search_history(self, user_id: int, search_type: str = None,
                           case_id: int = None, limit: int = 50) -> List:
        """Get search history for a user, optionally filtered by type or case."""
        with self.get_tenant_conn(user_id) as conn:
            query = "SELECT * FROM search_history WHERE 1=1"
            params = []
            
            if search_type:
                query += " AND search_type = ?"
                params.append(search_type)
            if case_id:
                query += " AND case_id = ?"
                params.append(case_id)
            
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor = conn.execute(query, params)
            return cursor.fetchall()
    
    def get_recent_searches(self, user_id: int, limit: int = 10) -> List:
        """Get most recent unique search queries for quick access."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute("""
                SELECT search_type, query, MAX(timestamp) as last_searched, COUNT(*) as search_count
                FROM search_history 
                GROUP BY search_type, query
                ORDER BY last_searched DESC 
                LIMIT ?
            """, (limit,))
            return cursor.fetchall()
    
    # ============== EVIDENCE MANAGEMENT ==============
    
    def save_evidence(self, user_id: int, case_id: int, file_type: str,
                      file_path: str, original_filename: str, file_size: int,
                      analysis_json: str = None, is_nsfw: bool = False,
                      content_warning: str = None, thumbnail_path: str = None) -> int:
        """
        Save evidence metadata to the user's tenant database.
        
        Args:
            user_id: User ID
            case_id: Associated case ID
            file_type: 'image' or 'video'
            file_path: Path to stored file
            original_filename: Original name of uploaded file
            file_size: File size in bytes
            analysis_json: JSON string of Gemini analysis results
            is_nsfw: Whether content is flagged as NSFW
            content_warning: Optional warning text
            thumbnail_path: Path to thumbnail (for videos)
            
        Returns:
            evidence_id of created record
        """
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute("""
                INSERT INTO evidence 
                (case_id, file_type, file_path, original_filename, file_size, 
                 analysis_json, is_nsfw, content_warning, thumbnail_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (case_id, file_type, file_path, original_filename, file_size,
                  analysis_json, is_nsfw, content_warning, thumbnail_path))
            return cursor.lastrowid
    
    def get_case_evidence(self, user_id: int, case_id: int) -> List:
        """Get all evidence items for a case."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute("""
                SELECT * FROM evidence WHERE case_id = ? ORDER BY uploaded_at DESC
            """, (case_id,))
            return cursor.fetchall()
    
    def get_evidence_item(self, user_id: int, evidence_id: int):
        """Get a specific evidence item."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute("""
                SELECT * FROM evidence WHERE evidence_id = ?
            """, (evidence_id,))
            return cursor.fetchone()
    
    def delete_evidence(self, user_id: int, evidence_id: int) -> bool:
        """Delete an evidence item."""
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute("""
                DELETE FROM evidence WHERE evidence_id = ?
            """, (evidence_id,))
            return cursor.rowcount > 0

    def get_all_user_evidence(self, user_id: int, limit: int = 50) -> List:
        """
        Get recent evidence items from ALL cases for this user.
        Joins with cases table to get client/case name.
        """
        with self.get_tenant_conn(user_id) as conn:
            cursor = conn.execute("""
                SELECT e.*, c.client_name 
                FROM evidence e
                JOIN cases c ON e.case_id = c.case_id
                ORDER BY e.uploaded_at DESC
                LIMIT ?
            """, (limit,))
            return cursor.fetchall()
    
    def get_evidence_count(self, user_id: int, case_id: int = None) -> int:
        """Get count of evidence items, optionally filtered by case."""
        with self.get_tenant_conn(user_id) as conn:
            if case_id:
                cursor = conn.execute(
                    "SELECT COUNT(*) as cnt FROM evidence WHERE case_id = ?", (case_id,))
            else:
                cursor = conn.execute("SELECT COUNT(*) as cnt FROM evidence")
            row = cursor.fetchone()
            return row['cnt'] if row else 0


                                                    
_router_instance = None

def get_db_router() -> DatabaseRouter:
    """Get the singleton DatabaseRouter instance."""
    global _router_instance
    if _router_instance is None:
        _router_instance = DatabaseRouter()
    return _router_instance


                                                
DatabaseManager = DatabaseRouter
