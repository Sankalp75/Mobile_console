"""
Mobile Console — Main Server (Zero-dependency HTTP + WebSocket)
Works with ONLY Python stdlib + websockets + evdev. No aiohttp needed.

Architecture:
  - Python's built-in http.server serves the client files (HTML/CSS/JS)
  - websockets library handles the real-time WebSocket connection
  - Both run concurrently via asyncio
  - The HTTP server runs in a thread (it's synchronous but that's fine for
    serving static files — the hot path is WebSocket, not HTTP)
"""

import asyncio
import subprocess
import sys
import os
import platform
import threading
import json
import secrets
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from functools import partial

import websockets

from config import (
    PORT,
    WS_PORT,
    HOST,
    BIND_ADDRESS,
    ADB_COMMAND,
    ADB_PORT,
    ADB_WS_PORT,
    CLIENT_DIR,
    MSG_BUTTON,
    MSG_STICK,
    MSG_GYRO,
    MSG_GYRO_ON,
    MSG_GYRO_OFF,
    BTN_PRESSED,
    BTN_RELEASED,
    LOG_INPUTS,
    MAX_BUTTON_ID,
    MAX_STICK_ID,
    MIN_AXIS_VALUE,
    MAX_AXIS_VALUE,
)
from gamepad import create_gamepad


# ─── BANNER ──────────────────────────────────────────────────────────

BANNER = """
╔══════════════════════════════════════════════════╗
║                                                  ║
║   📱  M O B I L E   C O N S O L E  🎮           ║
║                                                  ║
║   Your phone is the controller.                  ║
║                                                  ║
╚══════════════════════════════════════════════════╝
"""


# ─── ADB SETUP ───────────────────────────────────────────────────────


def setup_adb():
    """
    Set up the USB tunnel using ADB reverse port forwarding.
    After this, localhost:3000 on the phone reaches the PC.
    """
    print("🔌 Setting up USB tunnel...")

    try:
        result = subprocess.run(
            [ADB_COMMAND, "devices", "-l"], capture_output=True, text=True, timeout=10
        )

        devices = []
        for line in result.stdout.strip().split("\n")[1:]:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "device":
                devices.append(parts[0])

        if not devices:
            print("⚠️  No Android device detected!")
            print("   Make sure:")
            print("   1. Your phone is plugged in via USB")
            print("   2. USB debugging is enabled on your phone")
            print("   3. You've authorized this PC on your phone")
            print()
            print("   Continuing anyway — WiFi mode or later USB connection will work.")
            return False

        print(f"   ✓ Found {len(devices)} device(s)")

        # Forward HTTP port
        subprocess.run(
            [ADB_COMMAND, "reverse", f"tcp:{ADB_PORT}", f"tcp:{ADB_PORT}"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        # Forward WebSocket port
        subprocess.run(
            [ADB_COMMAND, "reverse", f"tcp:{ADB_WS_PORT}", f"tcp:{ADB_WS_PORT}"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        print(f"   ✓ USB tunnel active: HTTP :{ADB_PORT} + WS :{ADB_WS_PORT}")
        return True

    except FileNotFoundError:
        os_name = platform.system()
        print("⚠️  ADB not found!")
        if os_name == "Linux":
            print("   Install with:")
            print("     Ubuntu/Debian: sudo apt install android-tools-adb")
            print("     Fedora:        sudo dnf install android-tools")
            print("     Arch:          sudo pacman -S android-tools")
        else:
            print("   Install Android SDK Platform Tools:")
            print("   https://developer.android.com/tools/releases/platform-tools")
        print()
        print("   Continuing without USB tunnel.")
        return False

    except subprocess.TimeoutExpired:
        print("⚠️  ADB timed out. Is your phone connected?")
        return False


# ─── HTTP SERVER (serves client files) ───────────────────────────────


class QuietHTTPHandler(SimpleHTTPRequestHandler):
    """
    Serves static files from the client directory.
    Quiet = no log spam in the terminal for every file request.
    """

    ws_port = None
    connect_code = None

    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        if QuietHTTPHandler.ws_port is not None:
            self.send_header("X-WS-Port", str(QuietHTTPHandler.ws_port))
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/config":
            config = {
                "wsPort": QuietHTTPHandler.ws_port,
                "connectCode": QuietHTTPHandler.connect_code,
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(config).encode())
            return
        if self.path.startswith("/api/verify/"):
            code = self.path.split("/")[-1]
            if code == QuietHTTPHandler.connect_code:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps(
                        {"valid": True, "wsPort": QuietHTTPHandler.ws_port}
                    ).encode()
                )
            else:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"valid": False}).encode())
            return
        super().do_GET()


def start_http_server(port, ws_port, directory):
    """
    Start the HTTP file server in a background thread.
    Serves the client/ directory so the phone can load the controller UI.
    """
    QuietHTTPHandler.ws_port = ws_port
    QuietHTTPHandler.connect_code = "".join(
        secrets.choice("0123456789") for _ in range(6)
    )
    handler = partial(QuietHTTPHandler, directory=str(directory))
    httpd = HTTPServer((BIND_ADDRESS, port), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


# ─── WEBSOCKET SERVER (real-time input) ──────────────────────────────


class WebSocketServer:
    """
    Handles real-time WebSocket connections from phones.
    Parses binary messages and routes them to the virtual gamepad.
    """

    def __init__(self, gamepad):
        self.gamepad = gamepad
        self.connected_clients = set()
        self._gyro_active = False

    async def handler(self, websocket):
        """Called for each new phone connection."""
        self.connected_clients.add(websocket)
        client = websocket.remote_address
        print(f"📱 Phone connected! ({client[0]}:{client[1]})")
        print(f"   → {len(self.connected_clients)} client(s) active")

        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    self._process_binary(message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.connected_clients.discard(websocket)
            self.gamepad.reset()
            print(f"📱 Phone disconnected. ({len(self.connected_clients)} remaining)")

    def _process_binary(self, data: bytes):
        """
        Parse binary messages from the phone.

        Protocol:
            Byte 0: type  (1=button, 2=stick, 3=gyro, 4=gyro_on, 5=gyro_off)
            Byte 1: id    (which button/stick)
            Byte 2: value (pressed/released, or axis position)
            Byte 3: (stick only) second axis value
        """
        if len(data) < 3:
            return

        msg_type = data[0]
        msg_id = data[1]
        msg_value = data[2]

        # Validate message type
        if msg_type not in VALID_MSG_TYPES:
            return

        if msg_type == MSG_BUTTON:
            # Validate button ID
            if msg_id > MAX_BUTTON_ID:
                return
            # Validate button value
            if msg_value not in (BTN_PRESSED, BTN_RELEASED):
                return
            if msg_value == BTN_PRESSED:
                self.gamepad.press_button(msg_id)
            else:
                self.gamepad.release_button(msg_id)

        elif msg_type == MSG_STICK:
            if len(data) < 4:
                return
            # Validate stick ID
            if msg_id > MAX_STICK_ID:
                return
            x_value = data[2]
            y_value = data[3]
            # Validate axis values
            x_value = max(MIN_AXIS_VALUE, min(MAX_AXIS_VALUE, x_value))
            y_value = max(MIN_AXIS_VALUE, min(MAX_AXIS_VALUE, y_value))
            if msg_id == 0:
                self.gamepad.set_left_stick(x_value, y_value)
            elif msg_id == 1 and not self._gyro_active:
                self.gamepad.set_right_stick(x_value, y_value)

        elif msg_type == MSG_GYRO_ON:
            self._gyro_active = True

        elif msg_type == MSG_GYRO_OFF:
            self._gyro_active = False
            self.gamepad.set_right_stick(CENTER_AXIS_VALUE, CENTER_AXIS_VALUE)

        elif msg_type == MSG_GYRO:
            if len(data) < 4:
                return
            x_value = max(MIN_AXIS_VALUE, min(MAX_AXIS_VALUE, data[2]))
            y_value = max(MIN_AXIS_VALUE, min(MAX_AXIS_VALUE, data[3]))
            self.gamepad.set_right_stick(x_value, y_value)

    async def send_vibration(self, pattern: str):
        """Send a vibration command to all connected phones."""
        message = json.dumps({"type": "vibrate", "pattern": pattern})
        disconnected = set()
        for ws in self.connected_clients:
            try:
                await ws.send(message)
            except Exception:
                disconnected.add(ws)
        self.connected_clients -= disconnected


# ─── MAIN ────────────────────────────────────────────────────────────


async def main():
    """Start everything."""
    print(BANNER)

    os_name = platform.system()
    print(f"🖥️  Platform: {os_name} ({platform.machine()})")
    print()

    # Step 1: ADB tunnel
    adb_ok = setup_adb()

    # Step 2: Virtual gamepad
    try:
        gamepad = create_gamepad()
    except (PermissionError, RuntimeError) as e:
        sys.exit(1)
    except Exception as e:
        print(f"❌ Failed to create virtual gamepad: {e}")
        if os_name == "Linux":
            print("\n   Fix: sudo modprobe uinput && sudo chmod 666 /dev/uinput")
            print("   Install: pip install evdev")
        sys.exit(1)

    # Step 3: Start HTTP server (serves client files)
    client_dir = Path(__file__).parent.parent / CLIENT_DIR
    if not client_dir.exists():
        print(f"❌ Client directory not found: {client_dir}")
        sys.exit(1)

    httpd = start_http_server(PORT, WS_PORT, client_dir)
    connect_code = QuietHTTPHandler.connect_code
    print(f"🌐 HTTP server running on port {PORT}")
    print(f"🔐 Connect Code: {connect_code}")
    print()

    # Step 4: Start WebSocket server
    ws_server = WebSocketServer(gamepad)

    async with websockets.serve(
        ws_server.handler,
        "0.0.0.0",
        WS_PORT,
        max_size=1024,  # We only send tiny binary messages
        ping_interval=20,  # Keep-alive pings every 20s
        ping_timeout=10,
    ) as server:
        print(f"🔌 WebSocket server running on port {WS_PORT}")
        print()
        print("   ┌───────────────────────────────────────────────┐")
        print(f"   │  On your phone, open Chrome and go to:        │")
        print(f"   │  → http://localhost:{PORT}                     │")
        print("   └───────────────────────────────────────────────┘")
        print()

        if adb_ok:
            print("   ✅ USB tunnel is active — connection will be instant!")
        else:
            print("   ⚠️  No USB tunnel — connect your phone and restart.")
        print()

        if os_name == "Linux":
            print("   💡 Test with: jstest /dev/input/js* or evtest")
            print()

        print("   Press Ctrl+C to stop.\n")

        # Keep running
        try:
            await asyncio.Future()  # Run forever
        except asyncio.CancelledError:
            pass
        finally:
            httpd.shutdown()
            gamepad.close()
            print("\n👋 Server stopped. See you next time!")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
