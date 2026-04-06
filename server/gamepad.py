"""
Mobile Console — Gamepad Factory
Auto-detects the OS and creates the right virtual controller backend.

  Linux  → evdev/uinput   (gamepad_linux.py)
  Windows → vgamepad/ViGEmBus (gamepad_windows.py)

Both backends expose the same interface:
  .press_button(id)
  .release_button(id)
  .set_left_stick(x, y)
  .set_right_stick(x, y)
  .reset()
  .close()
"""

import sys
import platform


def create_gamepad():
    """
    Create the right virtual gamepad for this OS.
    Returns a VirtualGamepad instance.
    Raises RuntimeError if the OS is unsupported or dependencies are missing.
    """
    os_name = platform.system().lower()

    if os_name == "linux":
        return _create_linux_gamepad()
    elif os_name == "windows":
        return _create_windows_gamepad()
    else:
        raise RuntimeError(
            f"Unsupported OS: {platform.system()}\n"
            "Mobile Console supports Linux and Windows."
        )


def _create_linux_gamepad():
    """Create a Linux virtual gamepad using evdev/uinput."""
    try:
        from gamepad_linux import VirtualGamepad
    except ImportError as e:
        print("❌ Missing dependency: python-evdev")
        print()
        print("   Install it with:")
        print("   pip install evdev")
        print()
        print("   Also make sure uinput is loaded:")
        print("   sudo modprobe uinput")
        raise RuntimeError(f"Linux gamepad dependency missing: {e}") from e

    try:
        return VirtualGamepad()
    except PermissionError as e:
        print(f"❌ {e}")
        raise
    except Exception as e:
        print(f"❌ Failed to create Linux virtual gamepad: {e}")
        print()
        print("   Troubleshooting:")
        print("   1. Load uinput:    sudo modprobe uinput")
        print("   2. Fix permissions: sudo chmod 666 /dev/uinput")
        print("   3. Or run with:    sudo python main.py")
        raise


def _create_windows_gamepad():
    """Create a Windows virtual gamepad using vgamepad/ViGEmBus."""
    try:
        from gamepad_windows import VirtualGamepad
    except ImportError as e:
        print("❌ Missing dependency: vgamepad")
        print()
        print("   Install it with:")
        print("   pip install vgamepad")
        print()
        print("   Also install ViGEmBus driver:")
        print("   https://github.com/nefarius/ViGEmBus/releases")
        raise RuntimeError(f"Windows gamepad dependency missing: {e}") from e

    try:
        return VirtualGamepad()
    except Exception as e:
        print(f"❌ Failed to create Windows virtual gamepad: {e}")
        print()
        print("   Make sure ViGEmBus is installed:")
        print("   https://github.com/nefarius/ViGEmBus/releases")
        raise


# For backward compatibility — direct import still works
# `from gamepad import VirtualGamepad` will get the right one
_os = platform.system().lower()
if _os == "linux":
    try:
        from gamepad_linux import VirtualGamepad
    except ImportError:
        VirtualGamepad = None
elif _os == "windows":
    try:
        from gamepad_windows import VirtualGamepad
    except ImportError:
        VirtualGamepad = None
else:
    VirtualGamepad = None
