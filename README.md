# 🌟 Underrated Locations Guide App

A Python application that discovers and rates hidden gems (underrated locations) near you using AI-powered analysis and OpenStreetMap data.

## 📁 Project Structure

```
3d-earth-explorer/
├── src/                          # Main application code
│   └── guide_app.py             # Core application (OpenRouter API)
├── tests/                        # Test suite
│   └── test_guide_app.py        # Test scripts
├── config/                       # Configuration files
│   └── config.json              # API and app settings
├── web/                         # Web interface (optional)
│   ├── index.html              # Web page
│   ├── app.js                  # JavaScript logic
│   └── styles.css              # Styling
├── docs/                        # Documentation
│   └── README_Guide_App.md      # Detailed app documentation
├── .env                         # Environment variables (secrets)
├── requirements.txt             # Python dependencies
├── README.md                    # This file
└── .gitignore                   # Git ignore rules
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set Up API Key
Add your OpenRouter API key to `.env`:
```bash
OPENROUTER_API_KEY=your-openrouter-api-key-here
```

Or set environment variable:
```bash
# Windows
set OPENROUTER_API_KEY=your-key-here

# Linux/Mac
export OPENROUTER_API_KEY=your-key-here
```

### 3. Configure Settings (Optional)
Edit `config/config.json` to customize:
- API endpoint and model
- Search radius and minimum score threshold
- Location categories and boost factors

### 4. Run the Application
```bash
python src/guide_app.py
```

## 🧪 Testing

Run the test suite:
```bash
python tests/test_guide_app.py
```

## ⚙️ Configuration

### Main Configuration (`config/config.json`)
- **API Settings**: OpenRouter endpoint, model, temperature, max tokens
- **Search Settings**: Default radius, minimum score, max results
- **Categories**: Location types to search for
- **Boost Factors**: How to score different location categories

### Environment Variables (`.env`)
- `OPENROUTER_API_KEY`: Your OpenRouter API key (required)
- `DEFAULT_RADIUS`: Search radius in meters (default: 5000)
- `DEFAULT_MIN_SCORE`: Minimum underrated score (default: 0.6)
- `MAX_RESULTS`: Max locations to return (default: 10)

## 📚 Features

✨ **AI-Powered Analysis**: Uses OpenRouter API to intelligently identify underrated locations
🗺️ **OpenStreetMap Integration**: Searches nearby locations using Overpass API
📍 **Geocoding**: Converts addresses to coordinates using Nominatim
⭐ **Scoring System**: Rates locations based on multiple criteria
💾 **Results Export**: Saves findings to timestamped JSON files
🎯 **Customizable**: Configurable categories, scores, and API settings

## 🔧 Development

### File Organization
- **src/**: Production code
- **tests/**: Unit and integration tests
- **config/**: Configuration (versioned)
- **web/**: Optional web UI
- **docs/**: Documentation and guides

### Adding Tests
1. Add test functions to `tests/test_guide_app.py`
2. Run: `python tests/test_guide_app.py`
3. Check coverage and results

### Extending the App
- Add location type detection in `detect_location_type()`
- Modify scoring in `calculate_underrated_score()`
- Update categories in `config/config.json`

## 🐛 Troubleshooting

### 406 Not Acceptable Error
- **Cause**: Headers mismatch with Overpass API
- **Fix**: App automatically sends correct headers (User-Agent, Accept: application/json)

### API Key Not Found
- Verify `.env` file exists in project root
- Check `OPENROUTER_API_KEY` is set correctly
- Test with: `echo $env:OPENROUTER_API_KEY` (Windows)

### No Locations Found
- Try increasing search radius in config
- Check internet connection
- Verify location address is valid

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Make changes and test
3. Commit with clear message
4. Push and create pull request

## 📞 Support

For issues, questions, or suggestions, please:
1. Check existing documentation
2. Review test cases for examples
3. Open an issue with detailed description
