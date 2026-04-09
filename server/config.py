"""
Mobile Console — Configuration
All constants and settings live here. One place to change everything.
"""

# ─── SERVER ──────────────────────────────────────────────────────────
PORT = 3000  # HTTP server — serves the controller UI
WS_PORT = PORT + 1  # WebSocket server — real-time input (8081)
HOST = "0.0.0.0"  # Listen on all network interfaces
CLIENT_DIR = "client"  # Folder with HTML/CSS/JS files served to phone

# ─── ADB ─────────────────────────────────────────────────────────────
ADB_COMMAND = "adb"  # Path to ADB executable (assumes it's in PATH)
ADB_PORT = PORT  # HTTP port forwarded over USB
ADB_WS_PORT = WS_PORT  # WebSocket port also forwarded over USB

# ─── BINARY PROTOCOL ────────────────────────────────────────────────
# Message types (byte 0)
MSG_BUTTON = 0x01  # A button was pressed or released
MSG_STICK = 0x02  # A joystick was moved (Phase 2)
MSG_GYRO = 0x03  # Gyroscope data (Phase 2)
MSG_GYRO_ON = 0x04  # Gyroscope aiming activated
MSG_GYRO_OFF = 0x05  # Gyroscope aiming deactivated

# Button IDs (byte 1) — maps to Xbox 360 controller buttons
# These numbers match what the phone sends in byte 1
BUTTON_MAP = {
    0: "A",
    1: "B",
    2: "X",
    3: "Y",
    4: "LB",  # Left bumper
    5: "RB",  # Right bumper
    6: "BACK",  # Back / Select
    7: "START",  # Start / Menu
    8: "L_THUMB",  # Left stick click
    9: "R_THUMB",  # Right stick click
    10: "DPAD_UP",
    11: "DPAD_DOWN",
    12: "DPAD_LEFT",
    13: "DPAD_RIGHT",
}

# Button values (byte 2)
BTN_PRESSED = 1
BTN_RELEASED = 0

# ─── LOGGING ─────────────────────────────────────────────────────────
LOG_INPUTS = False  # Set True to print every button press (debug)
