# Project Structure Guide

## Clean Organization

After reorganization, your project follows this professional structure:

```
3d-earth-explorer/
├── src/                          ← Production code
│   └── guide_app.py             ← Main application
│
├── tests/                        ← Test code
│   └── test_guide_app.py        ← Unit & integration tests
│
├── config/                       ← Configuration
│   └── config.json              ← API & app settings
│
├── web/                         ← Web interface (optional)
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── docs/                        ← Documentation
│   └── README_Guide_App.md      ← Detailed docs
│
├── archive/                     ← Old versions (if needed)
├── assets/                      ← Static assets
│
├── .env                         ← Secrets (gitignored)
├── requirements.txt             ← Dependencies
├── README.md                    ← Quick start guide
└── .gitignore                   ← Git rules
```

## How to Run

### From Project Root:
```bash
# Install dependencies
pip install -r requirements.txt

# Add API key to .env
# OPENROUTER_API_KEY=your-key-here

# Run application
python src/guide_app.py

# Run tests
python tests/test_guide_app.py
```

### From src/ Directory:
```bash
cd src
python guide_app.py
```

## Files Removed/Cleaned

- ✓ Old versions (guide_app_v2.py, guide_app_openrouter.py, etc.)
- ✓ Old setup scripts (setup_guide_app.py)
- ✓ __pycache__ directories
- ✓ .pyc compiled files

## Configuration References

| File | Path | Purpose |
|------|------|---------|
| Config | `config/config.json` | API settings, categories, scores |
| Env | `.env` | Secrets & local settings |
| Requirements | `requirements.txt` | Python dependencies |

## Tips

1. **Run from root**: `python src/guide_app.py`
2. **Add new tests**: Put in `tests/` directory
3. **Keep secrets safe**: Never commit `.env`
4. **Config changes**: Edit `config/config.json`
5. **New features**: Extend `src/guide_app.py`
