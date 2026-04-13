# Profile Format Specification

Profiles define controller layouts. They're stored as JSON files in `profiles/`.

## Structure

```json
{
    "name": "Profile Name",
    "game": "Game Name",
    "version": 1,
    "created": "2026-04-06",
    "author": "Author Name",
    "description": "Description text",
    "buttons": [...],
    "sticks": [...],
    "gyro": {...},
    "theme": "default"
}
```

## Required Fields

- `name`: Profile name (string)
- `buttons`: Array of button configurations

## Button Configuration

```json
{
    "id": "btn_a",
    "type": "tap",
    "mapping": 0,
    "mappingName": "A",
    "label": "A",
    "x": 85,
    "y": 65,
    "size": 56,
    "shape": "circle",
    "color": "#22c55e",
    "opacity": 1.0,
    "vibrate": true,
    "vibratePattern": "tap"
}
```

### Button Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `type` | string | yes | `tap`, `hold`, or `toggle` |
| `mapping` | number | yes | Xbox button ID (0-13) |
| `mappingName` | string | no | Human-readable button name |
| `label` | string | no | Display text or emoji |
| `x` | number | yes | X position (0-100, percent) |
| `y` | number | yes | Y position (0-100, percent) |
| `size` | number | yes | Button size (20-150 pixels) |
| `shape` | string | no | `circle`, `rounded`, `square` |
| `color` | string | no | Hex color code |
| `opacity` | number | no | 0.0 to 1.0 |
| `vibrate` | boolean | no | Enable haptic feedback |
| `vibratePattern` | string | no | `tap`, `double`, `long` |

## Stick Configuration

```json
{
    "id": "stick_left",
    "side": "left",
    "x": 25,
    "y": 70,
    "size": 120,
    "deadzone": 0.1
}
```

## Gyroscope Configuration

```json
{
    "gyro": {
        "enabled": true,
        "sensitivity": 1.0,
        "smoothing": 3,
        "axes": "both"
    }
}
```

### Gyro Fields

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `enabled` | boolean | - | Enable gyro aiming |
| `sensitivity` | number | 0.1-10 | Rotation multiplier |
| `smoothing` | number | 1-10 | Sample count for smoothing |
| `axes` | string | `both`, `x`, `y` | Which axes to use |

## Validation

Load profiles safely:

```python
from profile_validator import load_and_validate_profile

profile = load_and_validate_profile("profiles/custom.json")
```

Invalid profiles raise `ProfileValidationError`.