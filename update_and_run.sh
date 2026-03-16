#!/bin/bash
echo "🚀 Updating and Starting Zeroday Backend..."

# 1. Update from Git
echo "\n📥 Fetching latest changes from feature/drafting-upgrade..."
git fetch origin
git checkout feature/drafting-upgrade
git pull origin feature/drafting-upgrade

# 2. Apply Verification Fix
echo "\n🔧 Applying necessary patches..."
python3 apply_fix.py

# 3. Start Backend
echo "\n⚖️ Starting Legal Researcher API..."
python3 -m uvicorn Backend.legal_researcher.api:app --reload --port 8000
