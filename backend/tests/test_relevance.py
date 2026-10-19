
import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.relevance_service import filter_relevant_chunks


CHUNKS = [
    {"text": "Refunds are available within 30 days.", "chunk_id": 1},
    {"text": "The office is located in Delhi.", "chunk_id": 2},
    {"text": "Contact support by email.", "chunk_id": 3},
]


def mock_response(content):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=content)
            )
        ]
    )


def test_empty_question_returns_empty_list():
    assert filter_relevant_chunks("   ", CHUNKS) == []


def test_empty_chunks_returns_empty_list():
    assert filter_relevant_chunks("Refund policy?", []) == []


def test_only_relevant_chunks_are_returned():
    with patch("app.relevance_service.Groq") as mock_groq:
        mock_groq.return_value.chat.completions.create.return_value = (
            mock_response('{"relevant_ids": [0, 2]}')
        )

        result = filter_relevant_chunks("How do I get a refund?", CHUNKS)

    assert result == [CHUNKS[0], CHUNKS[2]]


def test_no_relevant_chunks_returns_empty_list():
    with patch("app.relevance_service.Groq") as mock_groq:
        mock_groq.return_value.chat.completions.create.return_value = (
            mock_response('{"relevant_ids": []}')
        )

        result = filter_relevant_chunks("What is the refund policy?", CHUNKS)

    assert result == []


def test_invalid_json_raises_runtime_error():
    with patch("app.relevance_service.Groq") as mock_groq:
        mock_groq.return_value.chat.completions.create.return_value = (
            mock_response("not valid json")
        )

        with pytest.raises(RuntimeError, match="invalid JSON"):
            filter_relevant_chunks("Refund policy?", CHUNKS)


def test_invalid_relevant_ids_format_raises_runtime_error():
    with patch("app.relevance_service.Groq") as mock_groq:
        mock_groq.return_value.chat.completions.create.return_value = (
            mock_response('{"relevant_ids": "0"}')
        )

        with pytest.raises(RuntimeError, match="invalid format"):
            filter_relevant_chunks("Refund policy?", CHUNKS)


def test_out_of_range_and_boolean_ids_are_ignored():
    with patch("app.relevance_service.Groq") as mock_groq:
        mock_groq.return_value.chat.completions.create.return_value = (
            mock_response('{"relevant_ids": [0, 99, true, -1]}')
        )

        result = filter_relevant_chunks("Refund policy?", CHUNKS)

    assert result == [CHUNKS[0]]
