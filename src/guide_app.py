"""
Earth Explorer backend server with live geocoding and real OpenStreetMap results.

Run from the Guide/src folder:
    python guide_app.py

It serves the frontend from ../web and exposes:
    /api/health
    /api/geocode
    /api/reverse
    /api/search
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

import requests
from geopy.distance import geodesic

BASE_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = BASE_DIR / "web"
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

USER_AGENT = os.getenv(
    "EARTH_EXPLORER_USER_AGENT",
    "EarthExplorer/1.0 (OpenStreetMap geocoder + Overpass client)",
)

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

CATEGORY_ICONS = {
    "Tourism": "✦",
    "Historic": "⬡",
    "Nature": "🏔",
    "Park": "❋",
    "Museum": "▣",
    "Market": "◎",
    "Viewpoint": "◉",
    "Religious": "✧",
    "Other": "◌",
}

CATEGORY_PRIORITY = {
    "Viewpoint": 0,
    "Nature": 1,
    "Park": 2,
    "Museum": 3,
    "Historic": 4,
    "Market": 5,
    "Religious": 6,
    "Tourism": 7,
    "Other": 8,
}

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})


@dataclass
class SearchOrigin:
    label: str
    lat: float
    lng: float


def _json_safe(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return str(value)


def _parse_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _parse_int(value: Optional[str], default: int) -> int:
    parsed = _parse_float(value)
    if parsed is None:
        return default
    return max(1, int(parsed))


def _parse_coordinate_pair(text: str) -> Optional[Tuple[float, float]]:
    if not text:
        return None
    match = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$", text.strip())
    if not match:
        return None
    lat = float(match.group(1))
    lng = float(match.group(2))
    if -90 <= lat <= 90 and -180 <= lng <= 180:
        return lat, lng
    return None


def _coord_from_element(element: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    if "lat" in element and "lon" in element:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center") or {}
    if "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])
    return None


def _display_label_from_reverse(data: Dict[str, Any]) -> str:
    address = data.get("address") or {}
    pieces = [
        address.get("city") or address.get("town") or address.get("village") or address.get("hamlet"),
        address.get("county"),
        address.get("state") or address.get("region"),
        address.get("country"),
    ]
    return ", ".join([p for p in pieces if p]) or data.get("display_name") or "Selected location"


def _build_description(tags: Dict[str, Any], category: str) -> str:
    if tags.get("description"):
        return str(tags["description"])

    bits: List[str] = []
    if category == "Viewpoint":
        bits.append("Scenic viewpoint from OpenStreetMap")
    elif category == "Nature":
        bits.append("Natural place from OpenStreetMap")
    elif category == "Park":
        bits.append("Park or green space from OpenStreetMap")
    elif category == "Museum":
        bits.append("Museum or cultural point of interest")
    elif category == "Historic":
        bits.append("Historic place or heritage site")
    elif category == "Market":
        bits.append("Market or local trading spot")
    elif category == "Religious":
        bits.append("Religious site or place of worship")
    elif category == "Tourism":
        bits.append("Tourism point of interest")
    else:
        bits.append("OpenStreetMap point of interest")

    useful = []
    for key in ("tourism", "historic", "natural", "leisure", "amenity", "name"):
        if key in tags:
            useful.append(f"{key}={tags[key]}")
    if useful:
        bits.append(" • ".join(useful[:3]))
    return " — ".join(bits)


def _infer_category(tags: Dict[str, Any]) -> str:
    tourism = str(tags.get("tourism", "")).lower()
    historic = str(tags.get("historic", "")).lower()
    leisure = str(tags.get("leisure", "")).lower()
    natural = str(tags.get("natural", "")).lower()
    amenity = str(tags.get("amenity", "")).lower()
    religion = str(tags.get("religion", "")).lower()

    if tourism == "viewpoint" or "viewpoint" in tags or tourism == "lookout":
        return "Viewpoint"
    if natural in {"peak", "water", "tree", "wood", "spring", "cave", "beach", "bay", "scrub", "heath", "cliff"}:
        return "Nature"
    if leisure in {"park", "garden", "nature_reserve", "pitch", "playground"}:
        return "Park"
    if tourism in {"museum", "gallery", "attraction", "artwork"}:
        return "Museum"
    if historic:
        return "Historic"
    if amenity == "marketplace":
        return "Market"
    if amenity == "place_of_worship" or religion:
        return "Religious"
    if tourism:
        return "Tourism"
    return "Other"


def _category_matches(selected: Iterable[str], category: str) -> bool:
    selected_set = {s.strip().lower() for s in selected if s and str(s).strip()}
    if not selected_set:
        return True
    return category.lower() in selected_set or ("other" in selected_set and category == "Other")


class EarthExplorerEngine:
    def geocode_query(self, query: str) -> Optional[SearchOrigin]:
        coords = _parse_coordinate_pair(query)
        if coords:
            lat, lng = coords
            reverse = self.reverse_geocode(lat, lng)
            label = reverse.get("label") if reverse else f"{lat:.5f}, {lng:.5f}"
            return SearchOrigin(label=label, lat=lat, lng=lng)

        response = SESSION.get(
            NOMINATIM_SEARCH_URL,
            params={"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 1},
            timeout=25,
        )
        response.raise_for_status()
        items = response.json() or []
        if not items:
            return None

        item = items[0]
        lat = float(item["lat"])
        lng = float(item["lon"])
        label = item.get("display_name") or query
        return SearchOrigin(label=label, lat=lat, lng=lng)

    def reverse_geocode(self, lat: float, lng: float) -> Dict[str, Any]:
        response = SESSION.get(
            NOMINATIM_REVERSE_URL,
            params={"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 18, "addressdetails": 1},
            timeout=25,
        )
        response.raise_for_status()
        data = response.json() or {}
        return {
            "label": _display_label_from_reverse(data),
            "display_name": data.get("display_name") or "",
            "address": data.get("address") or {},
            "lat": lat,
            "lng": lng,
        }

    def search_locations(
        self,
        origin: SearchOrigin,
        radius_km: float = 15.0,
        categories: Optional[List[str]] = None,
        limit: int = 24,
    ) -> Dict[str, Any]:
        radius_m = int(max(1000.0, min(radius_km, 50.0) * 1000.0))
        categories = categories or []

        overpass_query = f"""
        [out:json][timeout:30];
        (
          node(around:{radius_m},{origin.lat},{origin.lng})["tourism"];
          way(around:{radius_m},{origin.lat},{origin.lng})["tourism"];
          relation(around:{radius_m},{origin.lat},{origin.lng})["tourism"];

          node(around:{radius_m},{origin.lat},{origin.lng})["historic"];
          way(around:{radius_m},{origin.lat},{origin.lng})["historic"];
          relation(around:{radius_m},{origin.lat},{origin.lng})["historic"];

          node(around:{radius_m},{origin.lat},{origin.lng})["leisure"];
          way(around:{radius_m},{origin.lat},{origin.lng})["leisure"];
          relation(around:{radius_m},{origin.lat},{origin.lng})["leisure"];

          node(around:{radius_m},{origin.lat},{origin.lng})["natural"];
          way(around:{radius_m},{origin.lat},{origin.lng})["natural"];
          relation(around:{radius_m},{origin.lat},{origin.lng})["natural"];

          node(around:{radius_m},{origin.lat},{origin.lng})["amenity"="marketplace"];
          way(around:{radius_m},{origin.lat},{origin.lng})["amenity"="marketplace"];
          relation(around:{radius_m},{origin.lat},{origin.lng})["amenity"="marketplace"];

          node(around:{radius_m},{origin.lat},{origin.lng})["amenity"="place_of_worship"];
          way(around:{radius_m},{origin.lat},{origin.lng})["amenity"="place_of_worship"];
          relation(around:{radius_m},{origin.lat},{origin.lng})["amenity"="place_of_worship"];
        );
        out center tags;
        """

        response = SESSION.post(OVERPASS_URL, data=overpass_query, timeout=45)
        response.raise_for_status()
        raw = response.json().get("elements", [])

        results: List[Dict[str, Any]] = []
        seen: set[str] = set()

        for element in raw:
            coords = _coord_from_element(element)
            if not coords:
                continue

            tags = element.get("tags") or {}
            category = _infer_category(tags)
            if not _category_matches(categories, category):
                continue

            name = (
                tags.get("name")
                or tags.get("official_name")
                or tags.get("alt_name")
                or tags.get("operator")
                or tags.get("brand")
                or tags.get("amenity")
                or tags.get("tourism")
                or "Unnamed place"
            )

            osm_type = str(element.get("type") or "")
            osm_id = str(element.get("id") or "")
            uid = f"{osm_type}:{osm_id}"
            if uid in seen:
                continue
            seen.add(uid)

            distance_km = geodesic((origin.lat, origin.lng), coords).kilometers
            score = 100.0 / (1.0 + distance_km)
            if category in {"Viewpoint", "Nature", "Park"}:
                score += 10
            if category in {"Historic", "Museum"}:
                score += 5

            results.append(
                {
                    "id": uid,
                    "name": name,
                    "category": category,
                    "icon": CATEGORY_ICONS.get(category, "◌"),
                    "distance_km": round(distance_km, 2),
                    "score": round(score, 2),
                    "lat": round(coords[0], 6),
                    "lng": round(coords[1], 6),
                    "desc": _build_description(tags, category),
                    "tags": _json_safe(tags),
                    "source": "OpenStreetMap / Overpass",
                    "osm_type": osm_type,
                    "osm_id": osm_id,
                }
            )

        results.sort(key=lambda item: (CATEGORY_PRIORITY.get(item["category"], 99), item["distance_km"], -item["score"]))
        return {
            "origin": {"label": origin.label, "lat": round(origin.lat, 6), "lng": round(origin.lng, 6)},
            "results": results[: max(1, limit)],
            "count": len(results),
            "radius_km": radius_km,
            "source": "OpenStreetMap / Nominatim / Overpass",
        }


engine = EarthExplorerEngine()


class EarthExplorerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._handle_api_get(parsed)
            return

        self.path = "/index.html" if parsed.path == "/" else parsed.path
        return super().do_GET()

    def _handle_api_get(self, parsed):
        params = parse_qs(parsed.query or "")
        path = parsed.path

        try:
            if path == "/api/health":
                self._send_json({"ok": True, "service": "earth-explorer"})
                return

            if path == "/api/geocode":
                query = (params.get("q") or params.get("query") or [""])[0].strip()
                if not query:
                    self._send_json({"error": "Missing q parameter"}, status=400)
                    return
                origin = engine.geocode_query(query)
                if not origin:
                    self._send_json({"error": "Location not found"}, status=404)
                    return
                reverse = engine.reverse_geocode(origin.lat, origin.lng)
                self._send_json(
                    {
                        "query": query,
                        "label": reverse.get("label") or origin.label,
                        "display_name": reverse.get("display_name") or origin.label,
                        "lat": origin.lat,
                        "lng": origin.lng,
                        "address": reverse.get("address") or {},
                    }
                )
                return

            if path == "/api/reverse":
                lat = _parse_float((params.get("lat") or [None])[0])
                lng = _parse_float((params.get("lng") or [None])[0])
                if lat is None or lng is None:
                    self._send_json({"error": "Missing lat/lng"}, status=400)
                    return
                self._send_json(engine.reverse_geocode(lat, lng))
                return

            if path == "/api/search":
                query = (params.get("query") or params.get("q") or [""])[0].strip()
                lat = _parse_float((params.get("lat") or [None])[0])
                lng = _parse_float((params.get("lng") or [None])[0])
                radius_km = float((params.get("radius") or ["15"])[0] or 15)
                categories = [
                    part.strip()
                    for part in ((params.get("categories") or [""])[0]).split(",")
                    if part.strip()
                ]
                limit = _parse_int((params.get("limit") or ["24"])[0], 24)

                origin: Optional[SearchOrigin] = None
                resolved_from = "unknown"

                if query:
                    coords = _parse_coordinate_pair(query)
                    if coords:
                        lat, lng = coords
                        reverse = engine.reverse_geocode(lat, lng)
                        origin = SearchOrigin(reverse.get("label") or query, lat, lng)
                        resolved_from = "coordinates"
                    elif lat is None or lng is None:
                        origin = engine.geocode_query(query)
                        resolved_from = "geocode"
                    else:
                        reverse = engine.reverse_geocode(lat, lng)
                        origin = SearchOrigin(reverse.get("label") or query, lat, lng)
                        resolved_from = "geocode+coords"
                elif lat is not None and lng is not None:
                    reverse = engine.reverse_geocode(lat, lng)
                    origin = SearchOrigin(reverse.get("label") or "Selected location", lat, lng)
                    resolved_from = "coordinates"

                if origin is None:
                    self._send_json({"error": "Provide a city/place or coordinates"}, status=400)
                    return

                payload = engine.search_locations(origin, radius_km=radius_km, categories=categories, limit=limit)
                payload["query"] = query
                payload["resolved_from"] = resolved_from
                payload["categories"] = categories
                self._send_json(payload)
                return

            self._send_json({"error": "Unknown API endpoint"}, status=404)
        except requests.HTTPError as exc:
            self._send_json({"error": "Upstream service error", "detail": str(exc)}, status=502)
        except requests.RequestException as exc:
            self._send_json({"error": "Network error contacting maps services", "detail": str(exc)}, status=502)
        except Exception as exc:
            self._send_json({"error": "Server error", "detail": str(exc)}, status=500)

    def _send_json(self, data: Dict[str, Any], status: int = 200):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"[HTTP] {self.address_string()} - {format % args}")


def main():
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    os.chdir(WEB_DIR)
    server = ThreadingHTTPServer((HOST, PORT), EarthExplorerHandler)
    print(f"🌍 Earth Explorer running at http://{HOST}:{PORT}/")
    print(f"   Serving frontend from: {WEB_DIR}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
