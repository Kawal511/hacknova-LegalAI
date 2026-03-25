import os
import sys

# macOS fix for tokenizers multi-threading lock bug
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import numpy as np
import pandas as pd
from sklearn.metrics import ndcg_score
from reranker import LegalReRanker

# Mocking 20 queries with some cases for each
QUERIES = [
    "murder section 302 IPC", "fundamental rights article 21", "property dispute sale deed",
    "divorce under hindu marriage act", "cheque bounce section 138 ni act",
    "criminal conspiracy 120b", "anticipatory bail 438 crpc", "writ petition article 226",
    "copyright infringement injunction", "trademark passing off", "consumer protection act deficiency",
    "RTI right to information", "domestic violence act 2005", "dowry harassment 498a",
    "specific performance of contract", "arbitration and conciliation act section 11",
    "NDPS act bail", "PMLA act commercial quantity", "MCOCA bail conditions", "UAPA act provisions"
]

def generate_mock_cases():
    cases = []
    courts = ["Supreme Court of India", "Bombay High Court", "Delhi High Court", "District Court", "Madras High Court"]
    
    # We create 5 alternative documents per query
    for i, q in enumerate(QUERIES):
        query_cases = []
        for j in range(5):
            court = np.random.choice(courts)
            # define true relevance based on our criteria (Supreme Court > High Court > District Court)
            true_rel = 1.0 if court == "Supreme Court of India" else (0.5 if "High Court" in court else 0.1)
            
            case = {
                "case_title": f"State vs {['A', 'B', 'C', 'D', 'E'][j]} ({q})",
                "court": court,
                "summary": f"This is a case regarding {q} handled in the {court}. The proceedings concluded over several hearings.",
                "true_relevance": true_rel
            }
            query_cases.append(case)
        cases.append((q, query_cases))
    return cases

def evaluate():
    reranker = LegalReRanker()
    dataset = generate_mock_cases()
    
    original_ndcg_scores = []
    reranked_ndcg_scores = []
    
    print("Evaluating 20 queries using NDCG@5...")
    for query, docs in dataset:
        # Original order true relevances
        true_relevances = [doc['true_relevance'] for doc in docs]
        
        # Original (default) predicted order assumes all are equally relevant, or randomly retrieved
        original_predicted_scores = [0.1 for _ in docs] 
        # But wait, ndcg_score needs 2D arrays, and if predicted are all equal it preserves order
        
        # Calculate Original NDCG
        # For original, let's treat the chronological order as predicted = [5, 4, 3, 2, 1] 
        # mimicking search engine returning them in a specific but unranked-by-jurisdiction manner
        orig_pred = np.array([[5.0, 4.0, 3.0, 2.0, 1.0]])
        y_true = np.array([true_relevances])
        original_ndcg = ndcg_score(y_true, orig_pred, k=5)
        original_ndcg_scores.append(original_ndcg)
        
        # Reranked
        ranked_docs = reranker.rank_results(query, docs.copy(), top_k=5)
        
        # We need to map the predicted relevance to the documents returned
        # rank_results gives us docs with 'relevance_score' attached
        reranked_pred = []
        reranked_true = []
        for doc in ranked_docs:
            reranked_pred.append(doc['relevance_score'])
            reranked_true.append(doc['true_relevance'])
            
        y_true_reranked = np.array([reranked_true])
        y_pred_reranked = np.array([reranked_pred])
        
        reranked_ndcg = ndcg_score(y_true_reranked, y_pred_reranked, k=5)
        reranked_ndcg_scores.append(reranked_ndcg)
        
        print(f"Q: '{query}' -> Original NDCG: {original_ndcg:.4f} | Reranked NDCG: {reranked_ndcg:.4f}")

    print("\n--- Summary ---")
    print(f"Average Original NDCG: {np.mean(original_ndcg_scores):.4f}")
    print(f"Average Reranked NDCG: {np.mean(reranked_ndcg_scores):.4f}")

if __name__ == "__main__":
    np.random.seed(42)  # For reproducibility
    evaluate()
