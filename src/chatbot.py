"""
Professional travel/location agent for Earth Explorer / Hidden Location app.

This version improves input understanding and response quality.

Capabilities:
- Direct location lookup:
  - "where is alwar"
  - "red fort"
  - "28.6139, 77.2090"
- Travel suggestions:
  - "best place to visit in Rajasthan"
  - "hidden gems in Delhi"
  - "top things to see in Agra"
- Normal chatbot conversation
- Professional, detailed response style

Design goals:
- Better intent understanding
- Better extraction of the target place
- Better response quality
- Friendly but professional assistant tone
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional, Tuple
from pathlib import Path
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import json
import os
import re
import requests

if TYPE_CHECKING:
    from guide_app import EarthExplorerEngine


DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_OPENROUTER_MODEL = "openrouter/auto"
DEFAULT_OPENROUTER_RETRIES = 3
DEFAULT_OPENROUTER_TIMEOUT = 30

CHAT_SESSION = None


# -----------------------------------------------------------------------------
# Environment loading
# -----------------------------------------------------------------------------

def _load_env_file() -> None:
    current_dir = Path(__file__).resolve().parent
    for parent in (current_dir, current_dir.parent):
        env_path = parent / ".env"
        if env_path.is_file():
            try:
                with env_path.open("r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        key, value = line.split("=", 1)
                        os.environ[key.strip()] = value.strip().strip("'\"")
                break
            except Exception:
                pass


_load_env_file()


# -----------------------------------------------------------------------------
# HTTP session
# -----------------------------------------------------------------------------

def _build_retry_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=DEFAULT_OPENROUTER_RETRIES,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def _get_chat_session() -> requests.Session:
    global CHAT_SESSION
    if CHAT_SESSION is None:
        CHAT_SESSION = _build_retry_session()
    return CHAT_SESSION


# -----------------------------------------------------------------------------
# Text understanding helpers
# -----------------------------------------------------------------------------

_COORD_PATTERN = re.compile(
    r"(?P<lat>-?\d{1,2}(?:\.\d+)?)\s*[,\s;]\s*(?P<lng>-?\d{1,3}(?:\.\d+)?)"
)

_LOCATION_PREFIXES = (
    "where is ",
    "where's ",
    "tell me about ",
    "show me ",
    "find ",
    "locate ",
    "what is ",
    "what's ",
    "give me info on ",
    "information about ",
    "details about ",
    "best place in ",
    "best places in ",
    "top places in ",
    "hidden gems in ",
    "tourist places in ",
    "places to visit in ",
)

_CHAT_PHRASES = {
    "hi",
    "hello",
    "hey",
    "thanks",
    "thank you",
    "good morning",
    "good evening",
    "who are you",
    "what can you do",
    "help",
}

_TRAVEL_HINTS = [
    "travel",
    "trip",
    "tour",
    "visit",
    "places",
    "location",
    "map",
    "coordinates",
    "hidden gem",
    "hidden gems",
    "best place",
    "best places",
    "top place",
    "top places",
    "recommended",
    "recommend",
    "near",
    "around",
    "historical",
    "monument",
    "fort",
    "palace",
    "temple",
    "beach",
    "lake",
    "museum",
    "park",
    "city",
    "town",
    "district",
]


def _normalize_text(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^\w\s,;.-]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _is_coordinates(message: str) -> bool:
    return bool(_COORD_PATTERN.search(message or ""))


def _extract_coordinate_pair(message: str) -> Optional[Tuple[float, float]]:
    match = _COORD_PATTERN.search(message or "")
    if not match:
        return None
    try:
        lat = float(match.group("lat"))
        lng = float(match.group("lng"))
        return lat, lng
    except Exception:
        return None


def _strip_location_prefix(message: str) -> str:
    text = _normalize_text(message)
    for prefix in _LOCATION_PREFIXES:
        if text.startswith(prefix):
            return text[len(prefix):].strip(" ?.!,-")
    return text


def _is_plain_place_name(message: str) -> bool:
    """
    Detect messages like:
    - "Alwar"
    - "Red Fort"
    - "Taj Mahal"
    """
    text = _normalize_text(message)
    if not text:
        return False

    if text in _CHAT_PHRASES:
        return False

    if _is_coordinates(text):
        return True

    words = text.split()
    if 1 <= len(words) <= 5 and len(text) <= 60:
        # Avoid broad conversation text being mistaken for place names.
        if any(q in text for q in [" how ", " why ", " when ", " what ", " chat "]):
            return False
        return True

    return False


def _detect_intent(message: str) -> str:
    """
    Returns one of:
    - location_lookup
    - travel_recommendation
    - normal_chat
    """
    text = _normalize_text(message)

    if not text:
        return "normal_chat"

    if _is_coordinates(text):
        return "location_lookup"

    if any(text.startswith(prefix) for prefix in _LOCATION_PREFIXES):
        if text.startswith(("best place in ", "best places in ", "top places in ", "hidden gems in ", "tourist places in ", "places to visit in ")):
            return "travel_recommendation"
        return "location_lookup"

    if _is_plain_place_name(text):
        return "location_lookup"

    if any(hint in text for hint in _TRAVEL_HINTS):
        return "travel_recommendation"

    return "normal_chat"


def _extract_target_place(message: str) -> str:
    """
    Extracts the main target place from the user query.
    Examples:
      "where is alwar" -> "alwar"
      "best places in jaipur" -> "jaipur"
      "tell me about red fort" -> "red fort"
      "red fort" -> "red fort"
    """
    text = _normalize_text(message)

    for prefix in _LOCATION_PREFIXES:
        if text.startswith(prefix):
            return text[len(prefix):].strip(" ?.!,-")

    return text


# -----------------------------------------------------------------------------
# Engine loading
# -----------------------------------------------------------------------------

def _load_engine() -> "EarthExplorerEngine":
    try:
        from guide_app import EarthExplorerEngine  # type: ignore
    except Exception as exc:
        raise ImportError(
            "Could not import EarthExplorerEngine from guide_app. "
            f"Original error: {exc}"
        ) from exc
    return EarthExplorerEngine()


def find_location(message: str) -> str:
    """
    Resolve a place name or coordinate query using EarthExplorerEngine.
    """
    if not message or not message.strip():
        return "No location query provided."

    engine = _load_engine()
    target = _strip_location_prefix(message)

    try:
        origin = engine.geocode_query(target)
    except Exception as exc:
        return f"Error while looking up location: {exc}"

    if origin is None:
        return (
            "I could not find that location. Try a clearer place name "
            "or coordinates like '28.6139, 77.2090'."
        )

    label = getattr(origin, "label", "Unknown location")
    lat = getattr(origin, "lat", None)
    lng = getattr(origin, "lng", None)

    if lat is None or lng is None:
        return f"Location found: {label}"

    return (
        f"Location found: {label}\n"
        f"Coordinates: {lat:.5f}, {lng:.5f}"
    )


# -----------------------------------------------------------------------------
# Response style
# -----------------------------------------------------------------------------

def _system_prompt() -> str:
    return (
        "You are Earth Explorer, a professional travel and location assistant.\n"
        "\n"
        "Your job is to help users explore places in a smart, polished, and clear way.\n"
        "\n"
        "You should handle:\n"
        "- place names\n"
        "- location lookups\n"
        "- travel recommendations\n"
        "- hidden gems\n"
        "- city guides\n"
        "- tourist spots\n"
        "- coordinates and map-related questions\n"
        "- normal conversation when the user is not asking for a location\n"
        "\n"
        "Response style:\n"
        "- professional\n"
        "- detailed but readable\n"
        "- confident but not over-verbose\n"
        "- helpful like a travel guide agent\n"
        "\n"
        "When the user asks about a place, structure the answer clearly.\n"
        "When the user asks for recommendations, give the best options and explain briefly why.\n"
        "If the user says only a place name, treat it as a location lookup request.\n"
        "If the user says 'where is <place>', return a location-style answer.\n"
        "If the query is travel-related, answer as a travel expert.\n"
        "Do not be robotic.\n"
    )


def _format_agent_reply(raw: str) -> str:
    """
    Makes the model response feel more agent-like if it returns plain text.
    """
    text = raw.strip()
    if not text:
        return raw

    # Light cleanup only. We keep the model's content intact.
    return text


# -----------------------------------------------------------------------------
# OpenRouter chat
# -----------------------------------------------------------------------------

def _call_openrouter(message: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return ""

    base_url = os.getenv("OPENROUTER_BASE_URL", DEFAULT_OPENROUTER_BASE_URL).rstrip("/")
    model_name = os.getenv("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL)
    temperature = float(os.getenv("OPENROUTER_TEMPERATURE", "0.7"))
    max_tokens = int(os.getenv("OPENROUTER_MAX_TOKENS", "800"))

    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Title": "EarthExplorerChatbot",
    }
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": message},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    try:
        response = _get_chat_session().post(
            url,
            headers=headers,
            json=payload,
            timeout=DEFAULT_OPENROUTER_TIMEOUT,
        )
        response.raise_for_status()

        try:
            data = response.json()
        except ValueError:
            return response.text.strip()

        choices = data.get("choices") or []
        if choices:
            first = choices[0] 
            msg = first.get("message")
            if isinstance(msg, dict) and msg.get("content"):
                return _format_agent_reply(str(msg["content"]))
            if first.get("text"):
                return _format_agent_reply(str(first["text"]))

        if data.get("reply"):
            return _format_agent_reply(str(data["reply"]))

        if data.get("error"):
            return f"Chat API error: {data.get('error')}"

        return json.dumps(data)[:2000]

    except Exception as exc:
        print(f"[Chatbot Error] {exc}")
        return ""


# -----------------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------------

def get_response(message: str) -> str:
    """
    Main chatbot entry point.

    Behavior:
    1. If the user is asking for a location, resolve it directly.
    2. If the user is asking for travel advice or recommendations, use the agent.
    3. Otherwise, answer as a normal chatbot.
    """
    if not message or not message.strip():
        return "Please send a message."

    text = message.strip()
    intent = _detect_intent(text)

    if intent == "location_lookup":
        try:
            return find_location(text)
        except Exception:
            pass

    reply = _call_openrouter(text)
    if reply:
        return reply

    # Fallbacks when API is missing or unavailable
    if intent == "travel_recommendation":
        return (
            "I can help with travel recommendations, hidden gems, and city guides. "
            "Try asking something like: 'best places in Jaipur' or 'hidden gems in Rajasthan'."
        )

    if intent == "location_lookup":
        return (
            "I can help find that place, but the location service is currently unavailable. "
            "Try again with a clearer place name or coordinates."
        )

    return (
        "I'm Earth Explorer, your travel and location assistant. "
        "Ask me about a place, a hidden gem, a city to visit, or anything travel-related."
    )


def is_location_query(message: str) -> bool:
    """
    Optional helper for frontend use.
    """
    return _detect_intent(message) == "location_lookup"


def classify_query(message: str) -> str:
    """
    Optional helper if your UI wants to show what kind of question the user asked.
    """
    return _detect_intent(message)