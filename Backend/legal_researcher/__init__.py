"""
This is the initialization file for the legal_researcher package.
"""

"""
Legal Researcher Module
=======================
A production-grade legal case management system with:
- User Authentication (bcrypt hashing)
- AI-powered case extraction (Groq LLM)
- PDF document processing
- Context-aware legal chat
- Legal research (Indian Kanoon via Firecrawl)
- PDF export

API Integration:
---------------
# Import the FastAPI router for integration
from legal_researcher.api import router as legal_router
app.include_router(legal_router)

# Or run standalone
python -m legal_researcher.api

Core Modules:
------------
- database_manager.py: SQLite database with user auth & case storage
- case_generator.py: AI case structuring + PDF export
- secure_chat.py: Context-aware chatbot with rate limiting
- legal_researcher.py: Indian Kanoon case search via Firecrawl
- rate_limiter.py: Token bucket rate limiter
- api.py: FastAPI endpoints for frontend integration
"""

from .database_manager import DatabaseManager
from .case_generator import CaseGenerator
from .secure_chat import SecureChatbot
from .rate_limiter import RateLimiter

__version__ = "2.0.0"
__all__ = [
    "DatabaseManager",
    "CaseGenerator", 
    "SecureChatbot",
    "RateLimiter"
]
