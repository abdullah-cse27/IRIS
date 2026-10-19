
from tavily import TavilyClient

from app.config import settings


class WebSearchServiceError(Exception):
    """Raised when the web search service fails."""


def search_web(query: str, max_results: int = 5) -> list[dict]:
    query = query.strip()

    if not query:
        return []

    if not settings.tavily_api_key:
        raise WebSearchServiceError("Web search is not configured.")

    try:
        client = TavilyClient(api_key=settings.tavily_api_key)

        
        
        
        response = client.search(
            query=query,
            max_results=max_results,
            search_depth="advanced",
            include_domains=["python.org"],
        )




        results = []

        for item in response.get("results", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "content": (
                        item.get("raw_content")
                        or item.get("content")
                        or ""
                    )[:2500],
            })

        return results

    except Exception:
        raise WebSearchServiceError(
            "The web search service is temporarily unavailable."
        ) from None
