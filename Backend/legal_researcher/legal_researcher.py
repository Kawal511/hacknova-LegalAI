from dotenv import load_dotenv
import os
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
"""
This module manages autonomous legal research. It utilizes the Firecrawl API to search authoritative legal sources, scrape relevant case law, and generate summaries for the user.
"""

import os
import json
import time
import re
from urllib.parse import quote_plus
from datetime import datetime
try:
    from firecrawl import FirecrawlApp as Firecrawl  # v1.0+ uses FirecrawlApp
except ImportError:
    try:
        from firecrawl import Firecrawl  # Fallback for older versions
    except ImportError:
        Firecrawl = None  # Will fail gracefully if Firecrawl not installed
from langchain_groq import ChatGroq

                       
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")                
DB_DIRECTORY = "client_database"                                          

                                        
class ClientDB:
    def __init__(self, db_dir):
        self.db_dir = db_dir
        if not os.path.exists(self.db_dir):
            os.makedirs(self.db_dir)

    def save_case(self, client_name, case_data):
        """
        Saves case data into a separate JSON file for each client.
        Acts like a NoSQL document store.
        """
                           
        safe_name = re.sub(r'[^a-zA-Z0-9]', '_', client_name).lower()
        filename = os.path.join(self.db_dir, f"{safe_name}_cases.json")
        
                                           
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                try:
                    current_data = json.load(f)
                except json.JSONDecodeError:
                    current_data = []
        else:
            current_data = []

                                        
                                                      
        search_session = {
            "search_id": f"search_{int(time.time())}",
            "timestamp": datetime.now().isoformat(),
            "client_input": {
                "title": case_data['title'],
                "description": case_data['description']
            },
            "citations_found": case_data['results']
        }
        
        current_data.append(search_session)

                           
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(current_data, f, indent=4, ensure_ascii=False)
        
        print(f"✅ Data saved to: {filename}")

                                            
class LegalResearcher:
    def __init__(self, firecrawl_key, groq_key):
        # Handle case where Firecrawl is not installed
        if Firecrawl is None:
            print("⚠️ Firecrawl not installed - legal research will be limited")
            self.app = None
        else:
            self.app = Firecrawl(api_key=firecrawl_key)
        self.last_request_time = 0
                                                                                        
        self.min_interval = 6 
        
                                                  
        self.llm = ChatGroq(
            api_key=groq_key,
            model_name="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=300
        )

    def _wait_for_rate_limit(self):
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval:
            wait_time = self.min_interval - elapsed
            print(f"⏳ Rate Limit Safety: Waiting {wait_time:.1f} seconds...")
            time.sleep(wait_time)
        self.last_request_time = time.time()
    
    def summarize_case(self, markdown: str, case_title: str) -> str:
        """
        Use Groq LLM to generate a concise 2-3 sentence summary of the case.
        """
        if not markdown or len(markdown) < 100:
            return "Insufficient content for summary."
        
                                                        
        content = markdown[:4000]
        
        prompt = f"""Summarize this Indian legal case in exactly 2-3 sentences. Focus on:
1. What was the dispute about
2. What did the court decide

Case Title: {case_title}

Case Content:
{content}

Summary:"""
        
        try:
            response = self.llm.invoke(prompt)
            return response.content.strip()
        except Exception as e:
            print(f"⚠️ Summary generation failed: {e}")
                                         
            clean = re.sub(r'\[.*?\]|\(.*?\)|#|\\n', ' ', markdown)
            clean = re.sub(r'\s+', ' ', clean).strip()
            return clean[:300] + "..."

    def find_relevant_cases(self, description):
        """
        Step 1: Search for cases based on the user's description.
        """
        # Check if Firecrawl is available
        if self.app is None:
            print("⚠️ Firecrawl not available - cannot search cases")
            return []
        
        raw_description = (description or "").strip()
        if not raw_description:
            return []

        compact = re.sub(r"\s+", " ", raw_description)
        compact = compact[:220]
        queries = [
            f'{compact} site:indiankanoon.org/doc',
            f'{compact} "judgment" "India"',
            f'{compact} "motor accident" OR "criminal" OR "writ" site:indiankanoon.org',
        ]

        all_doc_ids = []
        seen_doc_ids = set()

        for idx, query in enumerate(queries):
            self._wait_for_rate_limit()
            print(f"🔍 Searching variant {idx + 1}/{len(queries)}: {query}...")

            try:
                kanoon_search_url = f"https://indiankanoon.org/search/?formInput={quote_plus(query)}"
                response = self.app.scrape(kanoon_search_url, formats=['markdown'])
                markdown = response.markdown or ''

                # Firecrawl output varies; support absolute, relative, and query-param links.
                doc_ids = []
                doc_ids.extend(re.findall(r'indiankanoon\.org/doc/(\d+)', markdown))
                doc_ids.extend(re.findall(r'www\.indiankanoon\.org/doc/(\d+)', markdown))
                doc_ids.extend(re.findall(r'\b/doc/(\d+)/', markdown))
                doc_ids.extend(re.findall(r'docid=(\d+)', markdown))

                for doc_id in doc_ids:
                    if doc_id not in seen_doc_ids:
                        seen_doc_ids.add(doc_id)
                        all_doc_ids.append(doc_id)

                if len(all_doc_ids) >= 5:
                    break

            except Exception as e:
                print(f"⚠️ Search variant {idx + 1} failed: {e}")

        full_urls = [f"https://indiankanoon.org/doc/{doc_id}/" for doc_id in all_doc_ids[:5]]
        print(f"🔎 Found {len(full_urls)} potential citations.")
        return full_urls

    def get_case_details(self, urls):
        """
        Step 2: Scrape case texts individually (simpler than batch for credit control).
        """
        if not urls:
            return []
        
        # Check if Firecrawl is available
        if self.app is None:
            print("⚠️ Firecrawl not available - cannot fetch case details")
            return []
        
        results = []
        for i, url in enumerate(urls):
            self._wait_for_rate_limit()
            print(f"🚀 Retrieving case {i+1}/{len(urls)}: {url[:50]}...")
            
            try:
                doc = self.app.scrape(url, formats=['markdown'], only_main_content=True)
                results.append((url, doc))
            except Exception as e:
                print(f"⚠️ Failed to scrape {url}: {e}")
        
        return results
    
    def extract_case_info(self, markdown: str, url: str) -> dict:
        """
        Extract structured information from case markdown:
        - Case title, court, date
        - Verdict/disposition
        - Case type (Civil, Criminal, Writ, etc.)
        - Key parties
        """
        info = {
            "url": url,
            "case_title": "Unknown",
            "court": "Unknown",
            "date": "Unknown",
            "case_type": "Unknown",
            "verdict": "Not determined",
            "parties": {
                "petitioner": "Unknown",
                "respondent": "Unknown"
            },
            "summary": ""
        }
        
        if not markdown:
            return info
        
        lines = markdown.split('\n')
        text_lower = markdown.lower()
        
                                          
        for line in lines[:20]:
            if line.strip().startswith('#') and 'vs' in line.lower():
                info["case_title"] = line.strip('#').strip()
                break
            elif 'vs' in line.lower() and len(line) < 200:
                info["case_title"] = line.strip()
                break
        
                       
        court_patterns = [
            (r'Supreme Court', 'Supreme Court of India'),
            (r'High Court', 'High Court'),
            (r'District Court', 'District Court'),
            (r'Sessions Court', 'Sessions Court'),
            (r'Tribunal', 'Tribunal')
        ]
        for pattern, court_name in court_patterns:
            if re.search(pattern, markdown, re.IGNORECASE):
                info["court"] = court_name
                break
        
                      
        date_match = re.search(r'on\s+(\d{1,2}\s+\w+,?\s+\d{4})', markdown)
        if date_match:
            info["date"] = date_match.group(1)
        
                             
        if 'criminal appeal' in text_lower or 'fir no' in text_lower:
            info["case_type"] = "Criminal"
        elif 'civil appeal' in text_lower or 'suit no' in text_lower:
            info["case_type"] = "Civil"
        elif 'writ petition' in text_lower:
            info["case_type"] = "Writ Petition"
        elif 'slp' in text_lower or 'special leave' in text_lower:
            info["case_type"] = "Special Leave Petition"
        elif 'review petition' in text_lower:
            info["case_type"] = "Review Petition"
        elif 'arbitration' in text_lower:
            info["case_type"] = "Arbitration"
        
                                              
        last_section = markdown[-3000:] if len(markdown) > 3000 else markdown
        last_lower = last_section.lower()
        
        verdict_keywords = [
            ('appeal is allowed', 'Appeal Allowed'),
            ('appeal allowed', 'Appeal Allowed'),
            ('appeals are allowed', 'Appeals Allowed'),
            ('appeal is dismissed', 'Appeal Dismissed'),
            ('appeal dismissed', 'Appeal Dismissed'),
            ('appeals are dismissed', 'Appeals Dismissed'),
            ('petition is allowed', 'Petition Allowed'),
            ('petition allowed', 'Petition Allowed'),
            ('petition is dismissed', 'Petition Dismissed'),
            ('petition dismissed', 'Petition Dismissed'),
            ('conviction is set aside', 'Conviction Set Aside'),
            ('acquitted', 'Accused Acquitted'),
            ('convicted', 'Accused Convicted'),
            ('disposed of', 'Disposed'),
            ('case is closed', 'Case Closed'),
            ('quashed', 'Order Quashed')
        ]
        
        for keyword, verdict in verdict_keywords:
            if keyword in last_lower:
                info["verdict"] = verdict
                break
        
                         
        parties_match = re.search(r'(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\n|on\s+\d)', markdown[:1000], re.IGNORECASE)
        if parties_match:
            info["parties"]["petitioner"] = parties_match.group(1).strip()[:100]
            info["parties"]["respondent"] = parties_match.group(2).strip()[:100]
        
                                             
        clean_text = re.sub(r'\[.*?\]|\(.*?\)|#|\\n', ' ', markdown)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        info["summary"] = clean_text[:500] + "..." if len(clean_text) > 500 else clean_text
        
        return info

                        
def main():
    print("=== ⚖️ AI Legal Researcher (Firecrawl Powered) ===")
    
                    
    client_name = input("Enter Client Name: ").strip()
    case_title = input("Enter Case/Dispute Title: ").strip()
    print("\nDescribe the facts (e.g., 'Father died intestate in 2004, daughter claiming share'):")
    description = input("> ").strip()

                          
    db = ClientDB(DB_DIRECTORY)
    researcher = LegalResearcher(FIRECRAWL_API_KEY, GROQ_API_KEY)

                   
    print("\n--- Starting Research Phase ---")
    urls = researcher.find_relevant_cases(description)

    if urls:
                           
        raw_cases = researcher.get_case_details(urls)
        
                                                   
        formatted_results = []
        for url, doc in raw_cases:
            md = doc.markdown if hasattr(doc, 'markdown') else ''
            case_info = researcher.extract_case_info(md, url)
            
                                 
            print(f"🧠 Generating AI summary...")
            case_info["ai_summary"] = researcher.summarize_case(md, case_info['case_title'])
            
            formatted_results.append(case_info)
            
                                  
            print(f"\n📋 {case_info['case_title']}")
            print(f"   Court: {case_info['court']} | Date: {case_info['date']}")
            print(f"   Type: {case_info['case_type']} | Verdict: {case_info['verdict']}")
            print(f"   📝 Summary: {case_info['ai_summary'][:150]}...")

                       
        case_data_package = {
            "title": case_title,
            "description": description,
            "results": formatted_results
        }
        db.save_case(client_name, case_data_package)
        
        print("\n=== ✨ Research Complete ===")
        print(f"Found and saved {len(formatted_results)} citations for client '{client_name}'.")
    else:
        print("\n❌ No relevant cases found. Try refining your description.")

if __name__ == "__main__":
    main()
