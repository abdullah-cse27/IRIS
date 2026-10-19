from sqlalchemy.orm import Session

from app.models import Document, DocumentChunk
from app.bm25_service import rank_documents


def search_chunks(
    db: Session,
    query: str,
    user_id: int,
    top_k: int = 5,
    document_id: int | None = None,
) -> list[dict]:
    """Search only chunks belonging to documents owned by user_id."""
    if not query or not query.strip():
        return []
    if top_k <= 0:
        raise ValueError("top_k must be greater than zero.")

    chunks_query = (
        db.query(DocumentChunk)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(Document.user_id == user_id)
    )
    if document_id is not None:
        chunks_query = chunks_query.filter(DocumentChunk.document_id == document_id)

    chunks = chunks_query.order_by(
        DocumentChunk.document_id, DocumentChunk.chunk_index
    ).all()
    if not chunks:
        return []

    ranked_results = rank_documents(
        docs=[chunk.text for chunk in chunks],
        query=query,
        top_k=top_k,
    )
    results = []
    for result in ranked_results:
        chunk = chunks[result["index"]]
        document = chunk.document
        results.append({
            "chunk_id": chunk.id,
            "document_id": chunk.document_id,
            "document_name": document.filename,
            "chunk_index": chunk.chunk_index,
            "page_number": chunk.page_number,
            "location": chunk.location,
            "text": chunk.text,
            "score": round(result["score"], 6),
        })
    return results
