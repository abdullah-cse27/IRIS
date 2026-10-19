
import re


STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were",
    "what", "which", "who", "whom", "where", "when",
    "why", "how", "do", "does", "did", "can", "could",
    "would", "should", "will", "of", "in", "on", "at",
    "to", "for", "and", "or", "but", "with", "from",
    "by", "about", "into", "it", "this", "that",
    "be", "been", "being", "tell", "me", "explain",
    "please", "current", "latest",
}


def tokenize_text(text: str) -> list[str]:
    """Normalize text and remove common English stopwords."""
    tokens = re.findall(r"\b[a-zA-Z0-9]+\b", text.lower())
    return [token for token in tokens if token not in STOPWORDS]
