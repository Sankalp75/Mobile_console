# Contributing to Mobile Console

Thanks for your interest in contributing!

## Development Setup

1. Clone the repository
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `source venv/bin/activate` (Linux/macOS) or `venv\Scripts\activate` (Windows)
4. Install dependencies: `pip install -r requirements.txt`
5. Run the server: `cd server && python main.py`

## Code Style

- Python: Follow PEP 8, use type hints where helpful
- JavaScript: ES6+, prefer `const`/`let` over `var`
- Use meaningful variable names
- Add docstrings to public functions

## Project Structure

```
Mobile_console/
├── client/          # Web UI (HTML/CSS/JS)
│   ├── js/          # JavaScript modules
│   └── css/         # Styles
├── server/          # Python backend
│   ├── main.py      # Entry point
│   ├── config.py    # Constants and settings
│   ├── gamepad*.py  # Virtual controller backends
│   └── profile_validator.py  # Profile validation
├── profiles/        # Controller layouts
└── docs/            # Documentation
```

## Testing

Run tests with pytest:
```bash
pytest tests/
```

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a PR with a clear description

## Reporting Issues

- Use GitHub Issues
- Include OS, Python version, and steps to reproduce
- Attach logs if relevant