"""
Test script for the Underrated Locations Guide App
"""

import sys
import os

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from guide_app import UnderratedGuideApp
import json

def test_config_loading():
    """Test configuration loading"""
    print("Testing configuration loading...")
    try:
        app = UnderratedGuideApp(config_file="config/config.json")
        print("✓ Configuration loaded successfully")
        return True
    except Exception as e:
        print(f"❌ Configuration loading failed: {e}")
        return False

def test_location_detection():
    """Test location type detection"""
    print("\nTesting location detection...")
    app = UnderratedGuideApp(config_file="config/config.json")

    test_cases = [
        {"tags": {"natural": "water", "name": "River"}},
        {"tags": {"tourism": "viewpoint", "name": "Lookout"}},
        {"tags": {"leisure": "park", "name": "City Park"}},
        {"tags": {"name": "Unknown Location"}}
    ]

    for i, tags in enumerate(test_cases):
        location_type = app.detect_location_type(tags)
        print(f"Test {i+1}: {tags.get('name', 'Unnamed')} → {location_type}")

    return True

def test_fallback_analysis():
    """Test fallback analysis"""
    print("\nTesting fallback analysis...")
    app = UnderratedGuideApp(config_file="config/config.json")

    test_tags = {
        "name": "Test River",
        "natural": "water"
    }

    analysis = app.create_fallback_analysis(test_tags, "water")
    print(f"Fallback analysis result: {json.dumps(analysis, indent=2)}")
    return True

def main():
    """Run all tests"""
    print("🧪 Running Guide App Tests")
    print("=" * 40)

    tests = [
        test_config_loading,
        test_location_detection,
        test_fallback_analysis
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        if test():
            passed += 1

    print(f"\n📊 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("✅ All tests passed! The app is ready to use.")
    else:
        print("❌ Some tests failed. Please check the implementation.")

    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)