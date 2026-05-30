"""
Underrated Locations Guide App - OpenRouter Version
A Python application to find and rate hidden gems near you using OpenRouter API
"""

import requests
import json
import time
from typing import List, Dict, Optional
from geopy.distance import geodesic
from geopy.geocoders import Nominatim
import os
import sys

class UnderratedGuideApp:
    def __init__(self, api_key: str = None, config_file: str = "config/config.json"):
        """
        Initialize the Guide app with OpenRouter API key and configuration

        Args:
            api_key: Your OpenRouter API key
            config_file: Path to configuration JSON file
        """
        self.config = self.load_config(config_file)
        self.api_settings = self.config.get("api", {})
        self.search_settings = self.config.get("search_settings", {})
        self.categories = self.config.get("categories", {})
        self.boost_factors = self.config.get("boost_factors", {})

        self.api_key = api_key or self.api_settings.get("api_key") or self.config.get("api_key") or os.getenv("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError("OpenRouter API key is required. Set OPENROUTER_API_KEY or add api_key to config.json.")

        self.geolocator = Nominatim(user_agent="underrated-guide-openrouter")
        self.base_url = self.api_settings.get("base_url", "https://openrouter.ai/api/v1")
        self.model = self.api_settings.get("model", "openai/gpt-oss-120b:free")
        self.temperature = self.api_settings.get("temperature", 0.3)
        self.max_tokens = self.api_settings.get("max_tokens", 500)
        self.headers_config = self.api_settings.get("headers", {})

    def load_config(self, config_file: str) -> Dict:
        """Load configuration from JSON file."""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Warning: {config_file} not found, using defaults")
            return self.get_default_config()
        except json.JSONDecodeError as e:
            print(f"Error parsing {config_file}: {e}")
            return self.get_default_config()

    def get_default_config(self) -> Dict:
        """Return fallback configuration values."""
        return {
            "api": {
                "provider": "openrouter",
                "base_url": "https://openrouter.ai/api/v1",
                "model": "openai/gpt-oss-120b:free",
                "temperature": 0.3,
                "max_tokens": 500,
                "headers": {}
            },
            "search_settings": {
                "default_radius": 5000,
                "default_min_score": 0.6,
                "max_results": 10,
                    "rate_limit_pause": 2
            },
            "categories": {
                "natural_sights": ["river", "stream", "waterfall", "lake", "pond", "forest", "tree"],
                "viewpoints": ["viewpoint", "lookout", "panorama", "vista"],
                "water_features": ["river", "stream", "waterfall", "lake", "pond"],
                "hidden_gems": ["park", "garden", "nature", "trail", "beach", "cove"]
            },
            "boost_factors": {
                "natural": 0.1,
                "water": 0.15,
                "viewpoint": 0.12,
                "hidden_gem": 0.2
            }
        }

    def get_user_location(self, address: str) -> tuple:
        """Convert user address to coordinates."""
        try:
            print(f"📍 Geocoding: {address}")
            location = self.geolocator.geocode(address, timeout=10)
            if location:
                print(f"✓ Found coordinates: {location.latitude}, {location.longitude}")
                return (location.latitude, location.longitude)
            else:
                raise ValueError("Location not found")
        except Exception as e:
            print(f"❌ Error geocoding: {e}")
            return None

    def search_nearby_locations(self, user_coords: tuple, radius: int = 5000) -> List[Dict]:
        """Search for nearby locations using OpenStreetMap data."""
        overpass_url = "https://overpass-api.de/api/interpreter"

        # Build query for interesting locations
        overpass_query = f"""
        [out:json][timeout:25];
        (
          node["natural"~"({'|'.join(['water', 'tree', 'shrub', 'peak'])})"](around:{radius},{user_coords[0]},{user_coords[1]});
          node["tourism"~"({'|'.join(['viewpoint', 'picnic_site', 'attraction'])})"](around:{radius},{user_coords[0]},{user_coords[1]});
          node["leisure"~"({'|'.join(['park', 'garden', 'nature_reserve'])})"](around:{radius},{user_coords[0]},{user_coords[1]});
          way["natural"~"({'|'.join(['water', 'wood'])})"](around:{radius},{user_coords[0]},{user_coords[1]});
          relation["natural"~"({'|'.join(['water', 'wood'])})"](around:{radius},{user_coords[0]},{user_coords[1]});
        );
        out body;
        >;
        out skel qt;
        """

        try:
            print("📡 Searching OpenStreetMap...")
            # Build final headers with proper defaults
            final_headers = {
                "User-Agent": "UnderratedGuideApp/1.0 (Location discovery tool)",
                "Accept": "application/json",
            }
            # Add config headers but don't override critical ones
            for key, value in self.headers_config.items():
                if key.lower() not in ["user-agent", "accept"]:
                    final_headers[key] = value

            response = requests.post(
                overpass_url,
                data=overpass_query,
                headers=final_headers,
                timeout=30
            )
            response.raise_for_status()
            elements = response.json().get('elements', [])
            print(f"✓ Found {len(elements)} potential locations")
            # Respect optional rate‑limit pause from config (default 1 s)
            time.sleep(self.search_settings.get('rate_limit_pause', 1))
            return elements
        except requests.exceptions.HTTPError as http_err:
            if response.status_code == 406:
                print(f"❌ Overpass API rejected request (406). This usually means header mismatch.")
                print(f"   Response: {response.text[:200]}")
            else:
                print(f"❌ Overpass HTTP error: {http_err}")
            return []
        except Exception as e:
            print(f"❌ Error searching locations: {e}")
            return []

    def analyze_location_with_openrouter(self, location_data: Dict) -> Dict:
        """Use OpenRouter API to analyze if a location is underrated."""
        tags = location_data.get('tags', {})
        name = tags.get('name', 'Unnamed location')
        location_type = self.detect_location_type(tags)

        prompt = f"""
        Analyze this location and determine if it's underrated:

        **Location Name**: {name}
        **Location Type**: {location_type}
        **Tags**: {json.dumps(tags, indent=2)}

        **Criteria for being underrated**:
        1. Natural beauty without commercial development
        2. Scenic value not recognized by tourists
        3. Peaceful, uncrowded environment
        4. Local significance but not widely known
        5. Accessible but not advertised

        **Considerations**:
        - Fewer tags often indicate less discovery
        - Natural features are often underrated
        - Viewpoints with no reviews are likely hidden gems
        - Water features away from roads are usually peaceful

        Respond with a valid JSON object:
        {{
            "is_underrated": true/false,
            "rating": 0.0-1.0,
            "reason": "Brief explanation (2-3 sentences)",
            "category": "natural/viewpoint/water/hidden_gem/other",
            "potential_score": "Why people should discover this place",
            "tags_count": {len(tags)}
        }}
        """

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            # Add additional headers from config
            for key, value in self.headers_config.items():
                headers[key] = value

            data = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": self.temperature,
                "max_tokens": self.max_tokens
            }

            print(f"🤖 Analyzing {name} with OpenRouter...")
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )

            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError as http_err:
                print(f"❌ OpenRouter API HTTP error for {name}: {http_err} - {response.text}")
                return self.create_fallback_analysis(tags, location_type)

            try:
                result = response.json()
            except ValueError:
                print(f"❌ OpenRouter response was not valid JSON for {name}: {response.text}")
                return self.create_fallback_analysis(tags, location_type)

            choices = result.get('choices') or []
            if not choices or not isinstance(choices, list):
                print(f"❌ OpenRouter response missing choices for {name}: {result}")
                return self.create_fallback_analysis(tags, location_type)

            message = choices[0].get('message') if isinstance(choices[0], dict) else None
            if not message or 'content' not in message:
                print(f"❌ OpenRouter response missing message content for {name}: {result}")
                return self.create_fallback_analysis(tags, location_type)

            content = message['content']
            if isinstance(content, dict):
                return content

            try:
                return json.loads(content)
            except (json.JSONDecodeError, TypeError):
                print(f"⚠️ OpenRouter returned non-JSON response for {name}: {content}")
                return self.create_fallback_analysis(tags, location_type)

        except Exception as e:
            print(f"❌ OpenRouter API error for {name}: {e}")
            return self.create_fallback_analysis(tags, location_type)

    def create_fallback_analysis(self, tags: Dict, location_type: str) -> Dict:
        """Create fallback analysis when API fails."""
        tag_count = len(tags)
        is_underrated = tag_count < 5 or location_type in ['water', 'natural']

        return {
            "is_underrated": is_underrated,
            "rating": 0.7 if is_underrated else 0.4,
            "reason": f"{'Likely underrated' if is_underrated else 'Popular location'} based on features and tags",
            "category": location_type,
            "potential_score": "Good discovery potential" if is_underrated else "Well-known area",
            "tags_count": tag_count
        }

    def detect_location_type(self, tags: Dict) -> str:
        """Detect location type from tags."""
        tag_keys = tags.keys()

        if any(key in tag_keys for key in ['water', 'river', 'stream', 'waterfall', 'lake']):
            return 'water'
        if any(key in tag_keys for key in ['natural', 'tree', 'forest', 'peak']):
            return 'natural'
        if any(key in tag_keys for key in ['viewpoint', 'lookout', 'vista']):
            return 'viewpoint'
        if any(key in tag_keys for key in ['park', 'garden', 'leisure']):
            return 'hidden_gem'

        return 'other'

    def calculate_underrated_score(self, location_data: Dict, glm_analysis: Dict) -> float:
        """Calculate overall underrated score."""
        base_score = glm_analysis.get('rating', 0.5)
        category = glm_analysis.get('category', 'natural')
        tags_count = glm_analysis.get('tags_count', 0)

        boost = self.boost_factors.get(category, 0)

        if tags_count < 3:
            boost += 0.2
        elif tags_count < 5:
            boost += 0.1

        if category == 'water':
            boost += 0.1

        return min(1.0, base_score + boost)

    def find_underrated_locations(self, user_address: str, radius: int = None,
                                 min_score: float = None) -> List[Dict]:
        """Find and rate underrated locations near user."""
        radius = radius or self.search_settings.get("default_radius", 5000)
        min_score = min_score or self.search_settings.get("default_min_score", 0.6)

        print(f"\n🌟 Finding underrated locations near {user_address}...")
        print(f"📏 Search radius: {radius}m")
        print(f"⭐ Minimum score: {min_score}")

        user_coords = self.get_user_location(user_address)
        if not user_coords:
            return []

        locations = self.search_nearby_locations(user_coords, radius)
        if not locations:
            print("❌ No locations found in the search area")
            return []

        underrated_locations = []
        max_results = self.search_settings.get("max_results", 10)

        for i, location in enumerate(locations):
            if len(underrated_locations) >= max_results:
                break

            print(f"\n📍 Analyzing location {i+1}/{len(locations)}...")

            glm_analysis = self.analyze_location_with_openrouter(location)
            score = self.calculate_underrated_score(location, glm_analysis)

            if score >= min_score:
                location_coords = (
                    location.get('lat', location.get('center', {}).get('lat')),
                    location.get('lon', location.get('center', {}).get('lon'))
                )

                if location_coords[0] and location_coords[1]:
                    distance = geodesic(user_coords, location_coords).meters
                    tags = location.get('tags', {})

                    location_info = {
                        "name": tags.get('name', 'Unnamed location'),
                        "category": glm_analysis.get('category', 'unknown'),
                        "score": round(score, 2),
                        "distance": round(distance, 2),
                        "reason": glm_analysis.get('reason', 'No specific reason'),
                        "potential_score": glm_analysis.get('potential_score', ''),
                        "tags_count": glm_analysis.get('tags_count', 0),
                        "coordinates": location_coords,
                        "osm_id": location.get('id'),
                        "osm_type": location.get('type')
                    }

                    underrated_locations.append(location_info)
                    print(f"✓ Added: {location_info['name']} (Score: {score:.2f})")

            time.sleep(1)

        underrated_locations.sort(key=lambda x: x['score'], reverse=True)
        print(f"\n✓ Found {len(underrated_locations)} underrated locations")

        return underrated_locations

    def display_results(self, locations: List[Dict]):
        """Display results with enhanced formatting."""
        if not locations:
            print("\n❌ No underrated locations found matching your criteria.")
            return

        max_results = self.search_settings.get("max_results", 10)
        display_locations = locations[:max_results]

        print("\n" + "="*70)
        print("🌟 TOP UNDERRATED LOCATIONS NEAR YOU 🌟")
        print("="*70)

        for i, location in enumerate(display_locations, 1):
            stars = "⭐" * int(location['score'] * 5)
            distance = f"{location['distance']:.0f}m" if location['distance'] < 1000 else f"{location['distance']/1000:.1f}km"

            print(f"\n{i}. {location['name']}")
            print(f"   🏞️  Category: {location['category'].title()}")
            print(f"   {stars} Score: {location['score']:.2f}/1.0")
            print(f"   📍 Distance: {distance} away")
            print(f"   🏷️  OSM Tags: {location['tags_count']}")
            print(f"   💡 Why underrated: {location['reason']}")

            if location['potential_score']:
                print(f"   🌟 Potential: {location['potential_score']}")

            print("-" * 50)

    def save_to_file(self, locations: List[Dict], filename: str = None):
        """Save results to JSON with timestamp."""
        if not filename:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            filename = f"underrated_locations_{timestamp}.json"

        output_data = {
            "search_metadata": {
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "total_locations": len(locations),
                "api_used": "OpenRouter"
            },
            "locations": locations
        }

        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            print(f"\n💾 Results saved to: {filename}")
        except Exception as e:
            print(f"❌ Error saving file: {e}")


def main():
    """Main function."""
    print("🌍 Welcome to the Underrated Locations Guide App!")
    print("=" * 50)

    # Load API key from environment or config
    config = {}
    try:
        with open("config/config.json", 'r', encoding='utf-8') as f:
            config = json.load(f)
    except Exception:
        config = {}

    api_key = os.getenv("OPENROUTER_API_KEY") or config.get("api", {}).get("api_key") or config.get("api_key")

    if not api_key:
        print("\n⚠️ OpenRouter API key not found in environment variables or config.json")
        api_key = input("Enter your OpenRouter API key: ").strip()

    if not api_key:
        print("❌ API key is required to continue")
        return

    try:
        app = UnderratedGuideApp(api_key, "config/config.json")
    except ValueError as e:
        print(f"❌ {e}")
        return

    user_location = input("\n📍 Enter your location (address or city): ").strip()
    if not user_location:
        print("❌ Location cannot be empty")
        return

    try:
        radius_input = input("🔍 Search radius in meters (default 5000): ").strip()
        radius = int(radius_input) if radius_input else None
    except ValueError:
        print("⚠️ Invalid radius, using default")
        radius = None

    try:
        min_score_input = input("⭐ Minimum score (0-1, default 0.6): ").strip()
        min_score = float(min_score_input) if min_score_input else None
        if min_score is not None and (min_score < 0 or min_score > 1):
            print("⚠️ Score must be between 0 and 1, using default")
            min_score = None
    except ValueError:
        print("⚠️ Invalid score, using default")
        min_score = None

    print("\n" + "="*50)
    underrated = app.find_underrated_locations(
        user_address=user_location,
        radius=radius,
        min_score=min_score
    )

    app.display_results(underrated)
    if underrated:
        app.save_to_file(underrated)

    print("\n🎉 Thank you for using the Underrated Locations Guide!")


if __name__ == "__main__":
    main()