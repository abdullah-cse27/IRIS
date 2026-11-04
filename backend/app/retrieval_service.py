from sqlalchemy.orm import Session
from app.models import Document, DocumentChunk, DocumentBlock
from app.bm25_service import rank_documents


def search_chunks(
    db: Session,
    query: str,
    user_id: int,
    top_k: int = 5,
    document_id: int | None = None,
) -> list[dict]:
    """Retrieve and fuse chunk and structural block results."""

    if not query or not query.strip():
        return []

    if top_k <= 0:
        raise ValueError("top_k must be greater than zero.")

    # 1. Retrieve authorized chunks.
    chunks_query = (
        db.query(DocumentChunk)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(Document.user_id == user_id)
    )

    # 2. Retrieve authorized structural blocks.
    blocks_query = (
        db.query(DocumentBlock)
        .join(Document, Document.id == DocumentBlock.document_id)
        .filter(Document.user_id == user_id)
    )

    if document_id is not None:
        chunks_query = chunks_query.filter(
            DocumentChunk.document_id == document_id
        )
        blocks_query = blocks_query.filter(
            DocumentBlock.document_id == document_id
        )

    chunks = chunks_query.order_by(
        DocumentChunk.document_id,
        DocumentChunk.chunk_index,
    ).all()

    blocks = blocks_query.order_by(
        DocumentBlock.document_id,
        DocumentBlock.block_index,
    ).all()

    # 3. Rank both collections independently.
    chunk_ranked = rank_documents(
        docs=[chunk.text for chunk in chunks],
        query=query,
        top_k=top_k,
    )

    block_ranked = rank_documents(
        docs=[
            block.text
            for block in blocks
            if block.text.strip()
        ],
        query=query,
        top_k=top_k,
    )

    # Preserve the original indices for structural blocks.
    valid_blocks = [
        block for block in blocks if block.text.strip()
    ]

    # 4. Reciprocal Rank Fusion.
    fused = {}

    def add_result(key, item, rank, result_type):
        if key not in fused:
            fused[key] = {
                **item,
                "rrf_score": 0.0,
                "result_type": result_type,
            }

        fused[key]["rrf_score"] += 1 / (60 + rank)

    for rank, result in enumerate(chunk_ranked, start=1):
        chunk = chunks[result["index"]]

        item = {
            "chunk_id": chunk.id,
            "document_id": chunk.document_id,
            "document_name": chunk.document.filename,
            "chunk_index": chunk.chunk_index,
            "page_number": chunk.page_number,
            "location": chunk.location,
            "text": chunk.text,
            "score": round(result["score"], 6),
        }

        add_result(
            ("chunk", chunk.id),
            item,
            rank,
            "chunk",
        )

    for rank, result in enumerate(block_ranked, start=1):
        block = valid_blocks[result["index"]]

        item = {
            "chunk_id": None,
            "block_id": block.id,
            "block_type": block.block_type,
            "document_id": block.document_id,
            "document_name": block.document.filename,
            "chunk_index": None,
            "page_number": block.page_number,
            "location": None,
            "text": block.text,
            "score": round(result["score"], 6),
        }

        add_result(
            ("block", block.id),
            item,
            rank,
            "block",
        )

    # 5. Return fused results.
    results = sorted(
        fused.values(),
        key=lambda item: item["rrf_score"],
        reverse=True,
    )

    return results[:top_k]