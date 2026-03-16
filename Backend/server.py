"""
Legal AI Backend - Unified Server Launcher
===========================================
Launches the Zephyr API which now includes the Legal Researcher module.

The Zephyr app.py automatically integrates:
- Zephyr RAG Document Assistant (/upload, /chat, /metadata, /documents, etc.)
- Legal Researcher Module (/legal/auth, /legal/cases, /legal/chat, /legal/research, etc.)

Run this file to start the complete backend server.
"""

import os
import sys

# Ensure proper paths
backend_dir = os.path.dirname(os.path.abspath(__file__))
zephyr_src = os.path.join(backend_dir, 'Zephyr', 'src')

# Add paths
sys.path.insert(0, backend_dir)
sys.path.insert(0, zephyr_src)

if __name__ == "__main__":
    import uvicorn
    
    # Change to Zephyr directory for proper relative imports
    os.chdir(os.path.join(backend_dir, 'Zephyr'))
    
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    print(f"""
    ╔══════════════════════════════════════════════════════════╗
    ║           ⚖️  Legal AI Platform - Backend Server          ║
    ╠══════════════════════════════════════════════════════════╣
    ║  Host: {host}                                            ║
    ║  Port: {port}                                            ║
    ║  Docs: http://localhost:{port}/docs                       ║
    ║                                                          ║
    ║  Endpoints:                                              ║
    ║    Zephyr RAG:  /upload, /chat, /documents, /metadata    ║
    ║    Legal:       /legal/auth, /legal/cases, /legal/chat   ║
    ╚══════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run("src.app:app", host=host, port=port, reload=True)

