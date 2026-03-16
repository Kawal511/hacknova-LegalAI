import requests
import os
import json
import time

# Configuration
BASE_URL = "http://localhost:8000"
USERNAME = "testuser_automation"
PASSWORD = "TestPassword@123"

# Files to test
PDF_FILE = "ANJUM KADARI vs UNION OF INDIA.pdf"
IMAGE_FILE = "WhatsApp Image 2026-01-16 at 12.04.13.jpeg"

def print_header(title):
    print("\n" + "="*60)
    print(f" {title}")
    print("="*60)

def print_success(msg):
    print(f"✅ {msg}")

def print_fail(msg):
    print(f"❌ {msg}")

def test_backend():
    print_header("STARTING DATA-DRIVEN BACKEND TEST")
    
    # Check if files exist
    if not os.path.exists(PDF_FILE):
        print_fail(f"PDF file not found: {PDF_FILE}")
        return
    if not os.path.exists(IMAGE_FILE):
        print_fail(f"Image file not found: {IMAGE_FILE}")
        return
        
    session = requests.Session()
    user_id = None
    token = None

    # Step 1: Authentication
    try:
        print("\n[Authenticating]...")
        # Try login first
        login_payload = {"username": USERNAME, "password": PASSWORD}
        resp = session.post(f"{BASE_URL}/legal/auth/login", json=login_payload)
        
        if resp.status_code == 401:
            print("  User not found, registering...")
            # Register if login fails
            reg_resp = session.post(f"{BASE_URL}/legal/auth/register", json=login_payload)
            if reg_resp.status_code == 200:
                print_success("Registration successful")
                # Login again
                resp = session.post(f"{BASE_URL}/legal/auth/login", json=login_payload)
            else:
                print_fail(f"Registration failed: {reg_resp.text}")
                return

        if resp.status_code == 200:
            data = resp.json()
            user_id = data.get("user_id")
            token = data.get("access_token") # If JWT used
            print_success(f"Logged in as {USERNAME} (ID: {user_id})")
        else:
            print_fail(f"Login failed: {resp.status_code} - {resp.text}")
            return

    except Exception as e:
        print_fail(f"Connection failed. Is the backend running? Error: {e}")
        return

    # Step 2: Upload PDF Case
    case_id = None
    try:
        print_header(f"TESTING PDF CASE CREATION: {PDF_FILE}")
        
        with open(PDF_FILE, "rb") as f:
            files = {"file": (PDF_FILE, f, "application/pdf")}
            params = {"user_id": user_id}
            
            print(f"  Uploading {PDF_FILE}...")
            start_time = time.time()
            resp = session.post(f"{BASE_URL}/legal/cases/pdf-upload", files=files, params=params)
            duration = time.time() - start_time
            
            if resp.status_code == 200:
                data = resp.json()
                case_id = data.get("case_id")
                client_name = data.get("client_name")
                print_success(f"Case Created! ID: {case_id}")
                print(f"  • Client Name: {client_name}")
                print(f"  • Time Taken: {duration:.2f}s")
                
                # Verify documents
                docs = data.get("documents", [])
                print(f"  • Documents Extracted: {len(docs)}")
            else:
                print_fail(f"PDF Upload Failed: {resp.status_code} - {resp.text}")
                # Cannot proceed without a case
                return

    except Exception as e:
        print_fail(f"PDF Upload Exception: {e}")
        return

    # Step 3: Upload Image Evidence
    try:
        print_header(f"TESTING EVIDENCE ANALYSIS: {IMAGE_FILE}")
        
        with open(IMAGE_FILE, "rb") as f:
            # api_evidence.py expects 'case_id', 'user_id' as Form data
            files = {"file": (IMAGE_FILE, f, "image/jpeg")}
            data = {
                "case_id": case_id,
                "user_id": user_id, 
                "description": "Test evidence upload via script",
                "case_type": "legal"
            }
            
            print(f"  Uploading {IMAGE_FILE}...")
            resp = session.post(f"{BASE_URL}/legal/evidence/analyze-image", files=files, data=data)
            
            if resp.status_code == 200:
                ev_data = resp.json()
                ev_id = ev_data.get("evidence_id")
                print_success(f"Evidence Uploaded! ID: {ev_id}")
                
                analysis = ev_data.get("analysis", {})
                print(f"  • Analysis Success: {ev_data.get('success')}")
                if analysis:
                    print(f"  • Objects Detected: {len(analysis.get('objects', []))}")
                    print(f"  • Text Detected: {'Yes' if analysis.get('ocr_text') else 'No'}")
            else:
                print_fail(f"Image Upload Failed: {resp.status_code} - {resp.text}")

    except Exception as e:
        print_fail(f"Image Upload Exception: {e}")

    # Step 4: Chat Verification
    try:
        print_header("TESTING RAG CHAT")
        
        chat_payload = {
            "case_id": case_id,
            "query": "Summarize the key legal issues in this case based on the documents.",
            "language": "en"
        }
        
        print(f"  Query: {chat_payload['query']}")
        resp = session.post(f"{BASE_URL}/legal/chat", params={"user_id": user_id}, json=chat_payload)
        
        if resp.status_code == 200:
            chat_data = resp.json()
            response_text = chat_data.get("response", "")
            print_success("Chat Response Received")
            print(f"  Response Length: {len(response_text)} chars")
            print(f"  Preview: {response_text[:200]}...")
        else:
            print_fail(f"Chat Failed: {resp.status_code} - {resp.text}")

    except Exception as e:
        print_fail(f"Chat Exception: {e}")

    print_header("TEST COMPLETE")

if __name__ == "__main__":
    test_backend()
