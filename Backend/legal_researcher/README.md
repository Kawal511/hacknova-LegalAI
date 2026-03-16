# ⚖️ Legal AI Platform

A production-grade legal case management system with AI-powered case analysis, PDF document processing, secure authentication, and intelligent legal research.

## 🚀 Features

### 🔐 Secure Authentication
- User registration and login with **bcrypt password hashing**
- User-scoped data isolation (users only see their own cases)
- Session management for secure access

### 📋 Case Management
| Method | Description |
|--------|-------------|
| **Manual Entry** | Form-based case creation with structured fields |
| **AI Extraction** | Paste raw client notes → AI extracts structured data |
| **PDF Upload** | Upload legal documents → AI parses and creates case |

### 🤖 AI-Powered Features
- **Case Structuring**: Automatically extract client name, opposing party, dates, legal issues, evidence from raw notes
- **AI Summaries**: Generate 2-3 sentence summaries of legal cases
- **Context-Aware Chat**: Chat with AI about specific cases with full context (case data + attached documents)
- **Legal Research**: Find relevant case citations from Indian Kanoon using Firecrawl

### 📄 Document Processing
- Parse PDF documents using PyPDF2
- Extract and store full text for search/context
- Attach multiple documents to cases
- Context injection into AI chat

### 📥 Export
- Generate professional PDF case files
- Export includes all structured case data

---

## 🌐 API Endpoints (Frontend Integration)

The `api.py` module provides a complete REST API for frontend integration.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/legal/auth/register` | Register new user |
| POST | `/legal/auth/login` | Login and get user_id |
| GET | `/legal/auth/user/{user_id}` | Get user info |

### Case Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/legal/cases/manual` | Create case with form data |
| POST | `/legal/cases/ai-extract` | Create case from raw notes (AI extraction) |
| POST | `/legal/cases/pdf-upload` | Create case from PDF upload |
| GET | `/legal/cases?user_id=X` | List all user's cases |
| GET | `/legal/cases/{case_id}?user_id=X` | Get case details |
| DELETE | `/legal/cases/{case_id}?user_id=X` | Delete a case |

### AI Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/legal/chat` | Chat with case context |
| GET | `/legal/chat/history/{case_id}` | Get chat history |
| DELETE | `/legal/chat/history/{case_id}` | Clear chat history |
| GET | `/legal/chat/summary/{case_id}` | Get case summary |

### Legal Research
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/legal/research` | Search Indian Kanoon for cases |
| GET | `/legal/research/history/{client_name}` | Get research history |

### Export & Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/legal/export/{case_id}?user_id=X` | Download case as PDF |
| GET | `/legal/stats/{user_id}` | Get user statistics |

---

## 📁 File Structure

```
legal_researcher/
├── api.py                  # FastAPI endpoints (NEW)
├── __init__.py             # Package init (NEW)
├── main.py                 # CLI Application
├── database_manager.py     # SQLite database with auth
├── case_generator.py       # AI case structuring + PDF export
├── secure_chat.py          # Context-aware AI chatbot
├── rate_limiter.py         # API rate limiting
├── legal_researcher.py     # Firecrawl-based legal research
├── legal_system.db         # SQLite database (auto-created)
├── client_database/        # JSON storage for research results
└── exports/                # Generated PDF files
```

---

## 🗄️ Database Schema

```sql
-- User Authentication
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT  -- bcrypt hashed
);

-- Case Management (User-Scoped)
CREATE TABLE cases (
    case_id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    client_name TEXT,
    raw_description TEXT,
    structured_data JSON,
    created_at TIMESTAMP
);

-- Document Storage (PDF Text)
CREATE TABLE documents (
    doc_id INTEGER PRIMARY KEY,
    case_id INTEGER REFERENCES cases(case_id),
    filename TEXT,
    parsed_text TEXT,
    uploaded_at TIMESTAMP
);

-- Chat History
CREATE TABLE chat_logs (
    log_id INTEGER PRIMARY KEY,
    case_id INTEGER REFERENCES cases(case_id),
    role TEXT,  -- 'user' or 'assistant'
    content TEXT,
    timestamp TIMESTAMP
);
```

---

## 🛠️ Installation

```bash
# Install dependencies
pip install groq fpdf bcrypt PyPDF2 firecrawl-py langchain-groq fastapi uvicorn python-multipart

# Run as API server (recommended for frontend)
cd legal_researcher
python api.py

# Or run CLI application
python main.py
```

---

## 🌐 API Usage Examples

### Register a User
```bash
curl -X POST "http://localhost:8001/legal/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username": "lawyer1", "password": "secret123"}'
```

### Login
```bash
curl -X POST "http://localhost:8001/legal/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "lawyer1", "password": "secret123"}'
# Returns: {"success": true, "user_id": 1, "username": "lawyer1"}
```

### Create Case from Raw Notes (AI Extraction)
```bash
curl -X POST "http://localhost:8001/legal/cases/ai-extract?user_id=1" \
  -H "Content-Type: application/json" \
  -d '{
    "raw_notes": "Met with Rajesh Kumar today. His partner Sunil Mehta embezzled Rs 50 lakhs from their company on March 15, 2024. He has bank statements as evidence."
  }'
```

### Chat with Case
```bash
curl -X POST "http://localhost:8001/legal/chat" \
  -H "Content-Type: application/json" \
  -d '{"case_id": 1, "query": "What IPC sections apply to this case?"}'
```

### Legal Research
```bash
curl -X POST "http://localhost:8001/legal/research" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Rajesh Kumar",
    "case_title": "Partnership Embezzlement",
    "description": "Partner embezzled Rs 50 lakhs from joint venture"
  }'
```

---

## 📖 CLI Usage Guide

### 1. First Run - Register
```
⚖️  LEGAL AI PLATFORM - LOGIN
1. Login
2. Register  ← Select this first
3. Exit
```

### 2. Create a Case

**Option A: Manual Entry**
```
Enter Client Name: Rajesh Kumar
Opposing Party: Sunil Mehta
Incident Date: 2024-03-15
Case Type: Civil
Legal Issue: Partner embezzled Rs 50 lakhs...
```

**Option B: AI Extraction**
```
Paste raw client notes below. Type 'END' when done.

Met with Rajesh Kumar today. He says his business partner
Sunil Mehta stole 50 lakhs from their company KM Enterprises
on March 15, 2024. He has bank statements as evidence...
END

⏳ AI analyzing notes...
✅ Case #1 created!
```

**Option C: PDF Upload**
```
Enter PDF file path: /path/to/contract.pdf
⏳ Reading PDF...
  Processed page 1/5
  Processed page 2/5
  ...
📖 Extracted 15000 characters
⏳ AI analyzing document...
✅ Case #2 created from PDF!
📎 Document 'contract.pdf' attached.
```

### 3. Chat with Case
```
[Case 1] You: What IPC sections apply here?
🤔 Thinking...

🤖 AI: Based on the embezzlement of Rs 50 lakhs from the 
joint venture, the following IPC sections may apply:
- Section 405/406: Criminal breach of trust
- Section 420: Cheating and dishonestly inducing delivery
- Section 34: Acts done by several persons in furtherance 
  of common intention

The bank statements showing unauthorized transfers would 
serve as key evidence...
```

### 4. Export to PDF
```
Enter Case ID to export: 1
✅ PDF exported successfully: exports/Case_1_Rajesh_Kumar.pdf
```

---

## 🔍 Legal Research Module

Separate tool for finding relevant case citations using Firecrawl.

```bash
python3 legal_researcher.py
```

**Features:**
- Search Indian Kanoon for relevant cases
- Scrape case details with rate limiting
- Extract verdict, case type, court, date, parties
- Generate AI summaries for each case
- Save to per-client JSON database

**Example Output:**
```
📋 Vineeta Sharma vs Rakesh Sharma (2018)
   Court: Supreme Court of India | Date: 15 May 2018
   Type: Civil | Verdict: Appeal Allowed
   📝 Summary: This case concerns a daughter's claim to 
      ancestral property under the Hindu Succession Act...
```

---

## 🔧 Configuration

### API Keys
Set in environment or directly in code:
```python
GROQ_API_KEY = "gsk_..."      # For AI chat/extraction
FIRECRAWL_API_KEY = "fc-..."  # For legal research
```

### Rate Limiting
- **Firecrawl:** 6 seconds between requests (free tier)
- **Chat API:** 20 requests/minute (configurable)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    main.py (CLI)                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ Auth Module  │  │ Case Manager  │  │ PDF Parser   │ │
│  │  (bcrypt)    │  │ (Groq LLM)    │  │ (PyPDF2)     │ │
│  └──────┬───────┘  └───────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
│         └──────────────────┼──────────────────┘         │
│                            ▼                            │
│              ┌─────────────────────────┐                │
│              │   database_manager.py   │                │
│              │      (SQLite + ORM)     │                │
│              └───────────┬─────────────┘                │
│                          ▼                              │
│              ┌─────────────────────────┐                │
│              │    legal_system.db      │                │
│              │  users|cases|docs|chat  │                │
│              └─────────────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Features

1. **Password Hashing**: bcrypt with salt (never plain text)
2. **SQL Injection Prevention**: Parameterized queries (`?` placeholders)
3. **User Data Isolation**: All queries filtered by `user_id`
4. **Rate Limiting**: Prevents API abuse
5. **Session Management**: Secure login/logout flow

---

## 📊 API Usage & Credits

| Service | Free Tier | Usage Per Run |
|---------|-----------|---------------|
| Groq | 30 req/min | ~1-2 per case |
| Firecrawl | 500 credits | ~6 per research |

---

## 🛡️ Security Notes

> ⚠️ **Important**: Move API keys to environment variables for production!

```bash
export GROQ_API_KEY="gsk_..."
export FIRECRAWL_API_KEY="fc-..."
```

---

## 📝 License

MIT License - Free for personal and commercial use.

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request

---

Built with ❤️ for legal professionals.
