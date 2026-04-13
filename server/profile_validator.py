"""
Mobile Console — Profile Validator
Validates JSON profile files to prevent crashes from corrupted data.
"""

import json
from pathlib import Path

REQUIRED_BUTTON_FIELDS = {"id", "type", "mapping", "x", "y", "size"}
VALID_BUTTON_TYPES = {"tap", "hold", "toggle"}
VALID_SHAPES = {"circle", "rounded", "square"}

MIN_BUTTON_SIZE = 20
MAX_BUTTON_SIZE = 150
MIN_POSITION = 0
MAX_POSITION = 100

REQUIRED_PROFILE_FIELDS = {"name", "buttons"}

GYRO_FIELDS = {"enabled", "sensitivity"}
VALID_GYRO_AXES = {"both", "x", "y"}


class ProfileValidationError(Exception):
    """Raised when a profile fails validation."""

    pass


def validate_button(button: dict, index: int) -> list[str]:
    """Validate a single button configuration. Returns list of errors."""
    errors = []

    missing = REQUIRED_BUTTON_FIELDS - set(button.keys())
    if missing:
        errors.append(f"Button {index}: missing fields {missing}")

    if "type" in button and button["type"] not in VALID_BUTTON_TYPES:
        errors.append(f"Button {index}: invalid type '{button['type']}'")

    if "shape" in button and button["shape"] not in VALID_SHAPES:
        errors.append(f"Button {index}: invalid shape '{button['shape']}'")

    if "size" in button:
        size = button["size"]
        if not isinstance(size, (int, float)):
            errors.append(f"Button {index}: size must be a number")
        elif size < MIN_BUTTON_SIZE or size > MAX_BUTTON_SIZE:
            errors.append(
                f"Button {index}: size {size} out of range [{MIN_BUTTON_SIZE}, {MAX_BUTTON_SIZE}]"
            )

    if "x" in button:
        x = button["x"]
        if not isinstance(x, (int, float)):
            errors.append(f"Button {index}: x must be a number")
        elif x < MIN_POSITION or x > MAX_POSITION:
            errors.append(
                f"Button {index}: x {x} out of range [{MIN_POSITION}, {MAX_POSITION}]"
            )

    if "y" in button:
        y = button["y"]
        if not isinstance(y, (int, float)):
            errors.append(f"Button {index}: y must be a number")
        elif y < MIN_POSITION or y > MAX_POSITION:
            errors.append(
                f"Button {index}: y {y} out of range [{MIN_POSITION}, {MAX_POSITION}]"
            )

    if "mapping" in button:
        mapping = button["mapping"]
        if not isinstance(mapping, int) or mapping < 0 or mapping > 13:
            errors.append(f"Button {index}: mapping must be 0-13 (Xbox button ID)")

    return errors


def validate_gyro(gyro: dict) -> list[str]:
    """Validate gyro configuration. Returns list of errors."""
    errors = []

    if "sensitivity" in gyro:
        sens = gyro["sensitivity"]
        if not isinstance(sens, (int, float)):
            errors.append("gyro.sensitivity must be a number")
        elif sens < 0.1 or sens > 10:
            errors.append("gyro.sensitivity must be between 0.1 and 10")

    if "axes" in gyro and gyro["axes"] not in VALID_GYRO_AXES:
        errors.append(f"gyro.axes must be one of {VALID_GYRO_AXES}")

    return errors


def validate_profile(profile: dict) -> None:
    """
    Validate a complete profile dictionary.
    Raises ProfileValidationError with detailed error messages.
    """
    errors = []

    if not isinstance(profile, dict):
        raise ProfileValidationError("Profile must be a JSON object")

    missing = REQUIRED_PROFILE_FIELDS - set(profile.keys())
    if missing:
        raise ProfileValidationError(f"Missing required fields: {missing}")

    if not isinstance(profile["name"], str) or not profile["name"].strip():
        errors.append("Profile name must be a non-empty string")

    if not isinstance(profile["buttons"], list):
        errors.append("'buttons' must be an array")
    else:
        for i, button in enumerate(profile["buttons"]):
            if not isinstance(button, dict):
                errors.append(f"Button {i}: must be an object")
            else:
                errors.extend(validate_button(button, i))

    if "gyro" in profile:
        if not isinstance(profile["gyro"], dict):
            errors.append("'gyro' must be an object")
        else:
            errors.extend(validate_gyro(profile["gyro"]))

    if "sticks" in profile:
        if not isinstance(profile["sticks"], list):
            errors.append("'sticks' must be an array")

    if errors:
        raise ProfileValidationError("\n".join(errors))


def load_and_validate_profile(filepath: Path | str) -> dict:
    """
    Load a profile from a JSON file and validate it.
    Returns the profile dict if valid.
    Raises ProfileValidationError or JSONDecodeError if invalid.
    """
    filepath = Path(filepath)

    if not filepath.exists():
        raise FileNotFoundError(f"Profile not found: {filepath}")

    content = filepath.read_text()
    profile = json.loads(content)
    validate_profile(profile)

    return profile
