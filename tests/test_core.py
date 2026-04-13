"""
Mobile Console — Unit Tests
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "server"))

from config import (
    VALID_MSG_TYPES,
    MAX_BUTTON_ID,
    MAX_STICK_ID,
    MIN_AXIS_VALUE,
    MAX_AXIS_VALUE,
    CENTER_AXIS_VALUE,
)
from profile_validator import (
    validate_profile,
    validate_button,
    ProfileValidationError,
)


class TestConfig:
    """Test configuration constants."""

    def test_valid_msg_types(self):
        assert 0x01 in VALID_MSG_TYPES
        assert 0x02 in VALID_MSG_TYPES
        assert 0x03 in VALID_MSG_TYPES
        assert 0x00 not in VALID_MSG_TYPES

    def test_button_id_bounds(self):
        assert MAX_BUTTON_ID == 13
        assert 0 <= MAX_BUTTON_ID

    def test_axis_bounds(self):
        assert MIN_AXIS_VALUE == 0
        assert MAX_AXIS_VALUE == 255
        assert CENTER_AXIS_VALUE == 128
        assert MIN_AXIS_VALUE < CENTER_AXIS_VALUE < MAX_AXIS_VALUE


class TestProfileValidator:
    """Test profile validation."""

    def test_valid_profile(self):
        profile = {
            "name": "Test Profile",
            "buttons": [
                {
                    "id": "btn_a",
                    "type": "tap",
                    "mapping": 0,
                    "x": 50,
                    "y": 50,
                    "size": 56,
                }
            ],
        }
        validate_profile(profile)

    def test_missing_name(self):
        profile = {"buttons": []}
        with pytest.raises(ProfileValidationError, match="Missing required fields"):
            validate_profile(profile)

    def test_missing_buttons(self):
        profile = {"name": "Test"}
        with pytest.raises(ProfileValidationError, match="Missing required fields"):
            validate_profile(profile)

    def test_invalid_button_mapping(self):
        profile = {
            "name": "Test",
            "buttons": [
                {
                    "id": "btn_a",
                    "type": "tap",
                    "mapping": 999,
                    "x": 50,
                    "y": 50,
                    "size": 56,
                }
            ],
        }
        with pytest.raises(ProfileValidationError, match="mapping must be 0-13"):
            validate_profile(profile)

    def test_button_out_of_bounds_position(self):
        errors = validate_button(
            {"id": "test", "type": "tap", "mapping": 0, "x": 150, "y": 50, "size": 50},
            0,
        )
        assert len(errors) > 0
        assert "out of range" in errors[0]

    def test_button_size_too_small(self):
        errors = validate_button(
            {"id": "test", "type": "tap", "mapping": 0, "x": 50, "y": 50, "size": 5},
            0,
        )
        assert len(errors) > 0

    def test_invalid_button_type(self):
        errors = validate_button(
            {
                "id": "test",
                "type": "invalid",
                "mapping": 0,
                "x": 50,
                "y": 50,
                "size": 50,
            },
            0,
        )
        assert len(errors) > 0

    def test_valid_gyro_config(self):
        profile = {
            "name": "Test",
            "buttons": [],
            "gyro": {"enabled": True, "sensitivity": 1.5, "axes": "both"},
        }
        validate_profile(profile)

    def test_invalid_gyro_sensitivity(self):
        profile = {
            "name": "Test",
            "buttons": [],
            "gyro": {"sensitivity": 20},
        }
        with pytest.raises(ProfileValidationError, match="sensitivity"):
            validate_profile(profile)


class TestBinaryProtocol:
    """Test binary message handling."""

    def test_button_values(self):
        from config import BTN_PRESSED, BTN_RELEASED

        assert BTN_PRESSED == 1
        assert BTN_RELEASED == 0

    def test_message_types_distinct(self):
        from config import MSG_BUTTON, MSG_STICK, MSG_GYRO, MSG_GYRO_ON, MSG_GYRO_OFF

        types = [MSG_BUTTON, MSG_STICK, MSG_GYRO, MSG_GYRO_ON, MSG_GYRO_OFF]
        assert len(types) == len(set(types))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
