"""
Mobile Console — Linux Virtual Gamepad
Creates a virtual Xbox-like controller using uinput (Linux kernel module).

How it works:
  1. The kernel module "uinput" lets userspace programs create virtual input devices
  2. python-evdev is the Python binding for uinput
  3. We define an Xbox 360-compatible device with buttons + axes
  4. Games see it as a real controller (works with Steam, SDL, etc.)

Prerequisites:
  - sudo modprobe uinput          (load the kernel module)
  - sudo chmod 666 /dev/uinput    (let non-root create devices)
  OR run the server with sudo
  OR add a udev rule (see docs/setup.md)
"""

import evdev
from evdev import UInput, ecodes, AbsInfo

from config import BUTTON_MAP, BTN_PRESSED, LOG_INPUTS


class VirtualGamepad:
    """
    Linux virtual gamepad using evdev/uinput.
    Games see this as a real Xbox-compatible controller.
    """

    # Map our button names to Linux evdev button codes
    # These codes are what Linux uses for Xbox 360 controllers
    # NOTE: evdev uses directional names (NORTH/EAST/SOUTH/WEST)
    # which correspond to face buttons: Y/B/A/X respectively
    _EVDEV_BUTTONS = {
        "A": ecodes.BTN_SOUTH,  # BTN_A - bottom face button
        "B": ecodes.BTN_EAST,  # BTN_B - right face button
        "X": ecodes.BTN_WEST,  # BTN_X - left face button
        "Y": ecodes.BTN_NORTH,  # BTN_Y - top face button
        "LB": ecodes.BTN_TL,  # Left bumper
        "RB": ecodes.BTN_TR,  # Right bumper
        "BACK": ecodes.BTN_SELECT,  # Back / Select
        "START": ecodes.BTN_START,  # Start / Menu
        "L_THUMB": ecodes.BTN_THUMBL,  # Left stick click
        "R_THUMB": ecodes.BTN_THUMBR,  # Right stick click
    }

    # D-Pad is handled via ABS_HAT0X / ABS_HAT0Y axes on Linux
    _DPAD_MAP = {
        "DPAD_UP": ("ABS_HAT0Y", -1),
        "DPAD_DOWN": ("ABS_HAT0Y", 1),
        "DPAD_LEFT": ("ABS_HAT0X", -1),
        "DPAD_RIGHT": ("ABS_HAT0X", 1),
    }

    def __init__(self):
        """Create the virtual gamepad device via uinput."""

        # Define the capabilities of our virtual controller:
        #   - Buttons: A B X Y LB RB BACK START L_THUMB R_THUMB
        #   - Axes: Left stick (X/Y), Right stick (RX/RY), Triggers (Z/RZ), D-pad hat
        capabilities = {
            # Button events
            ecodes.EV_KEY: [
                ecodes.BTN_SOUTH,  # A
                ecodes.BTN_EAST,  # B
                ecodes.BTN_WEST,  # X
                ecodes.BTN_NORTH,  # Y
                ecodes.BTN_TL,  # LB
                ecodes.BTN_TR,  # RB
                ecodes.BTN_SELECT,  # Back
                ecodes.BTN_START,  # Start
                ecodes.BTN_THUMBL,  # L Stick Click
                ecodes.BTN_THUMBR,  # R Stick Click
                ecodes.BTN_MODE,  # Guide/Home button
            ],
            # Absolute axes (sticks + triggers + d-pad)
            ecodes.EV_ABS: [
                # Left Stick X: -32768 to 32767 (center = 0)
                (
                    ecodes.ABS_X,
                    AbsInfo(
                        value=0, min=-32768, max=32767, fuzz=16, flat=128, resolution=0
                    ),
                ),
                # Left Stick Y
                (
                    ecodes.ABS_Y,
                    AbsInfo(
                        value=0, min=-32768, max=32767, fuzz=16, flat=128, resolution=0
                    ),
                ),
                # Right Stick X
                (
                    ecodes.ABS_RX,
                    AbsInfo(
                        value=0, min=-32768, max=32767, fuzz=16, flat=128, resolution=0
                    ),
                ),
                # Right Stick Y
                (
                    ecodes.ABS_RY,
                    AbsInfo(
                        value=0, min=-32768, max=32767, fuzz=16, flat=128, resolution=0
                    ),
                ),
                # Left Trigger (0 to 255)
                (
                    ecodes.ABS_Z,
                    AbsInfo(value=0, min=0, max=255, fuzz=0, flat=0, resolution=0),
                ),
                # Right Trigger (0 to 255)
                (
                    ecodes.ABS_RZ,
                    AbsInfo(value=0, min=0, max=255, fuzz=0, flat=0, resolution=0),
                ),
                # D-Pad X: -1 (left), 0 (center), 1 (right)
                (
                    ecodes.ABS_HAT0X,
                    AbsInfo(value=0, min=-1, max=1, fuzz=0, flat=0, resolution=0),
                ),
                # D-Pad Y: -1 (up), 0 (center), 1 (down)
                (
                    ecodes.ABS_HAT0Y,
                    AbsInfo(value=0, min=-1, max=1, fuzz=0, flat=0, resolution=0),
                ),
            ],
        }

        try:
            self.device = UInput(
                capabilities,
                name="Mobile Console Controller",
                vendor=0x045E,  # Microsoft vendor ID (Xbox controllers)
                product=0x028E,  # Xbox 360 controller product ID
                version=0x0110,
            )
        except PermissionError:
            raise PermissionError(
                "Cannot access /dev/uinput. Fix with one of:\n"
                "  1. sudo modprobe uinput && sudo chmod 666 /dev/uinput\n"
                "  2. Run this server with sudo\n"
                "  3. Add a udev rule (see docs/setup.md)"
            )

        # Track D-pad state for proper release handling
        self._dpad_state = {"ABS_HAT0X": 0, "ABS_HAT0Y": 0}
        self._dpad_axes = {"ABS_HAT0X": ecodes.ABS_HAT0X, "ABS_HAT0Y": ecodes.ABS_HAT0Y}

        print("🎮 Virtual controller created! (Linux/uinput)")
        print(f"   → Device: {self.device.device.path}")
        print(
            "   → Check with: cat /proc/bus/input/devices | grep -A5 'Mobile Console'"
        )

    def press_button(self, button_id: int):
        """Press a button on the virtual controller."""
        button_name = BUTTON_MAP.get(button_id)
        if button_name is None:
            return

        # D-Pad buttons are axes on Linux, not buttons
        if button_name in self._DPAD_MAP:
            axis_name, value = self._DPAD_MAP[button_name]
            axis_code = (
                ecodes.ABS_HAT0X if axis_name == "ABS_HAT0X" else ecodes.ABS_HAT0Y
            )
            self.device.write(ecodes.EV_ABS, axis_code, value)
            self.device.syn()
            self._dpad_state[axis_name] = value
        else:
            evdev_btn = self._EVDEV_BUTTONS.get(button_name)
            if evdev_btn is None:
                return
            self.device.write(ecodes.EV_KEY, evdev_btn, 1)  # 1 = pressed
            self.device.syn()

        if LOG_INPUTS:
            print(f"   ▶ {button_name} PRESSED")

    def release_button(self, button_id: int):
        """Release a button on the virtual controller."""
        button_name = BUTTON_MAP.get(button_id)
        if button_name is None:
            return

        if button_name in self._DPAD_MAP:
            axis_name, _ = self._DPAD_MAP[button_name]
            axis_code = (
                ecodes.ABS_HAT0X if axis_name == "ABS_HAT0X" else ecodes.ABS_HAT0Y
            )
            # Only reset to 0 if this direction was the last one pressed
            self.device.write(ecodes.EV_ABS, axis_code, 0)
            self.device.syn()
            self._dpad_state[axis_name] = 0
        else:
            evdev_btn = self._EVDEV_BUTTONS.get(button_name)
            if evdev_btn is None:
                return
            self.device.write(ecodes.EV_KEY, evdev_btn, 0)  # 0 = released
            self.device.syn()

        if LOG_INPUTS:
            print(f"   ■ {button_name} released")

    def set_left_stick(self, x: int, y: int):
        """
        Move the left analog stick.
        Args: x, y: 0-255 (128 = center)
        """
        # Convert 0-255 → -32768 to 32767
        vg_x = int((x / 255.0) * 65535 - 32768)
        vg_y = int((y / 255.0) * 65535 - 32768)
        self.device.write(ecodes.EV_ABS, ecodes.ABS_X, vg_x)
        self.device.write(ecodes.EV_ABS, ecodes.ABS_Y, vg_y)
        self.device.syn()

    def set_right_stick(self, x: int, y: int):
        """
        Move the right analog stick.
        Args: x, y: 0-255 (128 = center)
        """
        vg_x = int((x / 255.0) * 65535 - 32768)
        vg_y = int((y / 255.0) * 65535 - 32768)
        self.device.write(ecodes.EV_ABS, ecodes.ABS_RX, vg_x)
        self.device.write(ecodes.EV_ABS, ecodes.ABS_RY, vg_y)
        self.device.syn()

    def set_left_trigger(self, value: int):
        """Set left trigger pressure. value: 0-255."""
        self.device.write(ecodes.EV_ABS, ecodes.ABS_Z, max(0, min(255, value)))
        self.device.syn()

    def set_right_trigger(self, value: int):
        """Set right trigger pressure. value: 0-255."""
        self.device.write(ecodes.EV_ABS, ecodes.ABS_RZ, max(0, min(255, value)))
        self.device.syn()

    def reset(self):
        """Release all buttons and center all sticks."""
        for btn_code in self._EVDEV_BUTTONS.values():
            self.device.write(ecodes.EV_KEY, btn_code, 0)

        for axis in [ecodes.ABS_X, ecodes.ABS_Y, ecodes.ABS_RX, ecodes.ABS_RY]:
            self.device.write(ecodes.EV_ABS, axis, 0)

        self.device.write(ecodes.EV_ABS, ecodes.ABS_Z, 0)
        self.device.write(ecodes.EV_ABS, ecodes.ABS_RZ, 0)

        for axis_name in self._dpad_state:
            self.device.write(ecodes.EV_ABS, self._dpad_axes[axis_name], 0)
            self._dpad_state[axis_name] = 0

        self.device.syn()

    def close(self):
        """Clean up — destroy the virtual device."""
        self.reset()
        self.device.close()
        print("🎮 Virtual controller disconnected.")
