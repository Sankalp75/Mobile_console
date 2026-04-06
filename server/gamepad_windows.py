"""
Mobile Console — Virtual Gamepad
Creates and controls a ghost Xbox 360 controller via ViGEmBus.
The game sees this as a real, physical controller.
"""

import vgamepad as vg
from config import BUTTON_MAP, BTN_PRESSED, LOG_INPUTS


class VirtualGamepad:
    """
    The puppet. The ghost controller. The invisible Xbox 360 pad that
    Windows believes is 100% real hardware.
    """

    # Map our button IDs to vgamepad's Xbox 360 button constants
    _VGAMEPAD_BUTTONS = {
        "A":          vg.XUSB_BUTTON.XUSB_GAMEPAD_A,
        "B":          vg.XUSB_BUTTON.XUSB_GAMEPAD_B,
        "X":          vg.XUSB_BUTTON.XUSB_GAMEPAD_X,
        "Y":          vg.XUSB_BUTTON.XUSB_GAMEPAD_Y,
        "LB":         vg.XUSB_BUTTON.XUSB_GAMEPAD_LEFT_SHOULDER,
        "RB":         vg.XUSB_BUTTON.XUSB_GAMEPAD_RIGHT_SHOULDER,
        "BACK":       vg.XUSB_BUTTON.XUSB_GAMEPAD_BACK,
        "START":      vg.XUSB_BUTTON.XUSB_GAMEPAD_START,
        "L_THUMB":    vg.XUSB_BUTTON.XUSB_GAMEPAD_LEFT_THUMB,
        "R_THUMB":    vg.XUSB_BUTTON.XUSB_GAMEPAD_RIGHT_THUMB,
        "DPAD_UP":    vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_UP,
        "DPAD_DOWN":  vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_DOWN,
        "DPAD_LEFT":  vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_LEFT,
        "DPAD_RIGHT": vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_RIGHT,
    }

    def __init__(self):
        """Create the virtual Xbox 360 controller."""
        self.pad = vg.VX360Gamepad()
        print("🎮 Virtual Xbox 360 controller created!")
        print("   → Open 'Set up USB game controllers' in Windows to verify.")

    def press_button(self, button_id: int):
        """
        Press a button on the ghost controller.
        
        Args:
            button_id: Our protocol's button ID (0=A, 1=B, etc.)
        """
        button_name = BUTTON_MAP.get(button_id)
        if button_name is None:
            return
        
        vg_button = self._VGAMEPAD_BUTTONS.get(button_name)
        if vg_button is None:
            return

        self.pad.press_button(button=vg_button)
        self.pad.update()

        if LOG_INPUTS:
            print(f"   ▶ {button_name} PRESSED")

    def release_button(self, button_id: int):
        """
        Release a button on the ghost controller.
        
        Args:
            button_id: Our protocol's button ID (0=A, 1=B, etc.)
        """
        button_name = BUTTON_MAP.get(button_id)
        if button_name is None:
            return
        
        vg_button = self._VGAMEPAD_BUTTONS.get(button_name)
        if vg_button is None:
            return

        self.pad.release_button(button=vg_button)
        self.pad.update()

        if LOG_INPUTS:
            print(f"   ■ {button_name} released")

    def set_left_stick(self, x: int, y: int):
        """
        Move the left analog stick (Phase 2).
        
        Args:
            x: 0-255 (128 = center)
            y: 0-255 (128 = center)
        """
        # Convert 0-255 range to vgamepad's -32768 to 32767 range
        vg_x = int((x / 255.0) * 65535 - 32768)
        vg_y = int((y / 255.0) * 65535 - 32768)
        self.pad.left_joystick(x_value=vg_x, y_value=vg_y)
        self.pad.update()

    def set_right_stick(self, x: int, y: int):
        """
        Move the right analog stick (Phase 2).
        
        Args:
            x: 0-255 (128 = center)
            y: 0-255 (128 = center)
        """
        vg_x = int((x / 255.0) * 65535 - 32768)
        vg_y = int((y / 255.0) * 65535 - 32768)
        self.pad.right_joystick(x_value=vg_x, y_value=vg_y)
        self.pad.update()

    def reset(self):
        """Release all buttons and center all sticks."""
        self.pad.reset()
        self.pad.update()

    def close(self):
        """Clean up — release everything before shutdown."""
        self.reset()
        print("🎮 Virtual controller disconnected.")
