import os
import sys
from unittest.mock import MagicMock, patch

# macOS safe-threading flags
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["OMP_NUM_THREADS"] = "1"

# Import our system components
from reranker import get_reranker, LegalReRanker

def test_reranker_stability():
    print("Initialize ReRanker...")
    reranker = get_reranker()
    print("ReRanker initialized successfully!")
    
    # Mock data modeling what the scraper returns
    mock_cases = [
        {"case_title": "State vs Unknown", "court": "District Court", "summary": "Small issue regarding property."},
        {"case_title": "Union vs Corporation", "court": "Supreme Court of India", "summary": "Landmark fundamental rights case."},
        {"case_title": "Tech Co vs Copier", "court": "High Court", "summary": "Copyright infringement dispute."}
    ]
    
    print("Running system ranking pipeline...")
    # This proves the ReRanker operates without deadlocking the CPU
    ranked = reranker.rank_results("fundamental rights copyright", mock_cases, top_k=3)
    
    # Verify System Integrity
    assert len(ranked) == 3, "Failed to return correct number of cases"
    assert "relevance_score" in ranked[0], "Pipeline failed to inject relevance_score"
    
    # Supreme Court case should be boosted to the top because of our +0.2 logic and semantic match
    assert ranked[0]["court"] == "Supreme Court of India", f"Sorting failed, top court was {ranked[0]['court']}"
    
    print("✅ Local End-to-End Pipeline test passed.")
    print(f"Top Result Score: {ranked[0]['relevance_score']:.4f}")
    print(f"Top Result Court: {ranked[0]['court']}")

if __name__ == "__main__":
    try:
        test_reranker_stability()
    except Exception as e:
        print(f"❌ System Test Failed: {e}")
        sys.exit(1)
