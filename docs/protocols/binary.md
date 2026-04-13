# Binary Protocol Specification

Mobile Console uses a binary protocol for communication between phone and PC. This is ~20x smaller than JSON, enabling sub-millisecond latency.

## Message Format

All messages are binary arrays. The first byte is always the message type.

### Button Press/Release (3 bytes)

```
Byte 0: MSG_BUTTON (0x01)
Byte 1: Button ID (0-13)
Byte 2: Value (0=released, 1=pressed)
```

Example (A button pressed): `[0x01, 0x00, 0x01]`

### Joystick Movement (4 bytes)

```
Byte 0: MSG_STICK (0x02)
Byte 1: Stick ID (0=left, 1=right)
Byte 2: X axis (0-255, 128=center)
Byte 3: Y axis (0-255, 128=center)
```

Example (left stick full right): `[0x02, 0x00, 0xFF, 0x80]`

### Gyroscope Data (4 bytes)

```
Byte 0: MSG_GYRO (0x03)
Byte 1: Reserved (0x00)
Byte 2: X rotation (0-255, 128=center)
Byte 3: Y rotation (0-255, 128=center)
```

### Gyroscope Activation (1 byte)

```
Byte 0: MSG_GYRO_ON (0x04)  or  MSG_GYRO_OFF (0x05)
```

## Button ID Mapping

| ID | Button | Xbox Position |
|----|--------|---------------|
| 0 | A | Green, bottom-right |
| 1 | B | Red, right |
| 2 | X | Blue, left |
| 3 | Y | Yellow, top |
| 4 | LB | Left bumper |
| 5 | RB | Right bumper |
| 6 | BACK | Back/Select |
| 7 | START | Start/Menu |
| 8 | L_THUMB | Left stick click |
| 9 | R_THUMB | Right stick click |
| 10 | DPAD_UP | D-pad up |
| 11 | DPAD_DOWN | D-pad down |
| 12 | DPAD_LEFT | D-pad left |
| 13 | DPAD_RIGHT | D-pad right |

## Axis Values

- Range: 0-255
- Center: 128
- Full left/up: 0
- Full right/down: 255

## Server Messages (JSON)

The server can send text messages:

**Vibration**:
```json
{"type": "vibrate", "pattern": "tap"}
```

Patterns: `tap`, `double`, `long`

## Why Binary?

| Metric | JSON | Binary |
|--------|------|--------|
| Button press size | ~60 bytes | 3 bytes |
| Stick movement size | ~80 bytes | 4 bytes |
| Parsing speed | JSON.parse() | Direct byte access |
| Typical latency | 5-10ms | <1ms |