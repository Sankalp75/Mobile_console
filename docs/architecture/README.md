# Architecture Overview

Mobile Console turns your phone into a game controller for your PC. Here's how it works.

## The Big Picture

```
YOUR FINGER
    │
    ▼
📱 Phone Screen (Controller UI)
    │
    │  USB cable (ADB tunnel)
    ▼
🖥️ PC (Server)
    │
    ▼
🎮 Game (sees virtual Xbox controller)
```

## Components

| Component | Role | Location |
|-----------|------|----------|
| **Client** | Phone UI (HTML/CSS/JS) | `client/` |
| **Server** | Python backend, virtual gamepad | `server/` |
| **Profiles** | Controller layouts | `profiles/` |

## Client-Server Model

- **Client** (phone): Sends button presses, stick movements, gyro data
- **Server** (PC): Receives inputs, creates virtual gamepad, forwards to game
- **Communication**: WebSocket over USB (via ADB port forwarding)

## Key Design Decisions

1. **USB over WiFi**: Sub-millisecond latency vs 5-30ms on WiFi
2. **Binary protocol**: 3-4 bytes per message vs 60+ for JSON
3. **Virtual gamepad**: Games see a real Xbox 360 controller
4. **No app installation**: Runs in the browser

## Data Flow

```
Button Press:
  Phone (touch event)
    → WebSocket client (binary message)
    → USB tunnel
    → WebSocket server
    → Virtual gamepad (evdev/uinput)
    → Game receives input

Feedback:
  Game triggers vibration
    → Server detects event
    → WebSocket server sends command
    → Phone (Haptics API)
    → User feels vibration
```

## File Structure

```
Mobile_console/
├── client/           # Web UI
│   ├── index.html    # Main page
│   ├── css/          # Styles
│   └── js/           # JavaScript modules
│       ├── app.js        # Main app logic
│       ├── websocket.js  # Connection handling
│       ├── layout.js     # Controller layout
│       ├── sensors.js    # Gyro/accelerometer
│       ├── joystick.js   # Virtual joysticks
│       ├── haptics.js    # Vibration
│       └── themes.js     # UI themes
├── server/           # Python backend
│   ├── main.py           # Entry point
│   ├── config.py         # Configuration
│   ├── gamepad.py        # Factory
│   ├── gamepad_linux.py  # Linux backend
│   └── gamepad_windows.py # Windows backend
├── profiles/         # Controller layouts
└── docs/             # Documentation
```