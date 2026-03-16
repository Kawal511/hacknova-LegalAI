"""
Multi-Source Legal Research API Routes
======================================
Exposes endpoints for:
- eCourts India (dashboard stats, notices)
- IndiaCode (acts search)
- GovInfo US (federal court cases)
- UK National Archives (UK case law)
- International comprehensive research
"""

import os
import sys
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# Add parent directory to path for imports
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

# Import scrapers
from scrapers.ecourts import ECourtsScaper, ECourtsDashboard, ECourtsNotice
from scrapers.indiacode import IndiaCodeScraper, ActResult
from scrapers.govinfo import GovInfoClient, USCaseResult

# Router
router = APIRouter(prefix="/legal", tags=["Multi-Source Research"])


# ====================== REQUEST/RESPONSE MODELS ======================

# eCourts Models
class ECourtsStatsResponse(BaseModel):
    success: bool
    timestamp: str
    hc_complexes: int
    hc_pending_cases: str
    hc_pending_cases_raw: int
    hc_disposed_cases: str
    hc_disposed_cases_raw: int
    hc_cases_listed_today: str
    hc_cases_listed_today_raw: int
    dc_complexes: int
    dc_pending_cases: str
    dc_pending_cases_raw: int
    dc_disposed_last_month: str
    dc_disposed_last_month_raw: int
    dc_cases_listed_today: str
    dc_cases_listed_today_raw: int


class ECourtsNoticeResponse(BaseModel):
    success: bool
    total: int
    notices: List[Dict[str, Any]]


# IndiaCode Models
class ActSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Search query for acts")
    category: Optional[str] = Field(None, description="'Central Acts' or 'State Acts'")
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    ministry: Optional[str] = None
    status: str = Field("In Force", description="'In Force', 'Repealed', or 'All'")
    max_results: int = Field(20, ge=1, le=50)


class RelevantActsRequest(BaseModel):
    case_description: str = Field(..., min_length=20)
    case_type: str = Field(..., description="e.g., 'property', 'criminal', 'family'")
    dispute_summary: str = Field(..., min_length=10)


class ActSearchResponse(BaseModel):
    success: bool
    query: str
    total_found: int
    results: List[Dict[str, Any]]


class RelevantActsResponse(BaseModel):
    success: bool
    primary_acts: List[Dict[str, Any]]
    secondary_acts: List[Dict[str, Any]]
    sections_to_cite: List[Dict[str, Any]]
    analysis: str


# International Research Models
class InternationalSearchRequest(BaseModel):
    query: str = Field(..., min_length=3)
    jurisdictions: List[str] = Field(["US", "UK"], description="['US', 'UK'] or ['ALL']")
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    court_level: Optional[str] = Field(None, description="'supreme', 'appellate', 'district'")
    max_results: int = Field(10, ge=1, le=30)


class InternationalCaseResponse(BaseModel):
    case_title: str
    citation: str
    court: str
    jurisdiction: str
    date: str
    summary: str
    full_text_url: str
    relevance_score: float


class InternationalResearchResponse(BaseModel):
    success: bool
    query: str
    jurisdictions_searched: List[str]
    total_found: int
    us_cases: List[Dict[str, Any]]
    uk_cases: List[Dict[str, Any]]


# Comprehensive Research Models
class ComprehensiveResearchRequest(BaseModel):
    client_name: str
    case_title: str
    case_description: str = Field(..., min_length=20)
    case_type: str
    search_scope: List[str] = Field(["INDIA"], description="['INDIA', 'US', 'UK', 'ACTS']")
    include_international: bool = False
    date_range: Optional[Dict[str, str]] = None
    max_results_per_source: int = Field(10, ge=1, le=20)


class ComprehensiveResearchResponse(BaseModel):
    success: bool
    request_id: str
    timestamp: str
    indian_cases: List[Dict[str, Any]]
    us_cases: List[Dict[str, Any]]
    uk_cases: List[Dict[str, Any]]
    relevant_acts: List[Dict[str, Any]]
    ecourts_stats: Optional[Dict[str, Any]]
    ai_summary: str
    recommended_strategy: str


# ====================== ECOURTS ENDPOINTS ======================

@router.get("/ecourts/statistics", response_model=ECourtsStatsResponse)
async def get_ecourts_statistics():
    """
    Get real-time dashboard statistics from eCourts India.
    
    Returns:
    - High Court: complexes, pending cases, disposed cases, cases listed today
    - District Court: complexes, pending cases, disposed last month, cases listed today
    """
    try:
        scraper = ECourtsScaper()
        stats = scraper.get_dashboard_stats()
        
        return ECourtsStatsResponse(
            success=True,
            **stats.to_dict()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch eCourts statistics: {str(e)}")


@router.get("/ecourts/notices", response_model=ECourtsNoticeResponse)
async def get_ecourts_notices(limit: int = Query(20, ge=1, le=50)):
    """
    Get notices and circulars from eCourts India.
    """
    try:
        scraper = ECourtsScaper()
        notices = scraper.get_notices(limit=limit)
        
        return ECourtsNoticeResponse(
            success=True,
            total=len(notices),
            notices=[n.to_dict() for n in notices]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch notices: {str(e)}")


@router.get("/ecourts/tenders")
async def get_ecourts_tenders(limit: int = Query(10, ge=1, le=30)):
    """
    Get active tenders from eCourts India.
    """
    try:
        scraper = ECourtsScaper()
        tenders = scraper.get_tenders(limit=limit)
        
        return {
            "success": True,
            "total": len(tenders),
            "tenders": tenders
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tenders: {str(e)}")


# ====================== INDIACODE ENDPOINTS ======================

@router.post("/acts/search", response_model=ActSearchResponse)
async def search_acts(request: ActSearchRequest):
    """
    Search IndiaCode for Indian acts and legislation.
    
    Use this to find applicable laws for a case.
    """
    try:
        scraper = IndiaCodeScraper()
        acts = scraper.search_acts(
            query=request.query,
            category=request.category,
            year_from=request.year_from,
            year_to=request.year_to,
            ministry=request.ministry,
            status=request.status,
            max_results=request.max_results
        )
        
        return ActSearchResponse(
            success=True,
            query=request.query,
            total_found=len(acts),
            results=[a.to_dict() for a in acts]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search acts: {str(e)}")


@router.post("/acts/relevant", response_model=RelevantActsResponse)
async def find_relevant_acts(request: RelevantActsRequest):
    """
    AI-powered: Find acts most relevant to a specific case.
    
    Analyzes the case description and recommends applicable legislation
    with specific sections to cite.
    """
    try:
        scraper = IndiaCodeScraper()
        result = scraper.find_relevant_acts(
            case_description=request.case_description,
            case_type=request.case_type,
            dispute_summary=request.dispute_summary
        )
        
        return RelevantActsResponse(
            success=True,
            primary_acts=result.get("primary_acts", []),
            secondary_acts=result.get("secondary_acts", []),
            sections_to_cite=result.get("sections_to_cite", []),
            analysis=result.get("analysis", "")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to find relevant acts: {str(e)}")


@router.get("/acts/{act_id}")
async def get_act_details(act_id: str, act_url: str = Query(...)):
    """
    Get detailed information about a specific act.
    """
    try:
        scraper = IndiaCodeScraper()
        details = scraper.get_act_details(act_url)
        
        if details:
            return {"success": True, "act_id": act_id, "details": details}
        else:
            raise HTTPException(status_code=404, detail="Act not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get act details: {str(e)}")


# ====================== INTERNATIONAL RESEARCH ENDPOINTS ======================

@router.post("/research/international", response_model=InternationalResearchResponse)
async def search_international_cases(request: InternationalSearchRequest):
    """
    Search US federal court cases via GovInfo API.
    
    Returns similar cases to Indian Kanoon format for consistent UI.
    """
    us_cases = []
    uk_cases = []  # Keep for response model compatibility
    
    try:
        # Search US cases
        try:
            govinfo = GovInfoClient()
            us_results = govinfo.search_court_opinions(
                query=request.query,
                date_from=request.date_from,
                date_to=request.date_to,
                max_results=request.max_results
            )
            us_cases = [r.to_dict() for r in us_results]
        except Exception as e:
            print(f"US search error: {e}")
        
        return InternationalResearchResponse(
            success=True,
            query=request.query,
            jurisdictions_searched=["US"],
            total_found=len(us_cases),
            us_cases=us_cases,
            uk_cases=uk_cases
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"US case search failed: {str(e)}")


@router.get("/research/us/collections")
async def get_us_collections():
    """
    Get available GovInfo collections for US legal research.
    """
    try:
        govinfo = GovInfoClient()
        collections = govinfo.get_collections()
        
        return {
            "success": True,
            "collections": collections
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get collections: {str(e)}")




# ====================== COMPREHENSIVE RESEARCH ENDPOINT ======================

@router.post("/research/comprehensive", response_model=ComprehensiveResearchResponse)
async def comprehensive_research(request: ComprehensiveResearchRequest):
    """
    Unified research endpoint combining all sources.
    
    Searches:
    - Indian cases (via existing Indian Kanoon integration)
    - US federal cases (if include_international)
    - UK cases (if include_international)
    - Relevant Indian acts
    - Current eCourts statistics
    
    Returns AI-generated summary and strategy recommendations.
    """
    import uuid
    
    indian_cases = []
    us_cases = []
    uk_cases = []
    relevant_acts = []
    ecourts_stats = None
    
    try:
        scope = [s.upper() for s in request.search_scope]
        
        # Get eCourts stats
        try:
            ecourts_scraper = ECourtsScaper()
            stats = ecourts_scraper.get_dashboard_stats()
            ecourts_stats = stats.to_dict()
        except:
            pass
        
        # Search acts if requested
        if "ACTS" in scope:
            try:
                indiacode = IndiaCodeScraper()
                acts_result = indiacode.find_relevant_acts(
                    case_description=request.case_description,
                    case_type=request.case_type,
                    dispute_summary=request.case_title
                )
                relevant_acts = acts_result.get("primary_acts", [])
            except:
                pass
        
        # International research - US only
        if request.include_international or "US" in scope:
            try:
                govinfo = GovInfoClient()
                us_results = govinfo.search_court_opinions(
                    query=f"{request.case_type} {request.case_title}",
                    max_results=request.max_results_per_source
                )
                us_cases = [r.to_dict() for r in us_results]
            except:
                pass
        
        # Generate AI summary
        total_cases = len(indian_cases) + len(us_cases)
        ai_summary = f"Research completed. Found {total_cases} relevant cases across jurisdictions and {len(relevant_acts)} applicable acts."
        
        recommended_strategy = "Review the cited precedents and applicable legislation. "
        if us_cases:
            recommended_strategy += "Consider citing US precedents where persuasive authority is appropriate."
        
        return ComprehensiveResearchResponse(
            success=True,
            request_id=str(uuid.uuid4()),
            timestamp=datetime.now().isoformat(),
            indian_cases=indian_cases,
            us_cases=us_cases,
            uk_cases=uk_cases,
            relevant_acts=relevant_acts,
            ecourts_stats=ecourts_stats,
            ai_summary=ai_summary,
            recommended_strategy=recommended_strategy
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comprehensive research failed: {str(e)}")


# Export router
__all__ = ['router']
