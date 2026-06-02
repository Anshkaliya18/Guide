"""Simple chatbot module for Earth Explorer.

This module provides a very lightweight chatbot interface. The original
implementation only echoed the user's message. To make the bot more useful
for the *Earth Explorer* application we add a helper that can resolve a user
query to a geographic location using the existing :class:`EarthExplorerEngine`
from ``guide_app``. The new ``find_location`` function is deliberately kept
independent of the ``get_response`` entry point to avoid circular imports –
the engine is imported lazily inside the function.

The chatbot can now be used in two ways:

* ``get_response(message)`` – simple echo behaviour (unchanged).
* ``find_location(message)`` – attempts to interpret ``message`` as a place
  name or coordinate pair and returns a human‑readable description of the
  location.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from guide_app import EarthExplorerEngine

from typing import Optional
import os
import json
import requests
import re
from pathlib import Path

def _load_env_file():
    current_dir = Path(__file__).resolve().parent
    for parent in (current_dir, current_dir.parent):
        env_path = parent / ".env"
        if env_path.is_file():
            try:
                with env_path.open("r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            k, v = line.split("=", 1)
                            os.environ[k.strip()] = v.strip().strip("'\"")
                break
            except Exception:
                pass

_load_env_file()


def get_response(message: str) -> str:
    """Generate a chatbot reply.

    1. **Location queries** – If the message looks like a place name or a pair of
       coordinates, we delegate to :func:`find_location` which uses the existing
       ``EarthExplorerEngine`` to perform a geocode lookup.
    2. **OpenRouter model** – When an ``OPENROUTER_API_KEY`` is present, the
       request is forwarded to the ``gpt-oss-120b`` model.
    3. **Fallback** – If no API key is set (or the request fails), a friendly
       default response is returned.
    """
    if not message:
        return "I didn't catch that. Could you say it again?"

    # Heuristic: treat messages containing a comma-separated pair of numbers as
    # coordinates, or messages longer than 3 characters as potential place names.
    coord_match = re.search(r"-?\d+(?:\.\d+)?\s*[ ,;]\s*-?\d+(?:\.\d+)?", message)
    if coord_match:
        # Attempt location lookup based on coordinates or place name.
        try:
            return find_location(message)
        except Exception:
            # If the lookup fails, fall back to normal processing.
            pass

    api_key = os.getenv("OPENROUTER_API_KEY")
    if api_key:
        # Call OpenRouter chat completion endpoint.
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Title": "EarthExplorerChatbot",
        }
        # Use the model name expected by OpenRouter. Some deployments accept
        # either the 'openrouter/...' prefix or the short name; try the
        # commonly used short name here.
        payload = {
            "model": "gpt-oss-120b",
            "messages": [{"role": "user", "content": message}],
            "temperature": 0.7,
            "max_tokens": 512,
        }
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            # Raise on HTTP error so we can surface a helpful message
            response.raise_for_status()
            data = response.json()

            # OpenRouter responses usually mirror OpenAI-style chat completions,
            # but different backends may vary. Try a few common shapes.
            # 1) choices[0].message.content
            # 2) choices[0].text
            # 3) data.get('reply')
            choices = data.get("choices") or []
            if choices:
                first = choices[0]
                # message.content
                if isinstance(first.get("message"), dict) and first["message"].get("content"):
                    return first["message"]["content"]
                if first.get("text"):
                    return first.get("text")

            # Fallback keys
            if data.get("reply"):
                return data.get("reply")
            if data.get("error"):
                return f"Chat API error: {data.get('error')}"

            # Nothing useful returned — give a helpful fallback including raw response for debugging
            return (data.get("choices", [{}])[0].get("message", {}).get("content")
                    or json.dumps(data)[:1000])
        except requests.HTTPError as exc:
            # Log the error details and fall back to the friendly default response
            try:
                body = response.text
            except Exception:
                body = str(exc)
            print(f"[Chatbot API Error] Status {getattr(response, 'status_code', '')}: {body}")
            return "I'm Earth Explorer's chatbot. Ask me about places, coordinates, or anything you need!"
        except Exception as exc:
            print(f"[Chatbot Error] {exc}")
            return "I'm Earth Explorer's chatbot. Ask me about places, coordinates, or anything you need!"


    # No API key – friendly default response.
    return "I'm Earth Explorer's chatbot. Ask me about places, coordinates, or anything you need!"


def _resolve_engine() -> "EarthExplorerEngine":
    """Import and instantiate :class:`EarthExplorerEngine` lazily.

    Importing ``guide_app`` at module load time would create a circular import
    because ``guide_app`` also imports ``get_response`` from this module. By
    performing the import inside a helper we break the cycle while keeping the
    function cheap to call – the import is cached by Python after the first
    execution.
    """
    try:
        # Local import to avoid circular dependency with ``guide_app``.
        from guide_app import EarthExplorerEngine  # type: ignore
    except Exception as exc:
        raise ImportError(
            "Failed to import EarthExplorerEngine from guide_app. "
            "Ensure that the src directory is on PYTHONPATH and that guide_app "
            "can be imported without side‑effects. Original error: {0}".format(exc)
        ) from exc
    return EarthExplorerEngine()


def find_location(message: str) -> str:
    """Resolve *message* to a geographic location.

    The function treats the incoming ``message`` as a free‑form location query –
    it can be a coordinate pair (e.g. ``"12.34,56.78"``) or a place name.
    It uses :meth:`EarthExplorerEngine.geocode_query` to perform the lookup.

    Returns a human‑readable string with the label and coordinates, or a clear
    error message when the location cannot be resolved.
    """
    if not message:
        return "No location query provided."

    engine = _resolve_engine()
    try:
        origin = engine.geocode_query(message)
    except Exception as exc:  # pragma: no cover – defensive, unexpected errors
        return f"Error while looking up location: {exc}"

    if origin is None:
        return "Location not found."

    # ``origin`` is a ``SearchOrigin`` dataclass with ``label``, ``lat`` and ``lng``.
    return (
        f"Location: {origin.label} (lat: {origin.lat:.5f}, lng: {origin.lng:.5f})"
    )
