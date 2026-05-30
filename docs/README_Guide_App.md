# Underrated Locations Guide App

A Python application that finds and rates hidden gems near you using AI analysis. Supports both GLM OSS 120B and OpenRouter APIs.

## Features

- 🌍 **Location-based search** - Find underrated locations near any address
- 🤖 **AI-powered analysis** - Uses OpenRouter or GLM to determine if locations are underrated
- ⭐ **Smart rating system** - Scores locations based on various criteria
- 🏞️ **Multiple location types** - Rivers, viewpoints, parks, waterfalls, and more
- 📱 **User-friendly output** - Clean display with star ratings and descriptions
- 💾 **Export results** - Save findings to JSON file

## Requirements

- Python 3.7+
- API key (GLM OSS 120B or OpenRouter)
- Internet connection

## Installation

1. Install required packages:
```bash
pip install -r requirements.txt
```

2. Set up your API key:
   - **For OpenRouter version**:
     ```bash
     set OPENROUTER_API_KEY="your-openrouter-api-key"
     ```
   - **For GLM version**:
     ```bash
     set GLM_API_TOKEN="your-glm-api-token"
     ```

## Usage

### Using OpenRouter Version (Recommended):
```bash
python guide_app_openrouter.py
```

### Using GLM Version:
```bash
python guide_app.py
```

2. Enter your location when prompted (e.g., "New York, NY" or "123 Main St, City")

3. The app will:
   - Find nearby locations
   - Analyze each with GLM AI
   - Rate them as underrated
   - Display top results

## Location Types Analyzed

- **Natural Features**: Rivers, streams, waterfalls, lakes, ponds
- **Viewpoints**: Scenic overlooks, panoramas, vistas
- **Parks & Nature**: Gardens, forests, trails, nature reserves
- **Hidden Gems**: Less touristy spots with local significance

## Scoring System

Locations are scored 0-1 based on:
- Natural beauty and tranquility
- Lack of commercialization
- Distance from main tourist areas
- Local significance vs. popularity
- AI analysis from GLM

## Output Example

```
🌟 UNDERRATED LOCATIONS NEAR YOU 🌟

1. Hidden River Falls
   Category: Water
   Score: ⭐⭐⭐⭐⭐/5 (0.92)
   Distance: 1200m away
   Why it's underrated: Peaceful waterfall surrounded by forest, no tourist facilities
   Potential: High - stunning natural beauty away from crowds
----------------------------------------

2. Sunset Overlook
   Category: Viewpoint
   Score: ⭐⭐⭐⭐/5 (0.78)
   Distance: 800m away
   Why it's underrated: Unknown viewpoint with panoramic city views
   Potential: Moderate - great spot for photography
----------------------------------------
```

## API Rate Limits

The app includes built-in rate limiting to avoid overwhelming the GLM API:
- 1 second delay between API calls
- Handles API errors gracefully
- Falls back to basic analysis if API unavailable

## Files

- `guide_app.py` - Main application
- `requirements.txt` - Python dependencies
- `underrated_locations.json` - Output file with results

## Troubleshooting

1. **API Token Issues**:
   - Verify your GLM API token is valid
   - Check internet connection
   - Ensure token is properly set in code or environment variable

2. **Location Search Issues**:
   - Try entering a more specific address
   - Ensure location is recognized by OpenStreetMap
   - Check if search radius is appropriate

3. **No Results Found**:
   - Try increasing the search radius
   - Lower the minimum score threshold
   - Try different location types

## Contributing

Feel free to enhance the app by:
- Adding more location categories
- Improving the AI analysis prompts
- Adding additional data sources
- Creating a GUI interface