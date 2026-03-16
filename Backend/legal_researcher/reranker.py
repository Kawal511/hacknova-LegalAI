import torch
from sentence_transformers import SentenceTransformer, util
import numpy as np

class LegalReRanker:
    def __init__(self, model_name='sentence-transformers/all-MiniLM-L6-v2'):
        self.model = SentenceTransformer(model_name, device='cpu')
    
    def rank_results(self, query: str, results: list, top_k: int = 5) -> list:
        if not results:
            return []
            
        texts = []
        for r in results:
            title = r.get('case_title', '') or r.get('title', '')
            summary = r.get('summary', '') or r.get('ai_summary', '')
            court = r.get('court', '')
            texts.append(f"{title} {court} {summary}")
            
        if not any(texts):
            return results[:top_k]
            
        # Encode query and texts
        query_embedding = self.model.encode(query)
        text_embeddings = self.model.encode(texts)
        
        # Compute cosine similarities using numpy
        norm_query = np.linalg.norm(query_embedding)
        norm_texts = np.linalg.norm(text_embeddings, axis=1)
        cosine_scores = np.dot(text_embeddings, query_embedding) / (norm_texts * norm_query + 1e-10)
        
        # Boost Supreme Court cases
        for i, res in enumerate(results):
            text_lower = texts[i].lower()
            if 'supreme court' in text_lower or 'india' in text_lower:
                cosine_scores[i] += 0.2
            res['relevance_score'] = float(cosine_scores[i])
            
        # Sort indices in descending order
        ranked_indices = np.argsort(cosine_scores)[::-1]
        
        # Ensure we only return top_k
        ranked_results = [results[i] for i in ranked_indices]
        return ranked_results[:top_k]

reranker_instance = None
def get_reranker():
    global reranker_instance
    if reranker_instance is None:
        reranker_instance = LegalReRanker()
    return reranker_instance
