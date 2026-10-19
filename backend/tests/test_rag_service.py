
from unittest.mock import patch
from types import SimpleNamespace

import pytest
from groq import RateLimitError
import httpx

from app.rag_service import generate_answer, RAGServiceError


CHUNK = {
    "document_id": 10,
    "document_name": "refund_policy.pdf",
    "chunk_id": 101,
    "chunk_index": 0,
    "page_number": 2,
    "location": None,
    "text": "Refunds are available within 30 days.",
    "score": 0.92,
}


def mock_groq_response(content):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=content)
            )
        ]
    )


def setup_relevant_chunks():
    return (
        patch(
            "app.rag_service.search_chunks",
            return_value=[CHUNK],
        ),
        patch(
            "app.rag_service.filter_relevant_chunks",
            return_value=[CHUNK],
        ),
    )


def test_empty_question_raises_value_error():
    with pytest.raises(ValueError, match="Question cannot be empty"):
        generate_answer(
            db=None,
            question="   ",
            user_id=1,
        )


def test_no_relevant_chunks_returns_no_answer_and_no_sources():
    with (
        patch("app.rag_service.search_chunks", return_value=[]),
        patch("app.rag_service.Groq") as mock_groq,
    ):
        result = generate_answer(
            db=None,
            question="What is the refund policy?",
            user_id=1,
        )

    assert result["question"] == "What is the refund policy?"
    assert "not found" in result["answer"].lower()
    assert result["sources"] == []
    mock_groq.assert_not_called()


def test_successful_answer_returns_source_metadata():
    search_patch, relevance_patch = setup_relevant_chunks()

    with (
        search_patch,
        relevance_patch,
        patch("app.rag_service.Groq") as mock_groq,
    ):
        mock_groq.return_value.chat.completions.create.return_value = (
            mock_groq_response(
                "Refunds are available within 30 days. [Source 1]"
            )
        )

        result = generate_answer(
            db=None,
            question=" What is the refund policy? ",
            user_id=1,
        )

    assert result["question"] == "What is the refund policy?"
    assert "30 days" in result["answer"]
    assert "[Source 1]" not in result["answer"]
    assert len(result["sources"]) == 1
    assert result["sources"][0]["document_name"] == "refund_policy.pdf"
    assert result["sources"][0]["page_number"] == 2


def test_groq_rate_limit_raises_rag_service_error():
    search_patch, relevance_patch = setup_relevant_chunks()

    with (
        search_patch,
        relevance_patch,
        patch("app.rag_service.Groq") as mock_groq,
    ):
        mock_groq.return_value.chat.completions.create.side_effect = (
            RateLimitError(
                "Simulated rate limit",
                response=httpx.Response(
                    429,
                    request=httpx.Request(
                        "POST", "https://api.groq.com"
                    ),
                ),
                body=None,
            )
        )

        with pytest.raises(
            RAGServiceError,
            match="answer service is temporarily unavailable",
        ):
            generate_answer(
                db=None,
                question="What is the refund policy?",
                user_id=1,
            )


def test_empty_llm_response_raises_rag_service_error():
    search_patch, relevance_patch = setup_relevant_chunks()

    with (
        search_patch,
        relevance_patch,
        patch("app.rag_service.Groq") as mock_groq,
    ):
        mock_groq.return_value.chat.completions.create.return_value = (
            mock_groq_response("   ")
        )

        with pytest.raises(
            RAGServiceError,
            match="returned an empty response",
        ):
            generate_answer(
                db=None,
                question="What is the refund policy?",
                user_id=1,
            )


def test_relevance_service_runtime_error_is_wrapped():
    with (
        patch(
            "app.rag_service.search_chunks",
            return_value=[CHUNK],
        ),
        patch(
            "app.rag_service.filter_relevant_chunks",
            side_effect=RuntimeError("Invalid model response"),
        ),
        patch("app.rag_service.Groq") as mock_groq,
    ):
        with pytest.raises(
            RAGServiceError,
            match="relevance service returned an invalid response",
        ):
            generate_answer(
                db=None,
                question="What is the refund policy?",
                user_id=1,
            )

        mock_groq.assert_not_called()
