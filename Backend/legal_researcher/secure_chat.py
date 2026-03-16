"""
This module governs the AI Chatbot logic. It assembles context from case documents and chat history, enforces system prompts, and interacts with the LLM (Groq) to provide legally-grounded responses.
"""

import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq
from database_manager import DatabaseManager
from rate_limiter import RateLimiter
from guardrails import (
    sanitize_input, 
    validate_output, 
    verify_citations,
    build_secure_prompt,
    build_messages_securely
)

                                           
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

                                                                   
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found in environment. Please set it in .env file.")

logger = logging.getLogger(__name__)

class SecureChatbot:
    """
    Context-aware legal chatbot with security guardrails:
    1. Input sanitization (prompt injection defense)
    2. Secure prompt construction (role separation)
    3. Output validation (harmful content filter)
    4. Hallucination checking (citation verification)
    5. Rate limiting
    """
    
    def __init__(self, api_key: str = None):
        self.client = Groq(api_key=api_key or GROQ_API_KEY)
        self.db = DatabaseManager()
        self.rate_limiter = RateLimiter(tokens_per_minute=20)                  

    def chat_with_case(self, case_id: int, user_query: str, user_id: int = None) -> str:
        """
        Context-Aware Chat with security guardrails.
        1. Sanitizes user input (prompt injection defense)
        2. Fetches Case Data from DB
        3. Fetches Last 5 Messages from DB
        4. Builds secure prompt with proper role separation
        5. Sends to Groq
        6. Validates output and checks for hallucinations
        7. Saves response to DB
        """
        if user_id is None:
             raise ValueError("user_id is required for multi-tenant access")

                                           
        if not self.rate_limiter.try_acquire():
            wait_time = self.rate_limiter.get_wait_time()
            return f"⚠️ Rate limit exceeded. Please wait {wait_time:.0f} seconds."

                                                          
        sanitized_query, input_warnings = sanitize_input(user_query)
        
                                   
        for warning in input_warnings:
            logger.warning(f"Security: {warning}")
        
                                                       
        if "[This query contains prohibited content" in sanitized_query:
            return "⚠️ I'm unable to process this request due to its content. Please rephrase your question about the legal case."

                                                
        case_row = self.db.get_case(user_id, case_id)
        if not case_row:
            return "❌ Error: Case ID not found or access denied."
        
        try:
            case_data = json.loads(case_row['structured_data'])
        except:
            case_data = {}
        
                                                                 
        history_rows = self.db.get_chat_history(user_id, case_id, limit=5)
        history = [{"role": row['role'], "content": row['content']} for row in history_rows]
        
                                                           
                                                                 
        messages = build_messages_securely(
            case_data=case_data,
            case_id=case_id,
            user_query=sanitized_query,
            history=history
        )

        try:
                         
            completion = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=0.3,
                max_tokens=500
            )
            response = completion.choices[0].message.content
            
                                  
            filtered_response, output_warnings, is_blocked = validate_output(response)
            if is_blocked:
                logger.warning(f"Output validation blocked: {output_warnings}")
                return f"⚠️ Response was blocked due to safety concerns."
            
            # Verify citations (hallucination check)
            verified_response, citation_warnings = verify_citations(filtered_response, self.db, case_id)
            final_response = verified_response
            if citation_warnings:
                for warning in citation_warnings:
                    logger.warning(f"Hallucination check: {warning}")
            
                                                                                       
            self.db.add_chat_log(user_id, case_id, "user", sanitized_query)
            self.db.add_chat_log(user_id, case_id, "assistant", final_response)
            
            return final_response
            
        except Exception as e:
            logger.error(f"API Error: {e}")
            return f"❌ API Error: {e}"
    
    def get_case_summary(self, case_id: int, user_id: int = None) -> str:
        """Returns a formatted summary of the case."""
        if user_id is None:
             return "Error: user_id required"

        case_row = self.db.get_case(user_id, case_id)
        if not case_row:
            return "Case not found."
        
        try:
            data = json.loads(case_row['structured_data'])
        except:
            data = {}
        
        summary = f"\n{'='*50}\n"
        summary += f"📁 CASE #{case_id} SUMMARY\n"
        summary += f"{'='*50}\n"
        
        for key, value in data.items():
            formatted_key = key.replace("_", " ").title()
            if isinstance(value, list):
                value = ", ".join(str(v) for v in value)
            summary += f"• {formatted_key}: {value}\n"
        
        summary += f"{'='*50}\n"
        return summary
