
import re


def split_into_chunks(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100,
) -> list[str]:
    """Split generic text at sentence or word boundaries."""

    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero.")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be non-negative and smaller than chunk_size.")

    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        return []

    # Prefer sentence boundaries, regardless of document format.
    sentences = re.split(r"(?<=[.!?])\s+", text)

    chunks = []
    current = ""

    def save(value: str) -> None:
        value = value.strip()
        if value:
            chunks.append(value)

    def get_overlap(value: str) -> str:
        words = value.split()
        selected = []

        for word in reversed(words):
            candidate = " ".join([word] + selected)

            if len(candidate) > overlap:
                break

            selected.insert(0, word)

        return " ".join(selected)

    for sentence in sentences:
        # Split an oversized sentence using complete words.
        if len(sentence) > chunk_size:
            if current:
                save(current)
                current = ""

            words = sentence.split()
            piece = ""

            for word in words:
                candidate = f"{piece} {word}".strip()

                if len(candidate) <= chunk_size:
                    piece = candidate
                else:
                    save(piece)
                    prefix = get_overlap(piece)
                    piece = f"{prefix} {word}".strip()

                    if len(piece) > chunk_size:
                        piece = word

            current = piece
            continue

        candidate = f"{current} {sentence}".strip()

        if len(candidate) <= chunk_size:
            current = candidate
        else:
            save(current)
            prefix = get_overlap(current)
            current = f"{prefix} {sentence}".strip()

            if len(current) > chunk_size:
                current = sentence

    if current:
        save(current)

    return chunks


def chunk_pages(
    pages: list[dict],
    chunk_size: int = 500,
    overlap: int = 100,
) -> list[dict]:
    """Chunk pages while preserving source metadata."""

    chunks = []

    for page in pages:
        text = page.get("text", "").strip()

        if not text:
            continue

        for chunk in split_into_chunks(text, chunk_size, overlap):
            chunks.append({
                "text": chunk,
                "page_number": page.get("page_number"),
                "location": page.get("location"),
            })

    return chunks


def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100,
) -> list[str]:
    """Backward-compatible plain-text chunking helper."""

    return split_into_chunks(text, chunk_size, overlap)
