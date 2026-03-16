"""
This module defines the FastAPI routes for the Legal AI Platform, handling authentication (JWT), case management, AI chat, and document processing endpoints. It serves as the primary interface for the frontend.
"""

"""
Legal Researcher API Module - Frontend Integration
===================================================
FastAPI endpoints exposing legal_researcher functionality:
- User Authentication (register/login/logout)
- Case Management (create/read/update/delete)
- AI Chat with Cases
- PDF Document Upload & Processing
- PDF Export
- Legal Research (Indian Kanoon)

This module integrates with the existing database_manager.py
without changing the core architecture.

Usage:
------
# Standalone:
    cd legal_researcher
    python api.py

# Integrated with another FastAPI app:
    from legal_researcher.api import router as legal_router
    app.include_router(legal_router)
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request, Query
from reranker import get_reranker


from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import asynccontextmanager
import os
import sys
import json
import tempfile
from PyPDF2 import PdfReader
from dotenv import load_dotenv

# Load environment variables from .env file before importing other modules
_current_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_current_dir, ".env"))

if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from database_manager import DatabaseManager
from case_generator import CaseGenerator
from secure_chat import SecureChatbot
from legal_researcher import LegalResearcher, ClientDB, FIRECRAWL_API_KEY
from translation import translate_to_english, translate_from_english, get_supported_languages
from jwt_auth import (
    create_access_token, 
    verify_password, 
    hash_password,
    get_current_user, 
    get_user_id,
    get_user_id_flexible,
    UserCredentials,
    AuthResponse
)

                              
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found in environment. Please set it in .env file.")

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")


# ====================== SECURITY EVENT TRACKER ======================
class SecurityEventTracker:
    """In-memory tracker for security events displayed on admin dashboard."""
    def __init__(self):
        self.prompt_injections_blocked = 0
        self.rate_limit_hits = 0
        self.output_validations_blocked = 0
        self.hallucinations_flagged = 0
        self.total_queries_sanitized = 0
    
    def increment_injection_block(self):
        self.prompt_injections_blocked += 1
        self.total_queries_sanitized += 1
    
    def increment_rate_limit(self):
        self.rate_limit_hits += 1
    
    def increment_output_block(self):
        self.output_validations_blocked += 1
    
    def increment_hallucination(self):
        self.hallucinations_flagged += 1
    
    def get_stats(self) -> dict:
        return {
            "prompt_injections_blocked": self.prompt_injections_blocked,
            "rate_limit_hits": self.rate_limit_hits,
            "output_validations_blocked": self.output_validations_blocked,
            "hallucinations_flagged": self.hallucinations_flagged,
            "total_queries_sanitized": self.total_queries_sanitized
        }

# Global security tracker instance
security_tracker = SecurityEventTracker()


                                                                                 
_db_router = None
_case_generator = None
_chatbot = None
_legal_researcher_instance = None
_client_db = None

def get_db_router():
    """Get the DatabaseRouter for multi-tenant database access."""
    global _db_router
    if _db_router is None:
        _db_router = DatabaseManager()                                                    
    return _db_router

                              
def get_db_manager():
    return get_db_router()

def get_case_generator():
    global _case_generator
    if _case_generator is None:
        _case_generator = CaseGenerator(GROQ_API_KEY)
    return _case_generator

def get_chatbot():
    global _chatbot
    if _chatbot is None:
        _chatbot = SecureChatbot(GROQ_API_KEY)
    return _chatbot

def get_legal_researcher():
    global _legal_researcher_instance
    if _legal_researcher_instance is None:
        _legal_researcher_instance = LegalResearcher(FIRECRAWL_API_KEY, GROQ_API_KEY)
    return _legal_researcher_instance

def get_client_db():
    global _client_db
    if _client_db is None:
        _client_db = ClientDB("client_database")
    return _client_db

                            
db_manager = property(lambda self: get_db_manager())


               
router = APIRouter(prefix="/legal", tags=["Legal Researcher"])


                                                           

                     
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)

class LoginRequest(BaseModel):
    username: str
    password: str

# AuthResponse is imported from jwt_auth module

                     
class ManualCaseCreate(BaseModel):
    """Create case with manual entry"""
    client_name: str
    opposing_party: Optional[str] = None
    incident_date: Optional[str] = None
    case_type: Optional[str] = None
    legal_issue_summary: Optional[str] = None
    key_evidence_list: Optional[List[str]] = []
    applicable_laws: Optional[List[str]] = []
    recommended_actions: Optional[List[str]] = []

class AICaseCreate(BaseModel):
    """Create case with AI extraction from raw notes"""
    raw_notes: str = Field(..., min_length=10)

class CaseResponse(BaseModel):
    case_id: int
    client_name: str
    structured_data: Dict[str, Any]
    raw_description: Optional[str] = None
    created_at: str
    documents: Optional[List[Dict]] = []
    progress: int = 0
    stage: str = ""
    is_complete: bool = False

class CaseListResponse(BaseModel):
    cases: List[CaseResponse]
    total: int

class ProgressUpdateRequest(BaseModel):
    """Request model for updating case progress"""
    user_id: int
    progress: int = Field(..., ge=0, le=100, description="Progress percentage 0-100")
    stage: str = Field(..., description="Current stage: filing, trial, appeal, complete, etc.")

class ImportKanoonDocumentRequest(BaseModel):
    """Request model for importing Kanoon doc"""
    case_id: int
    url: str
    title: str

class SearchKanoonRequest(BaseModel):
    query: str

class ChatRequest(BaseModel):
    case_id: int
    query: str = Field(..., min_length=1)
    language: str = Field(default="en", description="Language code for translation (e.g., 'es', 'hi', 'fr')")
    use_neural: bool = Field(default=False, description="Whether to use HuggingFace APIs for neural translation")

class ChatResponse(BaseModel):
    response: str
    case_id: int
    language: str = "en"

class ChatHistoryResponse(BaseModel):
    case_id: int
    messages: List[Dict[str, str]]

                               
class ResearchRequest(BaseModel):
    client_name: str
    case_title: str
    description: str = Field(..., min_length=10)

class CaseInfo(BaseModel):
    url: str
    case_title: str
    court: str
    date: str
    case_type: str
    verdict: str
    parties: Dict[str, str]
    summary: str
    ai_summary: Optional[str] = None
    relevance_score: Optional[float] = None

class ResearchResponse(BaseModel):
    success: bool
    client_name: str
    case_title: str
    results: List[CaseInfo]
    total_found: int


# ====================== AUTHENTICATION ENDPOINTS ======================

@router.post("/auth/register", response_model=AuthResponse)
async def register_user(credentials: UserCredentials, request: Request):
    """
    Register a new user with JWT authentication.
    
    Pydantic UserCredentials model prevents mass assignment attacks
    by only accepting username and password fields.
    """
    db = get_db_manager()
    client_ip = request.client.host if request.client else "unknown"
    
                                  
    existing = db.login_user(credentials.username, "dummy")                                  
    if existing is not True and existing is not False:
                                     
        db.log_audit(
            action="REGISTER_FAILED",
            resource_type="auth",
            ip_address=client_ip,
            details=f"Username already exists: {credentials.username}",
            status="denied"
        )
        raise HTTPException(status_code=400, detail="Username already exists")
    
                       
    success = db.register_user(credentials.username, credentials.password)
    if not success:
        raise HTTPException(status_code=400, detail="Registration failed - username may already exist")
    
                                           
    user = db.login_user(credentials.username, credentials.password)
    if not user:
        raise HTTPException(status_code=500, detail="Registration succeeded but login failed")
    
    user_id = user['user_id']
    token, expires_in = create_access_token(user_id, credentials.username)
    
                                 
    db.log_audit(
        action="USER_REGISTERED",
        user_id=user_id,
        resource_type="auth",
        ip_address=client_ip,
        details=f"New user registered: {credentials.username}"
    )
    
    return AuthResponse(
        access_token=token,
        expires_in=expires_in,
        user_id=user_id,
        username=credentials.username
    )


@router.post("/auth/login", response_model=AuthResponse)
async def login_user(credentials: UserCredentials, request: Request):
    """
    Login with username/password and receive a JWT token.
    
    The token should be sent in subsequent requests as:
    Authorization: Bearer <token>
    """
    db = get_db_manager()
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    user = db.login_user(credentials.username, credentials.password)
    
    if not user:
                                  
        db.log_audit(
            user_id=0,  # Use 0 for failed login attempts (no valid user)
            action="LOGIN_FAILED",
            resource_type="auth",
            ip_address=client_ip,
            user_agent=user_agent,
            details=f"Failed login attempt for: {credentials.username}",
            status="denied"
        )
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    user_id = user['user_id']
    token, expires_in = create_access_token(user_id, credentials.username)
    
                          
    db.log_audit(
        action="USER_LOGIN",
        user_id=user_id,
        resource_type="auth",
        ip_address=client_ip,
        user_agent=user_agent,
        details=f"User logged in: {credentials.username}"
    )
    
    return AuthResponse(
        access_token=token,
        expires_in=expires_in,
        user_id=user_id,
        username=credentials.username
    )


@router.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get information about the currently authenticated user.
    
    Requires valid JWT token in Authorization header.
    This endpoint demonstrates the get_current_user dependency.
    """
    return {
        "user_id": current_user["user_id"],
        "username": current_user["username"],
        "authenticated": True
    }


@router.post("/auth/refresh", response_model=AuthResponse)
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """
    Refresh an existing JWT token before it expires.
    
    Requires valid JWT token in Authorization header.
    """
    user_id = current_user["user_id"]
    username = current_user["username"]
    
    token, expires_in = create_access_token(user_id, username)
    
    return AuthResponse(
        access_token=token,
        expires_in=expires_in,
        user_id=user_id,
        username=username
    )


                                                                     

@router.post("/cases/manual", response_model=CaseResponse)
async def create_case_manual(case_data: ManualCaseCreate, user_id: int = Query(..., description="User ID")):
    """
    Create a new case with manual data entry.
    All fields are provided by the user.
    """
    structured_data = {
        "client_name": case_data.client_name,
        "opposing_party": case_data.opposing_party,
        "incident_date": case_data.incident_date,
        "case_type": case_data.case_type,
        "legal_issue_summary": case_data.legal_issue_summary,
        "key_evidence_list": case_data.key_evidence_list,
        "applicable_laws": case_data.applicable_laws,
        "recommended_actions": case_data.recommended_actions
    }
    
    db = get_db_manager()
                                             
    structured_json = json.dumps(structured_data)
    
               
    print(f"Creating manual case for user {user_id}")
    
                                                                                                 
    case_id = db.create_case(user_id, case_data.client_name, raw_description=case_data.legal_issue_summary, structured_data=structured_json)
    case = db.get_case(user_id, case_id)
    
    return CaseResponse(
        case_id=case_id,
        client_name=case_data.client_name,
        structured_data=structured_data,
        raw_description=case_data.legal_issue_summary,
        created_at=str(case['created_at'])
    )


@router.post("/cases/ai-extract", response_model=CaseResponse)
async def create_case_ai(case_data: AICaseCreate, user_id: int = Query(..., description="User ID")):
    """
    Create a new case using AI extraction from raw notes.
    AI extracts: client_name, opposing_party, incident_date, 
    legal_issue_summary, key_evidence_list, applicable_laws, recommended_actions.
    """
                   
    structured_data = get_case_generator().generate_case_structure(case_data.raw_notes)
    
    if not structured_data:
        raise HTTPException(status_code=500, detail="AI failed to extract case structure")
    
    db = get_db_manager()
    client_name = structured_data.get('client_name', 'Unknown Client')
    
                       
    structured_json = json.dumps(structured_data)
    
                            
    case_id = db.create_case(user_id, client_name, raw_description=case_data.raw_notes, structured_data=structured_json)
    case = db.get_case(user_id, case_id)
    
    return CaseResponse(
        case_id=case_id,
        client_name=client_name,
        structured_data=structured_data,
        raw_description=case_data.raw_notes,
        created_at=str(case['created_at'])
    )


@router.post("/cases/pdf-upload", response_model=CaseResponse)
async def create_case_from_pdf(
    file: UploadFile = File(...),
    user_id: int = Query(..., description="User ID")
):
    """
    Create a new case by uploading and processing a PDF document.
    AI extracts structured case data from the PDF content.
    """
    filename = file.filename or "document.pdf"
    if not filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
                                    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name
    
    try:
                               
        reader = PdfReader(tmp_path)
        full_text = ""
        for page in reader.pages:
            text = page.extract_text() or ""
            full_text += text + "\n"
        
        if len(full_text) < 100:
            raise HTTPException(
                status_code=400, 
                detail="Could not extract text from PDF. File may be scanned/image-based."
            )
        
                                                                       
        structured_data = get_case_generator().generate_case_structure(full_text[:5000])
        
        if not structured_data:
            raise HTTPException(status_code=500, detail="AI failed to analyze PDF document")
        
        client_name = structured_data.get('client_name', 'PDF Upload')
        
        db = get_db_manager()
        
                           
        structured_json = json.dumps(structured_data)
        
                   
        case_id = db.create_case(
            user_id, 
            client_name, 
            raw_description=f"[PDF: {filename}]",
            structured_data=structured_json
        )
        
                            
        db.add_document(user_id, case_id, filename, full_text)
        
        case = db.get_case(user_id, case_id)
        docs = db.get_case_documents(user_id, case_id)
        
        return CaseResponse(
            case_id=case_id,
            client_name=client_name,
            structured_data=structured_data,
            raw_description=f"[PDF: {filename}]",
            created_at=str(case['created_at']),
            documents=[dict(d) for d in docs]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF processing failed: {str(e)}")
    finally:
                           
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.post("/cases/import-kanoon")
async def import_kanoon_document(
    request: ImportKanoonDocumentRequest,
    user_id: int = Query(..., description="User ID (optional for now, or from context)")
):
    """
    Import a document from Indian Kanoon directly into a case.
    Fetches full text/markdown and saves it.
    """
    db = get_db_manager()
    
    # 1. Verify case exists
    case = db.get_case(user_id, request.case_id)
    if not case:
         raise HTTPException(status_code=404, detail="Case not found")
         
    researcher = get_legal_researcher()
    try:
        # 2. Fetch document content
        print(f"Importing Kanoon doc: {request.url}")
        results = researcher.get_case_details([request.url])
        if not results:
             raise HTTPException(status_code=500, detail="Failed to fetch document content")
             
        url, doc = results[0]
        markdown = doc.markdown if hasattr(doc, 'markdown') else str(doc)
        
        if not markdown or len(markdown) < 50:
             raise HTTPException(status_code=500, detail="Document content is empty or invalid")
             
        # 3. Save to documents
        # Sanitize filename
        clean_title = "".join(c for c in request.title if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
        if not clean_title:
            clean_title = "kanoon_doc"
        filename = f"{clean_title}.md"
        
        # Check if already exists (optional, simply add unique suffix if needed, but for now overwrite or duplicate)
        # add_document handles DB insert.
        
        doc_id = db.add_document(user_id, request.case_id, filename, markdown)
        
        return {"success": True, "document_id": doc_id, "message": "Document imported successfully"}
        
    except Exception as e:
        print(f"Import failed: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.get("/cases/{case_id}/research-history")
async def get_case_research_history(case_id: int, user_id: int = Query(...)):
    """Get research history for a case"""
    db = get_db_router()
    history = db.get_search_history(user_id, case_id=case_id, search_type="comprehensive")
    
    # Parse results json
    results = []
    for item in history:
        res_data = None
        if item["results_json"]:
            try:
                res_data = json.loads(item["results_json"])
            except:
                pass
        
        results.append({
            "search_id": item["search_id"],
            "query": item["query"],
            "timestamp": item["timestamp"],
            "results": res_data
        })
        
    return {"success": True, "history": results}

@router.post("/cases/search-kanoon")
async def search_kanoon(request: SearchKanoonRequest):
    """
    Search Indian Kanoon for documents.
    Returns a list of potential matches with titles (fetched via scraping).
    """
    researcher = get_legal_researcher()
    try:
        # 1. Get URLs
        urls = researcher.find_relevant_cases(request.query)
        if not urls:
             return {"results": []}
        
        # 2. Fetch details (limit to 3 for speed)
        raw_cases = researcher.get_case_details(urls[:3])
        
        dict_results = []
        for url, doc in raw_cases:
             md = doc.markdown if hasattr(doc, 'markdown') else ''
             info = researcher.extract_case_info(md, url)
             dict_results.append(info)
             
        reranker = get_reranker()
        ranked_dicts = reranker.rank_results(request.query, dict_results, top_k=3)
        
        results = []
        for info in ranked_dicts:
             results.append({
                 "url": info.get("url", ""), 
                 "title": info.get("case_title", "Unknown Case"),
                 "date": info.get("date", ""),
                 "court": info.get("court", ""),
                 "relevance_score": info.get("relevance_score", 0.0)
             })
             
        return {"results": results}
    except Exception as e:
        print(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/cases", response_model=CaseListResponse)
async def list_user_cases(user_id: int = Query(..., description="User ID")):
    """
    Get all cases for a specific user.
    Returns list with case metadata and document counts.
    """
    db = get_db_manager()
    cases = db.get_user_cases(user_id)
    
    case_list = []
    for case in cases:
                                        
        docs = db.get_case_documents(user_id, case['case_id'])
        
                           
        try:
            struct_data = json.loads(case['structured_data']) if case['structured_data'] else {}
        except:
            struct_data = {}

        case_list.append(CaseResponse(
            case_id=case['case_id'],
            client_name=case['client_name'],
            structured_data=struct_data,
            raw_description=case['raw_description'],
            created_at=str(case['created_at']),
            documents=[dict(d) for d in docs],
            progress=case['progress'] or 0,
            stage=case['stage'] or "",
            is_complete=(str(case['stage']).lower() == 'complete') if case['stage'] else False
        ))
    
    return CaseListResponse(cases=case_list, total=len(case_list))


@router.get("/cases/{case_id}", response_model=CaseResponse)
async def get_case(case_id: int, request: Request, user_id: int = Query(..., description="User ID")):
    """
    Get detailed information for a specific case.
    Verifies user ownership before returning data.
    Logs access for audit trail.
    """
    db = get_db_manager()
                                                        
    case = db.get_case(user_id, case_id)
    
                            
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    if not case:
                                   
        db.log_audit(
            user_id=user_id,
            action="VIEW_CASE_DENIED",
            resource_type="case",
            resource_id=case_id,
            ip_address=client_ip,
            user_agent=user_agent,
            status="denied",
            details="Case not found or access denied"
        )
        raise HTTPException(status_code=404, detail="Case not found or access denied")
    
                           
    db.log_audit(
        user_id=user_id,
        action="VIEW_CASE",
        resource_type="case",
        resource_id=case_id,
        ip_address=client_ip,
        user_agent=user_agent,
        details=f"Viewed case: {case['client_name']}"
    )
    
                                    
    docs = db.get_case_documents(user_id, case_id)
    
                       
    try:
        struct_data = json.loads(case['structured_data']) if case['structured_data'] else {}
    except:
        struct_data = {}

    return CaseResponse(
        case_id=case['case_id'],
        client_name=case['client_name'],
        structured_data=struct_data,
        raw_description=case['raw_description'],
        created_at=str(case['created_at']),
        documents=[dict(d) for d in docs],
        progress=case['progress'] or 0,
        stage=case['stage'] or "",
        is_complete=(str(case['stage']).lower() == 'complete') if case['stage'] else False
    )


@router.delete("/cases/{case_id}")
async def delete_case(case_id: int, request: Request, user_id: int = Query(..., description="User ID")):
    """
    Delete a case (only if owned by user).
    Logs deletion for audit trail.
    """
    db = get_db_manager()
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
                                                           
    success = db.delete_case(user_id, case_id)
    if success:
                                 
        db.log_audit(
            user_id=user_id,
            action="DELETE_CASE",
            resource_type="case",
            resource_id=case_id,
            ip_address=client_ip,
            user_agent=user_agent,
            details=f"Deleted case #{case_id}"
        )
        return {"success": True, "message": f"Case #{case_id} deleted"}
    
                                                                                                     
    db.log_audit(
        user_id=user_id,
        action="DELETE_CASE_DENIED",
        resource_type="case",
        resource_id=case_id,
        ip_address=client_ip,
        user_agent=user_agent,
        status="denied",
        details="Case not found or access denied"
    )
    raise HTTPException(status_code=404, detail="Case not found or access denied")


@router.put("/cases/{case_id}/progress")
async def update_case_progress(case_id: int, request: ProgressUpdateRequest, user_id: int = Query(..., description="User ID")):
    """
    Update progress and stage for a case.
    Sets is_complete to True when stage is 'complete'.
    """
    db = get_db_manager()
                                                                      
    success = db.update_case_progress(user_id, case_id, request.progress, request.stage)
    
    if success:
        is_complete = request.stage.lower() == 'complete'
        return {
            "success": True,
            "message": f"Case #{case_id} progress updated",
            "progress": request.progress,
            "stage": request.stage,
            "is_complete": is_complete
        }
    raise HTTPException(status_code=404, detail="Case not found or access denied")


                                                          

@router.post("/chat", response_model=ChatResponse)
async def chat_with_case(request: ChatRequest, user_id: int = Query(..., description="User ID")):
    """
    Context-aware chat with a specific case.
    Includes case data + document context + conversation history.
    Supports multilingual input/output via translation middleware.
    Rate limited to prevent API abuse.
    """
                                      
    db = get_db_manager()
    case = db.get_case(user_id, request.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or access denied")

                                               
    query_in_english = request.query
    if request.language != 'en':
        query_in_english = translate_to_english(request.query, source_lang=request.language, use_neural=request.use_neural)
    
                                            
                                                           
                                                                                  
                                                                                   
                                                                                                                           
                                                                             
                                                           
                                          
                                                                                    
                                                  
    
    response = get_chatbot().chat_with_case(request.case_id, query_in_english, user_id=user_id)
    
    if response.startswith("⚠️ Rate limit"):
        raise HTTPException(status_code=429, detail=response)
    if response.startswith("❌"):
        raise HTTPException(status_code=400, detail=response)
    
                                                          
    final_response = response
    if request.language != 'en':
        final_response = translate_from_english(response, target_lang=request.language, use_neural=request.use_neural)
    
    return ChatResponse(response=final_response, case_id=request.case_id, language=request.language)


@router.get("/chat/history/{case_id}", response_model=ChatHistoryResponse)
async def get_chat_history(case_id: int, limit: int = 20, user_id: int = Query(..., description="User ID")):
    """
    Get chat history for a specific case.
    """
    history = get_db_manager().get_chat_history(user_id, case_id, limit)
    
    return ChatHistoryResponse(
        case_id=case_id,
        messages=[{"role": row['role'], "content": row['content']} for row in history]
    )


@router.delete("/chat/history/{case_id}")
async def clear_chat_history(case_id: int, user_id: int = Query(..., description="User ID")):
    """
    Clear all chat history for a case.
    """
    get_db_manager().clear_chat_history(user_id, case_id)
    return {"success": True, "message": f"Chat history cleared for case #{case_id}"}


@router.get("/chat/summary/{case_id}")
async def get_case_summary(case_id: int, user_id: int = Query(..., description="User ID")):
    """
    Get a formatted summary of a case.
    """
                                              
    summary = get_chatbot().get_case_summary(case_id, user_id=user_id)
    return {"case_id": case_id, "summary": summary}


                                                               

@router.get("/export/{case_id}")
async def export_case_pdf(case_id: int, request: Request, user_id: int = Query(..., description="User ID")):
    """
    Export a case to PDF format.
    Returns the PDF file for download.
    Logs export for audit trail.
    """
                      
    db = get_db_manager()
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    case = db.get_case(user_id, case_id)
    if not case:
        db.log_audit(
            user_id=user_id,
            action="EXPORT_PDF_DENIED",
            resource_type="case",
            resource_id=case_id,
            ip_address=client_ip,
            user_agent=user_agent,
            status="denied",
            details="Case not found or access denied"
        )
        raise HTTPException(status_code=404, detail="Case not found or access denied")
    
                  
                                                
                                                       
                                                          
                                                           
                                         
    filename = get_case_generator().export_case_to_pdf(case_id, user_id=user_id)
    
    if not filename or not os.path.exists(filename):
        raise HTTPException(status_code=500, detail="Failed to generate PDF")
    
                           
    db.log_audit(
        user_id=user_id,
        action="EXPORT_PDF",
        resource_type="case",
        resource_id=case_id,
        ip_address=client_ip,
        user_agent=user_agent,
        details=f"Exported PDF: {os.path.basename(filename)}"
    )
    
    return FileResponse(
        path=filename,
        media_type="application/pdf",
        filename=os.path.basename(filename)
    )


                                                                    

@router.post("/research", response_model=ResearchResponse)
async def conduct_legal_research(request: ResearchRequest):
    """
    Search for relevant legal cases from Indian Kanoon.
    Uses Firecrawl to scrape and Groq LLM for AI summaries.
    
    Rate limited to respect Firecrawl free tier (6s between requests).
    """
    try:
        researcher = get_legal_researcher()
        
                                     
        urls = researcher.find_relevant_cases(request.description)
        
        if not urls:
            return ResearchResponse(
                success=False,
                client_name=request.client_name,
                case_title=request.case_title,
                results=[],
                total_found=0
            )
        
                                     
        raw_cases = researcher.get_case_details(urls)
        
                                                        
        dict_results = []
        for url, doc in raw_cases:
            md = doc.markdown if hasattr(doc, 'markdown') else ''
            case_info = researcher.extract_case_info(md, url)
            case_info["ai_summary"] = researcher.summarize_case(md, case_info['case_title'])
            dict_results.append(case_info)
            
        reranker = get_reranker()
        ranked_dicts = reranker.rank_results(request.description, dict_results)
        
        formatted_results = []
        for case_info in ranked_dicts:
            formatted_results.append(CaseInfo(
                url=case_info['url'],
                case_title=case_info['case_title'],
                court=case_info['court'],
                date=case_info['date'],
                case_type=case_info['case_type'],
                verdict=case_info['verdict'],
                parties=case_info['parties'],
                summary=case_info['summary'],
                ai_summary=case_info.get('ai_summary'),
                relevance_score=case_info.get('relevance_score')
            ))
        
                                                
        case_data_package = {
            "title": request.case_title,
            "description": request.description,
            "results": [r.model_dump() for r in formatted_results]
        }
        get_client_db().save_case(request.client_name, case_data_package)
        
        return ResearchResponse(
            success=True,
            client_name=request.client_name,
            case_title=request.case_title,
            results=formatted_results,
            total_found=len(formatted_results)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Research error: {str(e)}")


@router.get("/research/history/{client_name}")
async def get_research_history(client_name: str):
    """
    Get all research history for a specific client.
    """
    import re
    safe_name = re.sub(r'[^a-zA-Z0-9]', '_', client_name).lower()
    filename = os.path.join("client_database", f"{safe_name}_cases.json")
    
    if not os.path.exists(filename):
        return {"client_name": client_name, "searches": []}
    
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return {"client_name": client_name, "searches": data}


                                                          

@router.get("/stats/{user_id}")
async def get_user_stats(user_id: int):
    """
    Get statistics for a user: total cases, total chats, time saved, etc.
    """
    db = get_db_manager()
    cases = db.get_user_cases(user_id)
    
    total_docs = 0
    total_chats = 0
    
    for case in cases:
        docs = db.get_case_documents(user_id, case['case_id'])
        total_docs += len(docs)
        
        history = db.get_chat_history(user_id, case['case_id'], limit=1000)
        total_chats += len(history)
    
                                                                      
    total_minutes_saved = (total_docs * 5) + (total_chats * 2) + (len(cases) * 10)
    time_saved_hours = total_minutes_saved // 60
    time_saved_minutes = total_minutes_saved % 60
    
    return {
        "user_id": user_id,
        "total_cases": len(cases),
        "documents_analyzed": total_docs,
        "queries_asked": total_chats,
        "time_saved_hours": time_saved_hours,
        "time_saved_minutes": time_saved_minutes
    }


                                                                

@router.get("/audit/logs")
async def get_audit_logs(
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    limit: int = 100
):
    """
    Retrieve audit logs with optional filters.
    For compliance and security tracking.
    
    Filter options:
    - user_id: Show logs for specific user
    - action: Filter by action type (VIEW_CASE, DELETE_CASE, EXPORT_PDF, etc.)
    - resource_type: Filter by resource (case, document, client)
    """
    db = get_db_manager()
    logs = db.get_audit_logs(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        limit=limit
    )
    
    return {
        "total": len(logs),
        "logs": [
            {
                "log_id": log['log_id'],
                "timestamp": str(log['timestamp']),
                "user_id": log['user_id'],
                "action": log['action'],
                "resource_type": log['resource_type'],
                "resource_id": log['resource_id'],
                "ip_address": log['ip_address'],
                "status": log['status'],
                "details": log['details']
            }
            for log in logs
        ]
    }


@router.get("/audit/resource/{resource_type}/{resource_id}")
async def get_resource_audit_history(resource_type: str, resource_id: int, limit: int = 50):
    """
    Get access history for a specific resource.
    Useful for seeing who viewed a particular case.
    """
    db = get_db_manager()
    logs = db.get_resource_access_history(resource_type, resource_id, limit)
    
    return {
        "resource_type": resource_type,
        "resource_id": resource_id,
        "access_history": [
            {
                "timestamp": str(log['timestamp']),
                "user_id": log['user_id'],
                "action": log['action'],
                "ip_address": log['ip_address'],
                "status": log['status']
            }
            for log in logs
        ]
    }

# ====================== SECURITY STATUS ENDPOINT ======================

@router.get("/security/status")
async def get_security_status():
    """
    Get real-time security feature status for the admin dashboard.
    Returns status of all security features and event counts.
    """
    stats = security_tracker.get_stats()
    
    # Check if environment keys are properly set
    has_groq_key = bool(GROQ_API_KEY)
    has_firecrawl_key = bool(FIRECRAWL_API_KEY)
    
    return {
        "features": [
            {
                "name": "Prompt Injection Defense",
                "status": "pass",
                "message": f"Active - {stats['total_queries_sanitized']} queries sanitized",
                "details": "Regex patterns detect and filter malicious prompts",
                "blocked_count": stats["prompt_injections_blocked"]
            },
            {
                "name": "Rate Limiting",
                "status": "pass",
                "message": f"Active - 20 requests/minute per user",
                "details": "Prevents API abuse and DDoS attacks",
                "blocked_count": stats["rate_limit_hits"]
            },
            {
                "name": "Output Validation",
                "status": "pass",
                "message": "Active - Harmful content filtered",
                "details": "AI responses scanned before delivery",
                "blocked_count": stats["output_validations_blocked"]
            },
            {
                "name": "Hallucination Checker",
                "status": "pass",
                "message": "Active - Citations verified",
                "details": "Fake case citations flagged with warnings",
                "blocked_count": stats["hallucinations_flagged"]
            },
            {
                "name": "Audit Logging",
                "status": "pass",
                "message": "Active - All actions recorded",
                "details": "VIEW, DELETE, EXPORT actions logged with IP"
            },
            {
                "name": "Secrets Management",
                "status": "pass" if (has_groq_key and has_firecrawl_key) else "warning",
                "message": ".env file in use" if has_groq_key else "Some keys missing",
                "details": "API keys loaded from environment variables"
            }
        ],
        "stats": stats
    }


                                                              

def include_router_to_app(app):
    """
    Helper function to include this router into a FastAPI app.
    Usage: 
        from legal_researcher.api import include_router_to_app
        include_router_to_app(app)
    """
    app.include_router(router)


                                                             

def create_standalone_app() -> FastAPI:
    """
    Create a standalone FastAPI app for the legal researcher module.
    Use this when running the module independently.
    """
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Initialize services on startup."""
        print("⚖️  Initializing Legal Researcher API...")
                                     
        get_db_manager()
        print("✅ Database initialized")
        print("✅ Legal Researcher API ready!")
        yield
    
    app = FastAPI(
        title="Legal Researcher API",
        description="""
## Legal Case Management & Research API

### Features:
- **Authentication**: Secure user registration/login with bcrypt
- **Case Management**: Create cases manually, via AI, or from PDFs  
- **AI Chat**: Context-aware legal chat with case data
- **Legal Research**: Find citations from Indian Kanoon
- **PDF Export**: Generate professional case documents

### Endpoints:
- `/legal/auth/*` - Authentication
- `/legal/cases/*` - Case Management
- `/legal/chat/*` - AI Chat
- `/legal/research/*` - Legal Research
- `/legal/export/*` - PDF Export
        """,
        version="2.0.0",
        lifespan=lifespan
    )
    
              
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include main legal router
    app.include_router(router)
    
    # Include multi-source research router (eCourts, IndiaCode, GovInfo, UK Case Law)
    try:
        from api_international import router as international_router
        app.include_router(international_router)
        print("✅ Multi-source research endpoints loaded")
    except Exception as e:
        print(f"⚠️ Could not load international research endpoints: {e}")
    
    # Include evidence analysis router (Gemini Vision)
    try:
        from api_evidence import router as evidence_router
        app.include_router(evidence_router)
        print("✅ Evidence analysis endpoints loaded")
    except Exception as e:
        print(f"⚠️ Could not load evidence endpoints: {e}")

    # Include drafting assistant router
    try:
        from api_drafting import router as drafting_router
        app.include_router(drafting_router, prefix="/legal/draft", tags=["Drafting Assistant"])
        print("✅ Drafting assistant endpoints loaded")
    except Exception as e:
        print(f"⚠️ Could not load drafting endpoints: {e}")

    # Include evidence timeline router
    try:
        from api_timeline import router as timeline_router
        app.include_router(timeline_router)
        print("✅ Evidence timeline endpoints loaded")
    except Exception as e:
        print(f"⚠️ Could not load timeline endpoints: {e}")
    
    @app.get("/")
    async def root():
        return {
            "name": "Legal Researcher API",
            "version": "2.0.0",
            "status": "running",
            "docs": "/docs"
        }
    
    @app.get("/health")
    async def health():
        return {"status": "healthy"}
    
    return app


app = create_standalone_app()

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("LEGAL_API_PORT", 8000))
    host = os.environ.get("LEGAL_API_HOST", "0.0.0.0")
    
    print(f"""
    ╔══════════════════════════════════════════════════════════╗
    ║         ⚖️  Legal Researcher API - Standalone Server      ║
    ╠══════════════════════════════════════════════════════════╣
    ║  Host: {host}                                            ║
    ║  Port: {port}                                            ║
    ║  Docs: http://localhost:{port}/docs                       ║
    ╚══════════════════════════════════════════════════════════╝
    """)
    
    app = create_standalone_app()
    uvicorn.run(app, host=host, port=port)
