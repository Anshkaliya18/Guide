# 🌟 Underrated Locations Guide App

> **Discover hidden gems near you using AI-powered location analysis**

A Python application that intelligently identifies and rates underrated locations (hidden gems) in your area using OpenRouter API for AI analysis and OpenStreetMap for location data.

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)

---

## 📋 Table of Contents

- [Features](#-features)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)
- [Testing](#-testing)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [API Reference](#-api-reference)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

- **🤖 AI-Powered Analysis** - Uses OpenRouter API with advanced LLMs to intelligently identify underrated locations
- **🗺️ OpenStreetMap Integration** - Searches nearby POIs using Overpass API
- **📍 Smart Geocoding** - Converts addresses to coordinates with Nominatim
- **⭐ Dynamic Scoring** - Rates locations based on multiple criteria (visibility, tags, category)
- **💾 Result Export** - Saves findings to timestamped JSON with metadata
- **⚙️ Highly Configurable** - Customize categories, scoring, and API settings
- **🧪 Comprehensive Tests** - Includes unit tests and integration tests
- **📡 Error Handling** - Robust error recovery with fallback analysis

---

## 📦 Requirements

- **Python**: 3.8 or higher
- **OS**: Windows, macOS, or Linux
- **API Key**: OpenRouter account (free tier available)
- **Internet**: Required for API calls

### Python Dependencies
See [requirements.txt](requirements.txt) for full list:
- `requests` - HTTP client
- `geopy` - Geocoding & distance calculation
- `python-dotenv` - Environment variable management

---

## 🚀 Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/yourusername/3d-earth-explorer.git
cd 3d-earth-explorer
```

### Step 2: Create Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Get API Key
1. Sign up at [OpenRouter](https://openrouter.ai)
2. Copy your API key from the dashboard

### Step 5: Configure API Key
Create/edit `.env` file in project root:
```env
OPENROUTER_API_KEY=your-actual-api-key-here
```

**Alternative**: Set as environment variable
```bash
# Windows (PowerShell)
$env:OPENROUTER_API_KEY="your-key-here"

# Windows (CMD)
set OPENROUTER_API_KEY=your-key-here

# macOS/Linux
export OPENROUTER_API_KEY=your-key-here
```

---

## ⚡ Quick Start

### Run Application
```bash
python src/guide_app.py
```

### Follow Prompts
```
📍 Enter your location (address or city): San Francisco
🔍 Search radius in meters (default 5000): [press Enter or type 5000]
⭐ Minimum score (0-1, default 0.6): [press Enter or type 0.6]
```

### View Results
- Displays top underrated locations found
- Shows location name, category, score, and distance
- Automatically saves results to timestamped JSON file

### Example Output
```
🌟 TOP UNDERRATED LOCATIONS NEAR YOU 🌟
==============================================================================

1. Hidden River Trail
   🏞️  Category: Water
   ⭐⭐⭐⭐ Score: 0.85/1.0
   📍 Distance: 2.3km away
   💡 Why underrated: Natural waterfall with minimal tourism infrastructure
   🌟 Potential: Excellent discovery opportunity
```

---

## 🎯 Usage Examples

### Example 1: Find hidden gems in your city
```bash
python src/guide_app.py
# Enter: New York
# Radius: 3000 (3km)
# Min Score: 0.7
```

### Example 2: Explore wider area
```bash
python src/guide_app.py
# Enter: Los Angeles
# Radius: 10000 (10km)
# Min Score: 0.5
```

### Example 3: Use in Python code
```python
import sys
sys.path.insert(0, 'src')
from guide_app import UnderratedGuideApp

app = UnderratedGuideApp(api_key="your-key")
locations = app.find_underrated_locations(
    user_address="Seattle",
    radius=5000,
    min_score=0.6
)

for loc in locations:
    print(f"{loc['name']}: {loc['score']:.2f} ({loc['distance']:.0f}m away)")
```

---

## 📁 Project Structure

```
3d-earth-explorer/
├── src/
│   └── guide_app.py              # Main application (OpenRouter API)
│
├── tests/
│   └── test_guide_app.py         # Unit & integration tests
│
├── config/
│   └── config.json               # API settings & categories
│
├── web/
│   ├── index.html                # Web interface (optional)
│   ├── app.js                    # JavaScript logic
│   └── styles.css                # Styling
│
├── docs/
│   └── README_Guide_App.md        # Detailed documentation
│
├── .env                          # Environment variables (secrets)
├── .gitignore                    # Git ignore rules
├── requirements.txt              # Python dependencies
├── README.md                     # This file
├── STRUCTURE.md                  # Structure reference
└── GIT_PUSH_CHECKLIST.md         # Git push guide
```

**Directory Purposes:**
- **src/** - Production code (main application logic)
- **tests/** - Test suite (unit & integration tests)
- **config/** - Configuration files (API settings, categories)
- **web/** - Web UI files (optional frontend)
- **docs/** - Additional documentation

---

## ⚙️ Configuration

### config/config.json

```json
{
  "api": {
    "provider": "openrouter",
    "base_url": "https://openrouter.ai/api/v1",
    "model": "openai/gpt-4-turbo-preview",
    "temperature": 0.3,
    "max_tokens": 500,
    "headers": {
      "HTTP-Referer": "https://your-site.com",
      "X-Title": "Underrated Locations Guide"
    }
  },
  "search_settings": {
    "default_radius": 5000,
    "default_min_score": 0.6,
    "max_results": 10
  },
  "categories": {
    "natural_sights": ["river", "waterfall", "lake", "peak"],
    "viewpoints": ["viewpoint", "lookout", "vista"],
    "water_features": ["river", "waterfall", "lake"],
    "hidden_gems": ["park", "garden", "trail", "beach"]
  },
  "boost_factors": {
    "natural": 0.1,
    "water": 0.15,
    "viewpoint": 0.12,
    "hidden_gem": 0.2
  }
}
```

**Key Settings:**
| Setting | Default | Purpose |
|---------|---------|---------|
| `default_radius` | 5000m | Search area size |
| `default_min_score` | 0.6 | Quality threshold |
| `max_results` | 10 | Results limit |
| `temperature` | 0.3 | AI creativity (0=deterministic, 1=creative) |
| `max_tokens` | 500 | Response length |

### .env File

```env
# OpenRouter API Configuration
OPENROUTER_API_KEY=sk_your_key_here

# Optional: Override defaults
DEFAULT_RADIUS=5000
DEFAULT_MIN_SCORE=0.6
MAX_RESULTS=10
```

---

## 🧪 Testing

### Run All Tests
```bash
python tests/test_guide_app.py
```

### Expected Output
```
🧪 Running Guide App Tests
========================================
Testing configuration loading...
✓ Configuration loaded successfully

Testing location detection...
Test 1: River → water
Test 2: Lookout → viewpoint

Testing fallback analysis...
✓ Analysis completed

📊 Test Results: 3/3 tests passed
✅ All tests passed! The app is ready to use.
```

### Test Coverage
- ✅ Configuration loading
- ✅ Location type detection
- ✅ Fallback analysis (when API fails)
- ✅ Scoring calculations
- ✅ Geocoding

---

## 🔧 Development

### Adding New Features

#### 1. Add Location Category
Edit `config/config.json`:
```json
"categories": {
  "new_category": ["tag1", "tag2", "tag3"]
}
```

#### 2. Modify Scoring Logic
Edit `src/guide_app.py`, function `calculate_underrated_score()`:
```python
def calculate_underrated_score(self, location_data, analysis):
    # Your scoring logic here
    return score
```

#### 3. Extend Tests
Add test function to `tests/test_guide_app.py`:
```python
def test_new_feature():
    """Test description"""
    app = UnderratedGuideApp()
    # Your test code
    assert result == expected
```

### Code Standards
- Follow PEP 8 style guide
- Add docstrings to all functions
- Keep functions focused (<50 lines)
- Use type hints where possible
- Comment complex logic

---

## 🐛 Troubleshooting

### ❌ 406 Not Acceptable Error
**Cause:** Overpass API header mismatch  
**Solution:** App automatically sends correct headers
```python
# Already included:
headers = {
    "User-Agent": "UnderratedGuideApp/1.0",
    "Accept": "application/json"
}
```

### ❌ API Key Not Found
**Check 1:** Verify `.env` exists in project root
```bash
ls .env  # or: dir .env (Windows)
```

**Check 2:** Verify API key is set
```bash
echo $env:OPENROUTER_API_KEY  # Windows
echo $OPENROUTER_API_KEY       # macOS/Linux
```

**Check 3:** Verify key format (should start with `sk_`)

### ❌ No Locations Found
- Increase search radius (try 10000 instead of 5000)
- Lower minimum score threshold (try 0.4 instead of 0.6)
- Verify location address is valid
- Check internet connection

### ❌ Unicode/Emoji Errors
**Windows-specific:** UTF-8 encoding issue  
**Solution:** Already fixed with encoding wrapper in tests

### ❌ Module Import Errors
**Solution:** Ensure correct Python path
```python
import sys
sys.path.insert(0, 'src')
from guide_app import UnderratedGuideApp
```

---

## 📚 API Reference

### UnderratedGuideApp Class

#### `__init__(api_key=None, config_file="config/config.json")`
Initialize the application.

```python
app = UnderratedGuideApp(api_key="your-key")
```

#### `find_underrated_locations(user_address, radius=5000, min_score=0.6)`
Main method to find locations.

```python
locations = app.find_underrated_locations(
    user_address="San Francisco",
    radius=5000,
    min_score=0.6
)
```

**Returns:** List of location dictionaries with:
- `name` - Location name
- `score` - Underrated score (0-1)
- `category` - Location type
- `distance` - Distance in meters
- `reason` - Why it's underrated
- `coordinates` - [latitude, longitude]

#### `display_results(locations)`
Display results in terminal.

```python
app.display_results(locations)
```

#### `save_to_file(locations, filename=None)`
Save results to JSON file.

```python
app.save_to_file(locations)  # Auto-generated filename
app.save_to_file(locations, "my_locations.json")
```

---

## 🤝 Contributing

### How to Contribute

1. **Fork Repository**
```bash
git clone https://github.com/yourusername/3d-earth-explorer.git
cd 3d-earth-explorer
```

2. **Create Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

3. **Make Changes & Test**
```bash
# Make your changes
python tests/test_guide_app.py  # Ensure tests pass
```

4. **Commit Changes**
```bash
git add -A
git commit -m "feat: add your feature description"
```

5. **Push & Create Pull Request**
```bash
git push origin feature/your-feature-name
# Then create PR on GitHub
```

### Contribution Guidelines
- Write clear, descriptive commit messages
- Add tests for new features
- Update documentation as needed
- Follow PEP 8 style guide
- Keep pull requests focused

### Report Issues
- Check [issues](https://github.com/yourusername/3d-earth-explorer/issues) first
- Provide reproducible steps
- Include error messages/logs
- Specify Python version & OS

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

### MIT License Summary
- ✅ Commercial use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ✅ Private use allowed
- ⚠️ No warranty provided
- ⚠️ License and copyright required

---

## 📞 Support & Resources

### Documentation
- [STRUCTURE.md](STRUCTURE.md) - Project structure guide
- [GIT_PUSH_CHECKLIST.md](GIT_PUSH_CHECKLIST.md) - Git workflow guide
- [docs/README_Guide_App.md](docs/README_Guide_App.md) - Detailed app docs

### External Resources
- [OpenRouter API Docs](https://openrouter.ai/docs)
- [Overpass API Docs](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Nominatim Docs](https://nominatim.org/release-docs/latest/)

### Get Help
1. Check [Troubleshooting](#-troubleshooting) section
2. Review [test cases](tests/test_guide_app.py) for examples
3. Read code comments in [src/guide_app.py](src/guide_app.py)
4. Open an [issue](https://github.com/yourusername/3d-earth-explorer/issues)

---

## 🎯 Roadmap

- [ ] Web UI implementation
- [ ] Database integration for caching
- [ ] Multi-language support
- [ ] Advanced filtering options
- [ ] User preferences/favorites
- [ ] Social sharing features
- [ ] Mobile app version

---

**Made with ❤️ for location explorers**

Last Updated: 2026-05-30 | Version: 1.0.0
