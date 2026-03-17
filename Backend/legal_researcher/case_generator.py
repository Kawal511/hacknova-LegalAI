from dotenv import load_dotenv
import os
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
"""
This module allows for AI-powered Case Generation. It extracts structured legal data (parties, evidence, issues) from raw text/PDFs using LLMs and also handles PDF export functionality.
"""

import json
import os
from groq import Groq
from fpdf import FPDF
from database_manager import DatabaseManager

                                             
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found in environment. Please set it in .env file.")

class CaseGenerator:
    def __init__(self, api_key: str = None):
        self.client = Groq(api_key=api_key or GROQ_API_KEY)
        self.db = DatabaseManager()

    def generate_case_structure(self, raw_text: str) -> dict:
        """
        Sends raw text to Groq and asks for a STRICT JSON output.
        Minimizes tokens by asking for specific fields only.
        """
        prompt = f"""
        Analyze the following legal document or intake notes thoroughly. 
        Extract key details into a strictly formatted JSON object. 
        
        Fields required MUST include: 
        - "client_name": The name of the client or primary party.
        - "opposing_party": The opposing party, if any.
        - "incident_date": The date(s) of key incidents.
        - "legal_issue_summary": A concise 2-sentence summary of the core legal issue.
        - "detailed_summary": A very detailed summary of exactly 70-100 words outlining the core arguments, facts, and conclusions of the document continuously.
        - "key_evidence_list": Array of strings of evidence mentioned.
        - "applicable_laws": Array of strings of mentioned or highly relevant laws.
        - "recommended_actions": Array of strings for next steps.

        Intake Notes:
        {raw_text}

        Respond ONLY with the JSON object. Do not include markdown formatting or extra text.

        """

        try:
            completion = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a legal data extractor. Output JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,                                   
                response_format={"type": "json_object"}
            )
            
                              
            structured_data = json.loads(completion.choices[0].message.content)
            return structured_data
            
        except Exception as e:
            print(f"❌ Error generating case: {e}")
            return None

    def export_case_to_pdf(self, case_id: int, user_id: int = None) -> str:
        """Generates a PDF summary of the case. Returns filename."""
        if user_id is None:
             print("❌ Error: user_id required for multi-tenant access")
             return None

                          
        case = self.db.get_case(user_id, case_id)
        if not case:
            print("❌ Case not found or access denied.")
            return None

        try:
            data = json.loads(case['structured_data'])
        except:
            data = {}
        
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        
                
        pdf.set_font("Arial", 'B', 16)
        pdf.cell(200, 10, txt=f"Client Case File: #{case['case_id']}", ln=1, align='C')
        
        pdf.set_font("Arial", size=10)
        pdf.cell(200, 10, txt=f"Created: {case['created_at']}", ln=1, align='C')
        
        pdf.ln(10)
        
                     
        for key, value in data.items():
            formatted_key = key.replace("_", " ").title()
            
                                               
            if isinstance(value, list):
                value = "\n  - " + "\n  - ".join(str(v) for v in value)
            
            pdf.set_font("Arial", 'B', 12)
            pdf.cell(60, 8, txt=f"{formatted_key}:", ln=0)
            pdf.set_font("Arial", size=11)
            
                                             
            if len(str(value)) > 50:
                pdf.ln(8)
                pdf.set_x(20)
                pdf.multi_cell(170, 6, txt=str(value))
            else:
                pdf.cell(0, 8, txt=str(value), ln=1)
            
            pdf.ln(2)

                                  
            pdf.ln(2)

        # ----------------------------------------------------
        # VISUAL OF EVIDENCE SECTION
        # ----------------------------------------------------
        evidence_items = self.db.get_case_evidence(user_id, case_id)
        if evidence_items:
            pdf.ln(10)
            pdf.set_font("Arial", 'B', 14)
            pdf.cell(200, 10, txt="Visual Evidence Analysis", ln=1, align='L')
            pdf.ln(5)
            
            for item in evidence_items:
                pdf.set_font("Arial", 'B', 11)
                pdf.cell(0, 8, txt=f"File: {item['original_filename']} ({item['file_type']})", ln=1)
                
                # Parse analysis JSON
                analysis_text = "No analysis available."
                if item['analysis_json']:
                    try:
                        analysis = json.loads(item['analysis_json'])
                        # Extract key findings or summary
                        if 'analysis' in analysis: # Wrapper
                            analysis = analysis['analysis']
                        
                        scene = analysis.get('scene_description', 'No description.')
                        findings = analysis.get('key_findings', [])
                        
                        analysis_text = f"Scene: {scene}\n"
                        if findings:
                            analysis_text += "Key Findings:\n- " + "\n- ".join(findings)
                    except:
                        pass
                
                pdf.set_font("Arial", size=10)
                pdf.multi_cell(0, 6, txt=analysis_text)
                pdf.ln(5)

        os.makedirs("exports", exist_ok=True)
        
        client_name = data.get('client_name', 'Client').replace(" ", "_").replace("/", "-")
        filename = f"exports/Case_{case_id}_{client_name}.pdf"
        pdf.output(filename)
        
        print(f"✅ PDF exported successfully: {filename}")
        return filename
