"""
This is the application entry point. It initializes the FastAPI app, configures CORS, and includes the API router.
"""

                      
"""
LEGAL CASE MANAGEMENT SYSTEM v2.0 - Terminal Edition
=====================================================
Production-grade features:
- User Authentication (bcrypt hashing)
- User-scoped data isolation
- PDF Document Processing
- AI-powered case extraction
- Context-aware legal chat
- PDF export
"""

import os
import json
import getpass
from PyPDF2 import PdfReader
from database_manager import DatabaseManager
from case_generator import CaseGenerator
from secure_chat import SecureChatbot

        
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found in environment. Please set it in .env file.")


def clear_screen():
    os.system('clear' if os.name != 'nt' else 'cls')


def print_header(title: str):
    print("\n" + "=" * 50)
    print(f" {title}")
    print("=" * 50)


def print_auth_menu():
    print_header("⚖️  LEGAL AI PLATFORM - LOGIN")
    print("1. Login")
    print("2. Register")
    print("3. Exit")


def print_main_menu(username: str):
    print_header(f"⚖️  LEGAL AI PLATFORM - {username}")
    print("1. New Case (Manual Entry)")
    print("2. New Case (AI Extraction)")
    print("3. New Case (PDF Upload)")
    print("4. My Cases")
    print("5. Chat with Case")
    print("6. Export Case to PDF")
    print("7. Logout")


def authenticate(db: DatabaseManager) -> tuple:
    """Handle login/register flow. Returns (user_id, username) or (None, None)."""
    while True:
        print_auth_menu()
        choice = input("\nSelect Option: ").strip()
        
        if choice == '1':
                   
            print("\n--- LOGIN ---")
            username = input("Username: ").strip()
            password = getpass.getpass("Password: ")
            
            user_id = db.login_user(username, password)
            if user_id:
                print(f"\n✅ Welcome back, {username}!")
                return user_id, username
            else:
                print("\n❌ Invalid credentials. Try again.")
        
        elif choice == '2':
                      
            print("\n--- REGISTER ---")
            username = input("Choose Username: ").strip()
            password = getpass.getpass("Choose Password: ")
            confirm = getpass.getpass("Confirm Password: ")
            
            if password != confirm:
                print("\n❌ Passwords don't match.")
            elif len(password) < 4:
                print("\n❌ Password must be at least 4 characters.")
            elif db.register_user(username, password):
                print(f"\n✅ Account created for {username}! Please login.")
            else:
                print("\n❌ Username already taken.")
        
        elif choice == '3':
            print("\n👋 Goodbye!")
            return None, None
        
        input("\nPress Enter to continue...")


def new_case_manual(db: DatabaseManager, user_id: int):
    """Create case with manual entry."""
    print_header("📝 NEW CASE - MANUAL ENTRY")
    
    client_name = input("Client Name: ").strip()
    opposing_party = input("Opposing Party: ").strip()
    incident_date = input("Incident Date: ").strip()
    case_type = input("Case Type (Civil/Criminal/Family/Property): ").strip()
    
    print("\nLegal Issue Summary (press Enter twice when done):")
    lines = []
    while True:
        line = input()
        if line == "":
            break
        lines.append(line)
    legal_issue = "\n".join(lines)
    
    print("\nKey Evidence (one per line, empty line to finish):")
    evidence = []
    while True:
        e = input("  - ")
        if e == "":
            break
        evidence.append(e)
    
    structured_data = {
        "client_name": client_name,
        "opposing_party": opposing_party,
        "incident_date": incident_date,
        "case_type": case_type,
        "legal_issue_summary": legal_issue,
        "key_evidence_list": evidence
    }
    
    case_id = db.save_case(user_id, client_name, structured_data)
    print(f"\n✅ Case #{case_id} created successfully!")


def new_case_ai(db: DatabaseManager, generator: CaseGenerator, user_id: int):
    """Create case with AI extraction from raw notes."""
    print_header("🤖 NEW CASE - AI EXTRACTION")
    print("Paste raw client notes below. Type 'END' on a new line when done.\n")
    
    lines = []
    while True:
        line = input()
        if line.strip().upper() == 'END':
            break
        lines.append(line)
    
    raw_text = "\n".join(lines)
    
    if not raw_text.strip():
        print("❌ No input provided.")
        return
    
    print("\n⏳ AI analyzing notes...")
    structured_data = generator.generate_case_structure(raw_text)
    
    if structured_data:
        client_name = structured_data.get('client_name', 'Unknown Client')
        case_id = db.save_case(user_id, client_name, structured_data, raw_text)
        
        print(f"\n✅ Case #{case_id} created!")
        print("\n📋 Extracted Data:")
        print(json.dumps(structured_data, indent=2))
    else:
        print("❌ Failed to extract case structure.")


def new_case_pdf(db: DatabaseManager, generator: CaseGenerator, user_id: int):
    """Create case from PDF document."""
    print_header("📄 NEW CASE - PDF UPLOAD")
    
    pdf_path = input("Enter PDF file path: ").strip()
    
                                            
    pdf_path = pdf_path.strip("'\"")
    
    if not os.path.exists(pdf_path):
        print(f"❌ File not found: {pdf_path}")
        return
    
    if not pdf_path.lower().endswith('.pdf'):
        print("❌ File must be a PDF.")
        return
    
    print("\n⏳ Reading PDF...")
    
    try:
        reader = PdfReader(pdf_path)
        full_text = ""
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            full_text += text + "\n"
            print(f"  Processed page {i+1}/{len(reader.pages)}")
        
        if len(full_text) < 100:
            print("❌ Could not extract text. PDF may be scanned/image-based.")
            return
        
        print(f"\n📖 Extracted {len(full_text)} characters from {len(reader.pages)} pages.")
        
    except Exception as e:
        print(f"❌ Error reading PDF: {e}")
        return
    
    print("\n⏳ AI analyzing document...")
    structured_data = generator.generate_case_structure(full_text[:5000])
    
    if structured_data:
        client_name = structured_data.get('client_name', 'PDF Upload')
        filename = os.path.basename(pdf_path)
        
                   
        case_id = db.save_case(user_id, client_name, structured_data, f"[PDF: {filename}]")
        
                            
        db.save_document(case_id, filename, full_text)
        
        print(f"\n✅ Case #{case_id} created from PDF!")
        print(f"📎 Document '{filename}' attached.")
        print("\n📋 Extracted Data:")
        print(json.dumps(structured_data, indent=2))
    else:
        print("❌ Failed to analyze document.")


def view_my_cases(db: DatabaseManager, user_id: int):
    """List all cases for current user."""
    print_header("📂 MY CASES")
    
    cases = db.get_user_cases(user_id)
    
    if not cases:
        print("No cases found. Create one using the menu.")
        return
    
    print(f"Found {len(cases)} case(s):\n")
    
    for case in cases:
        data = json.loads(case['structured_data'])
        docs = db.get_case_documents(case['case_id'])
        
        print(f"  #{case['case_id']:3} | {case['client_name'][:30]:30} | {case['created_at'][:10]}")
        
        if docs:
            print(f"       📎 {len(docs)} document(s) attached")
    
    print("-" * 50)
    
                          
    case_id = input("\nEnter Case ID to view details (or Enter to skip): ").strip()
    if case_id:
        try:
            case = db.get_case(int(case_id), user_id)
            if case:
                print(f"\n{'='*50}")
                print(f"📁 CASE #{case['case_id']} DETAILS")
                print(f"{'='*50}")
                data = json.loads(case['structured_data'])
                for key, value in data.items():
                    formatted_key = key.replace("_", " ").title()
                    if isinstance(value, list):
                        value = ", ".join(str(v) for v in value)
                    print(f"• {formatted_key}: {value}")
                
                                    
                docs = db.get_case_documents(case['case_id'])
                if docs:
                    print(f"\n📎 Attached Documents:")
                    for doc in docs:
                        print(f"  - {doc['filename']} ({len(doc['parsed_text'])} chars)")
            else:
                print("❌ Case not found or access denied.")
        except ValueError:
            print("❌ Invalid Case ID.")


def chat_with_case(db: DatabaseManager, bot: SecureChatbot, user_id: int):
    """Interactive chat with a specific case."""
    print_header("💬 CHAT WITH CASE")
    
                      
    cases = db.get_user_cases(user_id)
    if not cases:
        print("No cases found. Create one first.")
        return
    
    print("Your cases:")
    for case in cases:
        print(f"  #{case['case_id']} - {case['client_name']}")
    
    case_id_input = input("\nEnter Case ID to chat with: ").strip()
    
    try:
        case_id = int(case_id_input)
    except ValueError:
        print("❌ Invalid Case ID.")
        return
    
    case = db.get_case(case_id, user_id)
    if not case:
        print("❌ Case not found or access denied.")
        return
    
                       
    print(f"\n{'='*50}")
    print(f"📁 CASE #{case_id} - {case['client_name']}")
    print(f"{'='*50}")
    
    data = json.loads(case['structured_data'])
    for key, value in data.items():
        formatted_key = key.replace("_", " ").title()
        if isinstance(value, list):
            value = ", ".join(str(v) for v in value)[:50] + "..."
        print(f"• {formatted_key}: {str(value)[:60]}")
    
    print(f"\n💬 Chat started. Type '/back' to return, '/clear' to clear history.\n")
    
    while True:
        user_query = input(f"[Case {case_id}] You: ").strip()
        
        if user_query.lower() == '/back':
            break
        elif user_query.lower() == '/clear':
            db.clear_chat_history(case_id)
            print("🗑️ Chat history cleared.\n")
            continue
        elif not user_query:
            continue
        
                                           
        docs = db.get_case_documents(case_id)
        doc_context = ""
        if docs:
            doc_context = "\n".join([d['parsed_text'][:2000] for d in docs])
        
                              
        if doc_context:
            full_query = f"Document Context:\n{doc_context[:3000]}\n\nQuestion: {user_query}"
        else:
            full_query = user_query
        
        print("🤔 Thinking...")
        response = bot.chat_with_case(case_id, full_query)
        print(f"\n🤖 AI: {response}\n")


def export_case(generator: CaseGenerator, db: DatabaseManager, user_id: int):
    """Export case to PDF."""
    print_header("📥 EXPORT CASE TO PDF")
    
                
    cases = db.get_user_cases(user_id)
    if not cases:
        print("No cases found.")
        return
    
    print("Your cases:")
    for case in cases:
        print(f"  #{case['case_id']} - {case['client_name']}")
    
    case_id_input = input("\nEnter Case ID to export: ").strip()
    
    try:
        case_id = int(case_id_input)
                          
        case = db.get_case(case_id, user_id)
        if not case:
            print("❌ Case not found or access denied.")
            return
        
        generator.export_case_to_pdf(case_id)
    except ValueError:
        print("❌ Invalid Case ID.")


def main():
    print("\n🏛️  Legal Case Management System v2.0")
    print("📁 Database: legal_system.db")
    print("🔐 Authentication: Enabled")
    
    db = DatabaseManager()
    generator = CaseGenerator(GROQ_API_KEY)
    bot = SecureChatbot(GROQ_API_KEY)
    
                    
    user_id, username = authenticate(db)
    
    if user_id is None:
        return
    
               
    while True:
        print_main_menu(username)
        choice = input("\nSelect Option: ").strip()
        
        if choice == '1':
            new_case_manual(db, user_id)
        
        elif choice == '2':
            new_case_ai(db, generator, user_id)
        
        elif choice == '3':
            new_case_pdf(db, generator, user_id)
        
        elif choice == '4':
            view_my_cases(db, user_id)
        
        elif choice == '5':
            chat_with_case(db, bot, user_id)
        
        elif choice == '6':
            export_case(generator, db, user_id)
        
        elif choice == '7':
            print(f"\n👋 Goodbye, {username}!")
            break
        
        else:
            print("❌ Invalid option.")
        
        input("\nPress Enter to continue...")


if __name__ == "__main__":
    main()
