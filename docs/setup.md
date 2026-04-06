# Mobile Console — Setup Guide

Mobile Console works on **Linux** and **Windows**. Follow the section for your OS.

---

## 🐧 Linux Setup

### 1. Python 3.10+
Most distros ship with Python. Check:
```bash
python3 --version    # Should show 3.10+
```

### 2. Install Dependencies
```bash
cd Mobile_console
pip install -r requirements.txt
```
This installs `aiohttp`, `websockets`, and `evdev` (the Linux virtual gamepad library).

### 3. Load the uinput Kernel Module
The `uinput` module lets us create virtual input devices. It's built into every modern Linux kernel but may not be loaded by default:

```bash
# Load it now
sudo modprobe uinput

# Allow non-root access (so you don't need sudo to run the server)
sudo chmod 666 /dev/uinput
```

**To make it permanent** (loads on every boot):
```bash
# Add to modules list
echo "uinput" | sudo tee /etc/modules-load.d/uinput.conf

# Add a udev rule for non-root access
echo 'KERNEL=="uinput", MODE="0666"' | sudo tee /etc/udev/rules-d/99-uinput.rules
sudo udevadm control --reload-rules
```

### 4. Install ADB
```bash
# Ubuntu / Debian
sudo apt install android-tools-adb

# Fedora
sudo dnf install android-tools

# Arch
sudo pacman -S android-tools
```

### 5. Enable USB Debugging on Your Phone
1. **Settings → About Phone** → Tap **Build Number** 7 times
2. **Settings → Developer Options** → Enable **USB Debugging**
3. Plug phone in → Tap **Allow** on the popup

### 6. Run!
```bash
cd server
python3 main.py
```

### 7. Open on Phone
1. Open **Chrome** on your phone
2. Go to: `http://localhost:8080`
3. Tap **"Tap to Start"** → Controller appears! 🎮

### 8. Verify
```bash
# Check the virtual controller exists
cat /proc/bus/input/devices | grep -A5 "Mobile Console"

# Test button presses  (install: sudo apt install joystick)
jstest /dev/input/js0

# Or use evtest  (install: sudo apt install evtest)
sudo evtest
```

### 9. Game Compatibility (Linux)
| Platform | Works? | Notes |
|----------|--------|-------|
| **Steam** (Proton) | ✅ | Auto-detected. Enable "Xbox controller" in Steam settings |
| **Native SDL2 games** | ✅ | Auto-detected |
| **Lutris** | ✅ | May need to select controller in settings |
| **RetroArch** | ✅ | Configure input in Settings → Input |
| **Wine/Proton** | ✅ | Shows as Xbox 360 controller |
| **Flatpak games** | ⚠️ | May need `--device=all` permission |

---

## 🪟 Windows Setup

### 1. Python 3.10+
Download from [python.org](https://www.python.org/downloads/).

### 2. ViGEmBus Driver
Creates the virtual Xbox controller. Games think it's real hardware.

1. Download from [ViGEmBus Releases](https://github.com/nefarius/ViGEmBus/releases)
2. Run the installer
3. **Restart your PC**

### 3. Install Dependencies
```bash
cd Mobile_console
pip install -r requirements.txt
```

### 4. Install ADB
1. Download [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools)
2. Extract the ZIP (e.g., `C:\adb\`)
3. Add folder to system PATH

### 5. Enable USB Debugging
Same as Linux — see step 5 above.

### 6. Run!
```bash
cd server
python main.py
```

### 7. Verify
1. Press `Win + R` → type `joy.cpl` → Enter
2. You should see **"Xbox 360 Controller"**
3. Double-click → test buttons from phone

---

## Troubleshooting

### Linux
| Problem | Solution |
|---------|----------|
| `PermissionError: /dev/uinput` | `sudo chmod 666 /dev/uinput` or run with `sudo` |
| `ModuleNotFoundError: evdev` | `pip install evdev` |
| `FATAL: Module uinput not found` | Your kernel doesn't have uinput. Try: `sudo apt install linux-modules-extra-$(uname -r)` |
| Controller not seen by Steam | Settings → Controller → General → Check "Xbox Configuration Support" |
| No Android device detected | `sudo adb kill-server && sudo adb start-server` |

### Windows
| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError: vgamepad` | `pip install vgamepad` |
| Failed to create virtual gamepad | Install ViGEmBus and restart PC |
| ADB not found | Install Platform Tools and add to PATH |
| Phone shows "site can't be reached" | Run `adb reverse --list` to check tunnel |

### Both Platforms
| Problem | Solution |
|---------|----------|
| Buttons don't register | Check game supports Xbox controllers |
| Phone screen turns off | Make sure Wake Lock is working (check browser console) |
| High latency | Use USB, not WiFi. Close other apps on phone |
