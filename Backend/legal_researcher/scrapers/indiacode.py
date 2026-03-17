from dotenv import load_dotenv
import os
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
"""
IndiaCode Scraper
=================
Scrapes acts and legislation from https://www.indiacode.nic.in

Features:
- Search acts by keyword
- Get act details and sections
- Find relevant acts for a case
"""

import os
import re
import time
import requests
from typing import Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass, asdict, field

# Rate limiting
RATE_LIMIT = int(os.getenv("SCRAPER_RATE_LIMIT_SECONDS", 2))


@dataclass
class ActResult:
    """Result from IndiaCode acts search"""
    act_id: str
    title: str                          # "Transfer of Property Act, 1882"
    short_title: str                    # "TPA 1882"
    year: int
    act_number: str                     # "Act No. 4 of 1882"
    category: str                       # "Central Act" / "State Act"
    ministry: str
    status: str                         # "In Force" / "Repealed"
    last_amended: Optional[str] = None
    enforcement_date: Optional[str] = None
    preamble: str = ""
    sections_count: int = 0
    key_sections: List[str] = field(default_factory=list)
    related_acts: List[str] = field(default_factory=list)
    full_text_url: str = ""
    relevance_score: float = 0.0
    
    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass 
class ActSection:
    """A section within an act"""
    section_number: str
    title: str
    content: str
    subsections: List[Dict] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return asdict(self)


class IndiaCodeScraper:
    """Scraper for IndiaCode website - Indian Acts and Legislation"""
    
    BASE_URL = "https://www.indiacode.nic.in"
    SEARCH_URL = f"{BASE_URL}/handle/123456789/1362/simple-search"
    
    def __init__(self, firecrawl_api_key: Optional[str] = None, groq_api_key: Optional[str] = None):
        self.firecrawl_api_key = firecrawl_api_key or os.getenv("FIRECRAWL_API_KEY")
        self.groq_api_key = groq_api_key or os.getenv("GROQ_API_KEY")
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 NyayaZephyr Legal Research Bot",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        })
    
    def search_acts(
        self,
        query: str,
        category: Optional[str] = None,      # "Central Acts", "State Acts"
        year_from: Optional[int] = None,
        year_to: Optional[int] = None,
        ministry: Optional[str] = None,
        status: str = "In Force",           # "In Force", "Repealed", "All"
        max_results: int = 20
    ) -> List[ActResult]:
        """
        Search IndiaCode for acts matching the query.
        """
        acts = []
        
        try:
            if self.firecrawl_api_key:
                from firecrawl import FirecrawlApp
                
                app = FirecrawlApp(api_key=self.firecrawl_api_key)
                
                # Construct search URL
                search_url = f"{self.BASE_URL}/search?query={query.replace(' ', '+')}"
                
                result = app.scrape(
                    search_url,
                    params={
                        'formats': ['extract'],
                        'extract': {
                            'schema': {
                                'type': 'object',
                                'properties': {
                                    'acts': {
                                        'type': 'array',
                                        'items': {
                                            'type': 'object',
                                            'properties': {
                                                'title': {'type': 'string'},
                                                'year': {'type': 'integer'},
                                                'act_number': {'type': 'string'},
                                                'category': {'type': 'string'},
                                                'ministry': {'type': 'string'},
                                                'status': {'type': 'string'},
                                                'url': {'type': 'string'}
                                            }
                                        }
                                    }
                                }
                            },
                            'prompt': f"""
                            Search for Indian acts related to: "{query}"
                            
                            For each act found, extract:
                            - title: Full act name (e.g., "Transfer of Property Act, 1882")
                            - year: Year of enactment
                            - act_number: Act number (e.g., "Act No. 4 of 1882")
                            - category: "Central Act" or "State Act"
                            - ministry: Responsible ministry
                            - status: "In Force" or "Repealed"
                            - url: Direct link to the act
                            
                            Return maximum {max_results} acts most relevant to the query.
                            Filter by status: {status}
                            """
                        }
                    }
                )
                
                data = result.get('extract', {})
                acts_data = data.get('acts', []) if isinstance(data, dict) else []
                
                for idx, item in enumerate(acts_data[:max_results]):
                    # Generate short title
                    title = item.get('title', '')
                    year = item.get('year', 0)
                    short_title = self._generate_short_title(title, year)
                    
                    acts.append(ActResult(
                        act_id=f"act_{idx}_{year}",
                        title=title,
                        short_title=short_title,
                        year=year,
                        act_number=item.get('act_number', ''),
                        category=item.get('category', 'Central Act'),
                        ministry=item.get('ministry', ''),
                        status=item.get('status', 'In Force'),
                        full_text_url=item.get('url', ''),
                        relevance_score=1.0 - (idx * 0.05)  # Decreasing relevance
                    ))
                
                time.sleep(RATE_LIMIT)
                
        except Exception as e:
            print(f"Error searching IndiaCode: {e}")
            # Return common acts as fallback based on query
            acts = self._get_common_acts_fallback(query)
        
        return acts
    
    def _generate_short_title(self, title: str, year: int) -> str:
        """Generate abbreviated title like 'IPC 1860', 'TPA 1882'"""
        # Extract initials from major words
        words = re.findall(r'\b[A-Z][a-z]+\b', title)
        if len(words) >= 2:
            initials = ''.join([w[0].upper() for w in words[:3] if w.lower() not in ['act', 'of', 'the', 'and']])
            return f"{initials} {year}"
        return f"{title[:20]} {year}"
    
    def get_act_details(self, act_url: str) -> Optional[Dict]:
        """
        Get complete details of an act including sections.
        """
        try:
            if self.firecrawl_api_key:
                from firecrawl import FirecrawlApp
                
                app = FirecrawlApp(api_key=self.firecrawl_api_key)
                
                result = app.scrape(
                    act_url,
                    params={
                        'formats': ['extract', 'markdown'],
                        'extract': {
                            'prompt': """
                            Extract complete act details:
                            
                            1. preamble: The preamble or long title
                            2. enforcement_date: Date of enforcement
                            3. last_amended: Last amendment year
                            4. total_sections: Number of sections
                            5. chapters: List of chapter titles
                            6. key_definitions: Important definitions from Section 2
                            7. important_sections: List of most important/cited sections with titles
                            8. amendments: List of amendment acts
                            9. related_acts: Related legislation
                            
                            Return as structured JSON.
                            """
                        }
                    }
                )
                
                time.sleep(RATE_LIMIT)
                return result.get('extract', {})
                
        except Exception as e:
            print(f"Error getting act details: {e}")
        
        return None
    
    def find_relevant_acts(
        self,
        case_description: str,
        case_type: str,
        dispute_summary: str
    ) -> Dict:
        """
        AI-powered: Find acts most relevant to a specific case.
        Uses Groq LLM to analyze case and recommend applicable laws.
        """
        if not self.groq_api_key:
            return {"primary_acts": [], "secondary_acts": [], "analysis": "Groq API key required"}
        
        try:
            from langchain_groq import ChatGroq
            
            llm = ChatGroq(
                api_key=self.groq_api_key,
                model_name="llama-3.3-70b-versatile",
                temperature=0.1
            )
            
            prompt = f"""
            As an expert Indian legal researcher, analyze this case and identify applicable laws:
            
            CASE DESCRIPTION:
            {case_description}
            
            CASE TYPE: {case_type}
            
            DISPUTE SUMMARY:
            {dispute_summary}
            
            Identify:
            1. PRIMARY ACTS: Main legislation directly applicable (with specific sections)
            2. SECONDARY ACTS: Supporting legislation that may be relevant
            3. SPECIFIC SECTIONS: Key sections to cite with brief explanation
            4. ANALYSIS: Brief explanation of how these laws apply
            
            Format your response as JSON:
            {{
                "primary_acts": [
                    {{"title": "Act Title", "year": 1882, "key_sections": ["Section 5", "Section 54"], "reason": "explanation"}}
                ],
                "secondary_acts": [
                    {{"title": "Act Title", "year": 1908, "reason": "explanation"}}
                ],
                "sections_to_cite": [
                    {{"act": "Act Title", "section": "Section 54", "title": "Section Title", "reason": "explanation"}}
                ],
                "analysis": "How these acts apply to the case"
            }}
            """
            
            response = llm.invoke(prompt)
            
            # Parse JSON from response
            import json
            content = response.content
            
            # Extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                return json.loads(json_match.group())
            
        except Exception as e:
            print(f"Error in AI act analysis: {e}")
        
        return {
            "primary_acts": [],
            "secondary_acts": [],
            "sections_to_cite": [],
            "analysis": "Could not analyze case for applicable laws"
        }
    
    def _get_common_acts_fallback(self, query: str) -> List[ActResult]:
        """Return common acts based on keywords as fallback"""
        common_acts = {
            "property": [
                ActResult(
                    act_id="tpa_1882",
                    title="Transfer of Property Act, 1882",
                    short_title="TPA 1882",
                    year=1882,
                    act_number="Act No. 4 of 1882",
                    category="Central Act",
                    ministry="Ministry of Law and Justice",
                    status="In Force",
                    full_text_url="https://www.indiacode.nic.in/handle/123456789/2338",
                    relevance_score=0.95
                ),
                ActResult(
                    act_id="ra_1908",
                    title="Registration Act, 1908",
                    short_title="RA 1908",
                    year=1908,
                    act_number="Act No. 16 of 1908",
                    category="Central Act",
                    ministry="Ministry of Law and Justice",
                    status="In Force",
                    relevance_score=0.85
                )
            ],
            "criminal": [
                ActResult(
                    act_id="bns_2023",
                    title="Bharatiya Nyaya Sanhita, 2023",
                    short_title="BNS 2023",
                    year=2023,
                    act_number="Act No. 45 of 2023",
                    category="Central Act",
                    ministry="Ministry of Home Affairs",
                    status="In Force",
                    relevance_score=0.95
                ),
                ActResult(
                    act_id="bnss_2023",
                    title="Bharatiya Nagarik Suraksha Sanhita, 2023",
                    short_title="BNSS 2023",
                    year=2023,
                    act_number="Act No. 46 of 2023",
                    category="Central Act",
                    ministry="Ministry of Home Affairs",
                    status="In Force",
                    relevance_score=0.90
                )
            ],
            "contract": [
                ActResult(
                    act_id="ica_1872",
                    title="Indian Contract Act, 1872",
                    short_title="ICA 1872",
                    year=1872,
                    act_number="Act No. 9 of 1872",
                    category="Central Act",
                    ministry="Ministry of Law and Justice",
                    status="In Force",
                    relevance_score=0.95
                )
            ],
            "family": [
                ActResult(
                    act_id="hma_1955",
                    title="Hindu Marriage Act, 1955",
                    short_title="HMA 1955",
                    year=1955,
                    act_number="Act No. 25 of 1955",
                    category="Central Act",
                    ministry="Ministry of Law and Justice",
                    status="In Force",
                    relevance_score=0.90
                ),
                ActResult(
                    act_id="hsa_1956",
                    title="Hindu Succession Act, 1956",
                    short_title="HSA 1956",
                    year=1956,
                    act_number="Act No. 30 of 1956",
                    category="Central Act",
                    ministry="Ministry of Law and Justice",
                    status="In Force",
                    relevance_score=0.85
                )
            ]
        }
        
        # Match query keywords to return relevant acts
        query_lower = query.lower()
        for key, acts in common_acts.items():
            if key in query_lower:
                return acts
        
        # Return general acts if no match
        return [
            ActResult(
                act_id="cpc_1908",
                title="Code of Civil Procedure, 1908",
                short_title="CPC 1908",
                year=1908,
                act_number="Act No. 5 of 1908",
                category="Central Act",
                ministry="Ministry of Law and Justice",
                status="In Force",
                relevance_score=0.70
            )
        ]


# Export
__all__ = ['IndiaCodeScraper', 'ActResult', 'ActSection']
