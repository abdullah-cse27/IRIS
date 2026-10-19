
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from groq import RateLimitError

from app.main import app
from app.auth import get_current_user
from app.models import User


def fake_current_user():
    return User(
        id=1,
        # Add any other required User fields here if your model needs them.
    )


def test_chat_returns_503_on_groq_rate_limit():
    app.dependency_overrides[get_current_user] = fake_current_user

    try:
        with patch("app.main.Groq") as mock_groq:
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

            response = TestClient(app).post(
                "/chat",
                json={"question": "Hello IRIS", "history": []},
            )

        assert response.status_code == 503
        assert response.json()["detail"] == (
            "The AI service is temporarily unavailable."
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_chat_returns_500_on_unexpected_error():
    app.dependency_overrides[get_current_user] = fake_current_user

    try:
        with patch("app.main.Groq") as mock_groq:
            mock_groq.return_value.chat.completions.create.side_effect = (
                RuntimeError("Simulated unexpected error")
            )

            response = TestClient(app).post(
                "/chat",
                json={"question": "Hello IRIS", "history": []},
            )

        assert response.status_code == 500
        assert response.json()["detail"] == (
            "An unexpected error occurred while generating the response."
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
