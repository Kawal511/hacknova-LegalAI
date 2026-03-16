import os
import re
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class TenantCursorWrapper:
    def __init__(self, cursor, user_id):
        self.cursor = cursor
        self.user_id = user_id

    def _rewrite(self, query):
        if not self.user_id: return query
        return re.sub(r'\b(cases|documents|chat_logs|audit_logs|search_history|evidence)\b', r'\g<1>_' + str(self.user_id), query)

    def execute(self, query, parameters=()):
        if parameters:
            return self.cursor.execute(self._rewrite(query), parameters)
        return self.cursor.execute(self._rewrite(query))

    def executemany(self, query, seq_of_parameters):
        return self.cursor.executemany(self._rewrite(query), seq_of_parameters)

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def fetchmany(self, size=None):
        return self.cursor.fetchmany(size) if size else self.cursor.fetchmany()

    @property
    def lastrowid(self):
        return self.cursor.lastrowid

    def __getattr__(self, attr):
        return getattr(self.cursor, attr)

class TenantConnectionWrapper:
    def __init__(self, conn, user_id):
        self.conn = conn
        self.user_id = user_id
    
    def __enter__(self):
        if hasattr(self.conn, '__enter__'):
            self.conn.__enter__()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if hasattr(self.conn, '__exit__'):
            return self.conn.__exit__(exc_type, exc_val, exc_tb)

    def _rewrite(self, query):
        if not self.user_id: return query
        return re.sub(r'\b(cases|documents|chat_logs|audit_logs|search_history|evidence)\b', r'\g<1>_' + str(self.user_id), query)

    def execute(self, query, parameters=()):
        if parameters:
            return self.conn.execute(self._rewrite(query), parameters)
        return self.conn.execute(self._rewrite(query))
        
    def cursor(self):
        return TenantCursorWrapper(self.conn.cursor(), self.user_id)
        
    def commit(self):
        self.conn.commit()
        
    def close(self):
        self.conn.close()
    
    def __getattr__(self, attr):
        return getattr(self.conn, attr)
