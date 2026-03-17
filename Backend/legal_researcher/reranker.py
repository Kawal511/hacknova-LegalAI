try:
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
            query_embedding = self.model.encode(query)
            text_embeddings = self.model.encode(texts)
            norm_query = np.linalg.norm(query_embedding)
            norm_texts = np.linalg.norm(text_embeddings, axis=1)
            cosine_scores = np.dot(text_embeddings, query_embedding) / (norm_texts * norm_query + 1e-10)
            for i, res in enumerate(results):
                text_lower = texts[i].lower()
                if 'supreme court' in text_lower or 'india' in text_lower:
                    cosine_scores[i] += 0.2
                res['relevance_score'] = float(cosine_scores[i])
            ranked_indices = np.argsort(cosine_scores)[::-1]
            return [results[i] for i in ranked_indices][:top_k]

except ImportError:
    class LegalReRanker:
        def __init__(self, model_name='fallback'):
            pass
        def rank_results(self, query: str, results: list, top_k: int = 5) -> list:
            if not results:
                return []
            query_words = set(query.lower().split())
            for res in results:
                title = str(res.get('case_title', '') or res.get('title', '')).lower()
                summary = str(res.get('summary', '') or res.get('ai_summary', '')).lower()
                court = str(res.get('court', '')).lower()
                text_str = f"{title} {court} {summary}"
                score = 0.0
                if 'supreme court' in text_str or 'india' in text_str:
                    score += 0.2
                for word in query_words:
                    if len(word) > 3 and word in text_str:
                        score += 0.1
                res['relevance_score'] = score
            ranked = sorted(results, key=lambda x: x.get('relevance_score', 0), reverse=True)
            return ranked[:top_k]

reranker_instance = None
def get_reranker():
    global reranker_instance
    if reranker_instance is None:
        reranker_instance = LegalReRanker()
    return reranker_instance
