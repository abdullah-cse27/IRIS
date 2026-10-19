
from unittest.mock import patch

import pytest

from app.retrieval_service import search_chunks

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import User, Document, DocumentChunk


def test_empty_query_returns_empty_list():
    result = search_chunks(
        db=None,
        query="   ",
        user_id=1,
    )

    assert result == []


def test_zero_top_k_raises_value_error():
    with pytest.raises(ValueError, match="top_k must be greater than zero"):
        search_chunks(
            db=None,
            query="refund policy",
            user_id=1,
            top_k=0,
        )


def test_search_chunks_returns_ranked_results():
    fake_chunk = type(
        "FakeChunk",
        (),
        {
            "id": 10,
            "document_id": 5,
            "chunk_index": 0,
            "page_number": 1,
            "location": None,
            "text": "Refunds are allowed within 30 days.",
            "document": type(
                "FakeDocument",
                (),
                {"filename": "refund_policy.pdf"},
            )(),
        },
    )()

    fake_query = type(
        "FakeQuery",
        (),
        {
            "join": lambda self, *args: self,
            "filter": lambda self, *args: self,
            "order_by": lambda self, *args: self,
            "all": lambda self: [fake_chunk],
        },
    )()

    fake_db = type(
        "FakeDB",
        (),
        {"query": lambda self, *args: fake_query},
    )()

    with patch(
        "app.retrieval_service.rank_documents",
        return_value=[{"index": 0, "score": 0.9}],
    ) as mock_rank:
        result = search_chunks(
            db=fake_db,
            query="refund policy",
            user_id=1,
            top_k=5,
        )

    assert len(result) == 1
    assert result[0]["document_id"] == 5
    assert result[0]["document_name"] == "refund_policy.pdf"
    assert result[0]["score"] == 0.9
    mock_rank.assert_called_once()


def test_search_chunks_only_returns_current_users_documents():
    # An isolated in-memory SQLite database for this test.
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(
        bind=test_engine,
        autoflush=False,
        expire_on_commit=False,
    )

    Base.metadata.create_all(bind=test_engine)

    try:
        with TestingSession() as db:
            user_a = User(
                name="Test User A",
                phone="9000000001",
                email="test-a@example.com",
                password_hash="test-hash-a",
            )
            user_b = User(
                name="Test User B",
                phone="9000000002",
                email="test-b@example.com",
                password_hash="test-hash-b",
            )
            db.add_all([user_a, user_b])
            db.flush()

            doc_a = Document(
                user_id=user_a.id,
                filename="user_a.pdf",
                file_type="pdf",
                file_size=100,
                extracted_text="User A document",
            )
            doc_b = Document(
                user_id=user_b.id,
                filename="user_b.pdf",
                file_type="pdf",
                file_size=100,
                extracted_text="User B document",
            )
            db.add_all([doc_a, doc_b])
            db.flush()

            db.add_all([
                DocumentChunk(
                    document_id=doc_a.id,
                    chunk_index=0,
                    text="Refunds are available within 30 days.",
                    page_number=1,
                ),
                DocumentChunk(
                    document_id=doc_b.id,
                    chunk_index=0,
                    text="Confidential information belonging to user B.",
                    page_number=1,
                ),
            ])
            db.commit()

            # Mock ranking so this test focuses on database ownership.
            with patch(
                "app.retrieval_service.rank_documents",
                side_effect=lambda docs, query, top_k: [
                    {"index": i, "score": 1.0}
                    for i in range(min(len(docs), top_k))
                ],
            ):
                results_a = search_chunks(
                    db=db,
                    query="document information",
                    user_id=user_a.id,
                )

                results_b = search_chunks(
                    db=db,
                    query="document information",
                    user_id=user_b.id,
                )

                results_a_specific = search_chunks(
                    db=db,
                    query="refunds",
                    user_id=user_a.id,
                    document_id=doc_a.id,
                )

            assert results_a
            assert all(
                result["document_id"] == doc_a.id
                for result in results_a
            )
            assert all(
                result["document_name"] != "user_b.pdf"
                for result in results_a
            )

            assert results_b
            assert all(
                result["document_id"] == doc_b.id
                for result in results_b
            )

            assert results_a_specific
            assert all(
                result["document_id"] == doc_a.id
                for result in results_a_specific
            )

    finally:
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()
