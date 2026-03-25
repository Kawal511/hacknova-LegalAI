import os
import re
import json
import time
from pathlib import Path

# Try to import Firecrawl
try:
    from firecrawl import FirecrawlApp as Firecrawl
except Exception:
    try:
        from firecrawl import Firecrawl
    except Exception:
        Firecrawl = None

# Locate FIRECRAWL_API_KEY: prefer environment, else read backend/.env
def load_firecrawl_key():
    key = os.getenv("FIRECRAWL_API_KEY")
    if key:
        return key.strip()
    env_path = Path(__file__).parent / "Backend" / "legal_researcher" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.strip().startswith("FIRECRAWL_API_KEY="):
                return line.split("=",1)[1].strip()
    return None


def build_search_url(query: str) -> str:
    q = query.replace(' ', '+')
    return f"https://indiankanoon.org/search/?formInput={q}" 


def extract_doc_ids(markdown: str):
    ids = re.findall(r'indiankanoon\.org/doc/(\d+)', markdown)
    unique = list(dict.fromkeys(ids))
    return unique


def search_and_fetch(app, query, max_results=3, only_main=True):
    url = build_search_url(query)
    print(f"Searching IndianKanoon for: '{query}' -> {url}")
    try:
        resp = app.scrape(url, formats=['markdown'])
        markdown = getattr(resp, 'markdown', '') or ''
    except Exception as e:
        print(f"Search scrape failed: {e}")
        return []

    ids = extract_doc_ids(markdown)
    ids = ids[:max_results]
    urls = [f"https://indiankanoon.org/doc/{_id}/" for _id in ids]
    results = []
    for i, u in enumerate(urls):
        try:
            print(f"Fetching ({i+1}/{len(urls)}): {u}")
            doc = app.scrape(u, formats=['markdown'], only_main_content=only_main)
            md = getattr(doc, 'markdown', '') or ''
            results.append({"url": u, "markdown": md})
            time.sleep(6)  # be polite / respect free-tier rate limit
        except Exception as e:
            print(f"Failed to fetch {u}: {e}")
    return results


def main():
    key = load_firecrawl_key()
    if not key:
        print("ERROR: FIRECRAWL_API_KEY not found in environment or Backend/legal_researcher/.env")
        return
    if Firecrawl is None:
        print("ERROR: firecrawl package not installed in the current environment.")
        return

    app = Firecrawl(api_key=key)

    queries = [
        "murder Supreme Court judgment site:indiankanoon.org",
        "murder conviction site:indiankanoon.org"
    ]

    out_dir = Path(__file__).parent / "scrape_outputs"
    out_dir.mkdir(exist_ok=True)

    summary = {}
    for idx, q in enumerate(queries, start=1):
        print(f"\n=== Run {idx}: query='{q}' ===")
        results = search_and_fetch(app, q, max_results=3)
        out_file = out_dir / f"murder_scrape_{idx}.json"
        with out_file.open('w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"Saved {len(results)} results to {out_file}")
        summary[f"run_{idx}"] = {
            "query": q,
            "count": len(results),
            "file": str(out_file)
        }

    summary_file = out_dir / "summary.json"
    with summary_file.open('w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"\nSummary saved to {summary_file}")


if __name__ == '__main__':
    main()
