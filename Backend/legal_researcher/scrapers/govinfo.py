"""
GovInfo API Client
==================
Connects to US Government Publishing Office API for federal court cases and legislation.
API Documentation: https://api.govinfo.gov/docs/

Features:
- Search federal court opinions
- Access Code of Federal Regulations (CFR)
- Congressional bills and laws
"""

import os
import time
import requests
from typing import Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass, asdict, field

# Rate limiting
RATE_LIMIT = int(os.getenv("SCRAPER_RATE_LIMIT_SECONDS", 2))


@dataclass
class USCaseResult:
    """US Federal Court case from GovInfo"""
    case_title: str
    docket_number: str
    court: str                          # "Supreme Court", "Court of Appeals", etc.
    circuit: Optional[str] = None       # "9th Circuit", etc.
    date: str = ""
    case_type: str = ""
    syllabus: str = ""
    holding: str = ""
    judges: List[str] = field(default_factory=list)
    pdf_url: str = ""
    html_url: str = ""
    citation: str = ""
    relevance_score: float = 0.0
    
    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class FederalLaw:
    """Federal law/regulation from GovInfo"""
    title: str
    cfr_title: Optional[str] = None     # CFR title number
    usc_title: Optional[str] = None     # USC title
    section: str = ""
    effective_date: str = ""
    summary: str = ""
    full_text_url: str = ""
    
    def to_dict(self) -> Dict:
        return asdict(self)


class GovInfoClient:
    """
    GovInfo API Client for US Federal Court Cases and Legislation
    
    Collections:
    - USCOURTS: Federal Court Opinions
    - CFR: Code of Federal Regulations
    - USCODE: United States Code
    - BILLS: Congressional Bills
    """
    
    BASE_URL = "https://api.govinfo.gov"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOVINFO_API_KEY")
        if not self.api_key:
            raise ValueError("GOVINFO_API_KEY is required")
        
        self.session = requests.Session()
        self.session.headers.update({
            "X-Api-Key": self.api_key,
            "Accept": "application/json"
        })
    
    def search_court_opinions(
        self,
        query: str,
        court: Optional[str] = None,        # "supremecourt", "appellate", "district"
        date_from: Optional[str] = None,    # "2020-01-01"
        date_to: Optional[str] = None,
        max_results: int = 10
    ) -> List[USCaseResult]:
        """
        Search USCOURTS collection for federal court opinions.
        """
        cases = []
        
        try:
            # Build search parameters
            params = {
                "query": query,
                "pageSize": min(max_results, 100),
                "offsetMark": "*",
                "collection": "USCOURTS"
            }
            
            if date_from:
                params["publishDateStartDate"] = date_from
            if date_to:
                params["publishDateEndDate"] = date_to
            
            # Make API request
            response = self.session.get(
                f"{self.BASE_URL}/search",
                params=params,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            results = data.get("results", [])
            
            for idx, item in enumerate(results[:max_results]):
                # Parse court from packageId
                package_id = item.get("packageId", "")
                parsed_court = self._parse_court(package_id)
                
                cases.append(USCaseResult(
                    case_title=item.get("title", "Unknown Case"),
                    docket_number=item.get("docNumber", ""),
                    court=parsed_court.get("court", "Federal Court"),
                    circuit=parsed_court.get("circuit"),
                    date=item.get("publishDate", "")[:10] if item.get("publishDate") else "",
                    case_type=item.get("category", ""),
                    syllabus=item.get("description", "")[:500],
                    pdf_url=item.get("pdfLink", ""),
                    html_url=item.get("htmlLink", ""),
                    relevance_score=1.0 - (idx * 0.05)
                ))
            
            time.sleep(RATE_LIMIT)
            
        except requests.exceptions.HTTPError as e:
            print(f"GovInfo API HTTP error: {e}")
        except Exception as e:
            print(f"Error searching GovInfo: {e}")
        
        return cases
    
    def _parse_court(self, package_id: str) -> Dict:
        """Parse court information from GovInfo package ID"""
        court_info = {"court": "Federal Court", "circuit": None}
        
        package_id_lower = package_id.lower()
        
        if "scotus" in package_id_lower or "supremecourt" in package_id_lower:
            court_info["court"] = "US Supreme Court"
        elif "ca" in package_id_lower:
            # Court of Appeals
            circuit_match = package_id_lower.split("-")
            for part in circuit_match:
                if part.startswith("ca") and len(part) <= 4:
                    circuit_num = part[2:]
                    if circuit_num.isdigit():
                        court_info["court"] = "US Court of Appeals"
                        court_info["circuit"] = f"{circuit_num}th Circuit"
        elif "district" in package_id_lower:
            court_info["court"] = "US District Court"
        
        return court_info
    
    def get_case_details(self, package_id: str) -> Optional[Dict]:
        """
        Get detailed information about a specific case.
        """
        try:
            response = self.session.get(
                f"{self.BASE_URL}/packages/{package_id}/summary",
                timeout=30
            )
            response.raise_for_status()
            
            time.sleep(RATE_LIMIT)
            return response.json()
            
        except Exception as e:
            print(f"Error getting case details: {e}")
        
        return None
    
    def search_cfr(
        self,
        query: str,
        title: Optional[int] = None,        # CFR Title number (1-50)
        max_results: int = 10
    ) -> List[FederalLaw]:
        """
        Search Code of Federal Regulations.
        """
        laws = []
        
        try:
            params = {
                "query": query,
                "pageSize": min(max_results, 100),
                "collection": "CFR"
            }
            
            if title:
                params["cfrTitle"] = str(title)
            
            response = self.session.get(
                f"{self.BASE_URL}/search",
                params=params,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            results = data.get("results", [])
            
            for item in results[:max_results]:
                laws.append(FederalLaw(
                    title=item.get("title", ""),
                    cfr_title=item.get("cfrTitle"),
                    section=item.get("granuleId", ""),
                    effective_date=item.get("publishDate", "")[:10] if item.get("publishDate") else "",
                    summary=item.get("description", "")[:300],
                    full_text_url=item.get("htmlLink", "") or item.get("pdfLink", "")
                ))
            
            time.sleep(RATE_LIMIT)
            
        except Exception as e:
            print(f"Error searching CFR: {e}")
        
        return laws
    
    def search_us_code(
        self,
        query: str,
        title: Optional[int] = None,        # USC Title number
        max_results: int = 10
    ) -> List[FederalLaw]:
        """
        Search United States Code.
        """
        laws = []
        
        try:
            params = {
                "query": query,
                "pageSize": min(max_results, 100),
                "collection": "USCODE"
            }
            
            if title:
                params["uscTitle"] = str(title)
            
            response = self.session.get(
                f"{self.BASE_URL}/search",
                params=params,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            results = data.get("results", [])
            
            for item in results[:max_results]:
                laws.append(FederalLaw(
                    title=item.get("title", ""),
                    usc_title=item.get("uscTitle"),
                    section=item.get("granuleId", ""),
                    summary=item.get("description", "")[:300],
                    full_text_url=item.get("htmlLink", "") or item.get("pdfLink", "")
                ))
            
            time.sleep(RATE_LIMIT)
            
        except Exception as e:
            print(f"Error searching US Code: {e}")
        
        return laws
    
    def get_collections(self) -> List[str]:
        """Get list of available collections"""
        try:
            response = self.session.get(
                f"{self.BASE_URL}/collections",
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            return [c.get("collectionCode") for c in data.get("collections", [])]
            
        except Exception as e:
            print(f"Error getting collections: {e}")
        
        return []


# Export
__all__ = ['GovInfoClient', 'USCaseResult', 'FederalLaw']
