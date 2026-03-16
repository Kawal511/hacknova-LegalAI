"""
Server launcher script - run from C:\LegalAi\Backend
This script properly sets up the path and launches the FastAPI server.
"""
import os
import sys

# Add Zephyr directory to Python path
zephyr_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Zephyr')
sys.path.insert(0, zephyr_path)

# Change to Zephyr directory
os.chdir(zephyr_path)

# Now import and run the app
from src.app import app
import uvicorn

if __name__ == "__main__":
    print(f"Starting server from: {os.getcwd()}")
    print(f"Python path includes: {zephyr_path}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
