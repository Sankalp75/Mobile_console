<p align="center">
  <h1 align="center">Mobile Console</h1>
  <p align="center"><em>Your phone is the controller.</em></p>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/python-3.10%2B-blue" alt="Python 3.10+"></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Linux%20%7C%20Windows-blue" alt="Platform"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/contributions-welcome-brightgreen" alt="Contributions welcome"></a>
</p>

---

Every once in a while, something comes along that makes you wonder — why didn't this exist before?

You have a phone in your pocket. It has a screen. It knows when you touch it, tilt it, shake it. It vibrates. It has buttons on the side. It's more powerful than the computers that sent people to the moon.

And yet, when you want to play a game on your PC, you go buy a piece of plastic.

**We think that's absurd.**

---

## Features

- **Zero-latency USB connection** — <6ms response time, faster than Bluetooth controllers
- **Fully customizable layout** — place buttons anywhere, resize them, remap them
- **Gyroscope aiming** — tilt your phone to aim, just like a Steam Deck
- **Haptic feedback** — vibration motor fires on every press
- **Hardware volume buttons** — use as physical shoulder triggers
- **Multiple themes** — Xbox, Neon, Retro, Stealth
- **Profile system** — save/share/load layouts per game
- **Self-hosted & offline** — no cloud, no accounts, no telemetry
- **Cross-platform server** — Linux and Windows
- **No app install required** — runs in the phone's browser

## How It Works

```
Your finger → 📱 Phone (browser UI) → USB/ADB → 🖥️ PC Server → 🎮 Virtual Xbox Controller → Game
```

1. **Server** runs on your PC — creates a virtual Xbox 360 controller
2. **Client** loads in your phone's browser — renders a touch-based controller
3. **USB tunnel** (via ADB) carries binary input messages over the wire
4. **Games** see a standard Xbox 360 controller — no special driver needed

## Quick Start

### Prerequisites

- Python 3.10+
- Android phone with USB Debugging enabled
- USB cable

### Linux

```bash
# Load the virtual gamepad kernel module
sudo modprobe uinput
sudo chmod 666 /dev/uinput

# Install dependencies
pip install -r requirements.txt

# Install ADB
# Ubuntu/Debian: sudo apt install android-tools-adb
# Fedora:        sudo dnf install android-tools
# Arch:          sudo pacman -S android-tools

# Run the server
cd server && python main.py
```

### Windows

1. Install [ViGEmBus](https://github.com/nefarius/ViGEmBus/releases) and restart
2. Install [ADB Platform Tools](https://developer.android.com/tools/releases/platform-tools)
3. `pip install -r requirements.txt`
4. `cd server && python main.py`

### Phone Setup

1. **Settings → About Phone** → Tap **Build Number** 7 times (enables Developer Options)
2. **Settings → Developer Options** → Enable **USB Debugging**
3. Plug in phone via USB → tap **Allow**
4. Open **Chrome** → go to `http://localhost:3000`
5. Enter the 6-digit code shown in the server terminal
6. **Tap to Start** — controller appears 🎮

> The server automatically sets up ADB port forwarding. Your phone reaches the PC over USB.

## Project Structure

```
Mobile_console/
├── client/                  # Phone UI (HTML/CSS/JS)
│   ├── index.html           # Main controller page
│   ├── css/controller.css   # Styles + themes
│   └── js/
│       ├── app.js           # App logic & state
│       ├── websocket.js     # WebSocket connection
│       ├── layout.js        # Dynamic controller layout
│       ├── joystick.js      # Virtual joysticks
│       ├── sensors.js       # Gyroscope & accelerometer
│       ├── haptics.js       # Vibration feedback
│       └── themes.js        # UI theme system
├── server/                  # Python backend
│   ├── main.py              # Entry point — HTTP + WebSocket server
│   ├── config.py            # All configuration constants
│   ├── gamepad.py           # Gamepad factory (platform dispatch)
│   ├── gamepad_linux.py     # Linux uinput backend
│   ├── gamepad_windows.py   # Windows ViGEmBus backend
│   └── profile_validator.py # Profile JSON validation
├── profiles/                # Controller layout presets
│   └── default_xbox.json    # Default Xbox 360 layout
├── tests/                   # Unit tests
│   ├── test_core.py         # Core logic tests
│   └── test_security.py     # Security tests
├── docs/                    # Documentation
│   ├── architecture/        # System architecture docs
│   ├── api/                 # API reference
│   ├── protocols/           # Binary protocol spec
│   └── setup.md             # Detailed setup guide
├── requirements.txt         # Python dependencies
├── CONTRIBUTING.md          # Contribution guide
└── SECURITY.md              # Security policy
```

## Communication Protocol

Input is sent over WebSocket as **binary messages** (3-4 bytes):

| Byte 0 (Type) | Byte 1 (ID) | Byte 2 (Value) | Byte 3 (Stick Y) |
|---------------|-------------|-----------------|-------------------|
| `0x01` Button | 0-13 | `0` released / `1` pressed | — |
| `0x02` Stick  | 0-1  | X axis (0-255) | Y axis (0-255) |
| `0x03` Gyro   | —    | X axis (0-255) | Y axis (0-255) |
| `0x04` Gyro ON | —   | —              | — |
| `0x05` Gyro OFF | —  | —              | — |

Latency-critical path is 3 bytes per message — no JSON overhead, no negotiation.

## Testing

```bash
pip install -r requirements.txt
pytest tests/ -v
```

## Security

Mobile Console binds to localhost only. A 6-digit connect code prevents unauthorized access, with constant-time comparison and rate limiting (5 attempts). See [SECURITY.md](SECURITY.md) for full details.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

[MIT](LICENSE)

---

<p align="center">
  <strong>Your phone. Your layout. Your rules.</strong>
</p>

<p align="center">
  <em>Mobile Console — your phone is the controller.</em>
</p>

---

<p align="center">
  Made by <a href="https://github.com/Sankalp75">Sankalp</a>
</p>
