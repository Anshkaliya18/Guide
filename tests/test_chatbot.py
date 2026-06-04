import sys
import os
from unittest.mock import Mock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import pytest

from chatbot import CHAT_SESSION, get_response


def test_get_response_fallback_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    reply = get_response("Hello")
    assert "Earth Explorer's chatbot" in reply


def test_get_response_uses_model_override(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "fake-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "claude-3.1")

    mock_resp = Mock()
    mock_resp.raise_for_status = Mock()
    mock_resp.json.return_value = {"choices": [{"message": {"content": "Hello from Claude"}}]}

    with patch.object(CHAT_SESSION, "post", return_value=mock_resp) as post_mock:
        reply = get_response("Hi")

    assert reply == "Hello from Claude"
    assert post_mock.call_args[1]["json"]["model"] == "claude-3.1"


def test_get_response_handles_invalid_json(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "fake-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "claude-3.1")

    mock_resp = Mock()
    mock_resp.raise_for_status = Mock()
    mock_resp.json.side_effect = ValueError("Invalid JSON")
    mock_resp.text = "Service temporarily unavailable"

    with patch.object(CHAT_SESSION, "post", return_value=mock_resp):
        reply = get_response("Hi")

    assert "Service temporarily unavailable" in reply
