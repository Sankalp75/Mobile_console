"""
Mobile Console — Security Tests
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
    MAX_CONNECT_ATTEMPTS,
)
from profile_validator import (
    validate_profile,
    validate_button,
    validate_gyro,
    ProfileValidationError,
    load_and_validate_profile,
)
from main import (
    _constant_time_compare,
    PersistentRateLimiter,
    ALLOWED_ORIGINS,
)


class TestConstantTimeCompare:
    def test_equal_strings(self):
        assert _constant_time_compare("123456", "123456") is True

    def test_unequal_strings(self):
        assert _constant_time_compare("123456", "654321") is False

    def test_different_lengths(self):
        assert _constant_time_compare("123456", "12345") is False
        assert _constant_time_compare("12345", "123456") is False

    def test_empty_strings(self):
        assert _constant_time_compare("", "") is True


class TestPersistentRateLimiter:
    def test_first_attempt_allowed(self):
        r = PersistentRateLimiter(max_attempts=5, window_seconds=300)
        r._state_file = r._state_file.with_suffix('.test1.json')
        r._attempts = {}  # Clear any loaded state
        assert r.is_allowed("127.0.0.1") is True

    def test_respects_max_attempts(self):
        r = PersistentRateLimiter(max_attempts=3, window_seconds=300)
        r._state_file = r._state_file.with_suffix('.test2.json')
        r._attempts = {}  # Clear any loaded state
        for _ in range(3):
            assert r.is_allowed("127.0.0.1") is True

    def test_blocks_after_max_attempts(self):
        r = PersistentRateLimiter(max_attempts=3, window_seconds=300)
        r._state_file = r._state_file.with_suffix('.test3.json')
        r._attempts = {}  # Clear any loaded state
        for _ in range(3):
            r.is_allowed("127.0.0.1")
        assert r.is_allowed("127.0.0.1") is False

    def test_different_ips_independent(self):
        r = PersistentRateLimiter(max_attempts=2, window_seconds=300)
        r._state_file = r._state_file.with_suffix('.test4.json')
        r._attempts = {}  # Clear any loaded state
        r.is_allowed("127.0.0.1")
        r.is_allowed("127.0.0.1")
        assert r.is_allowed("127.0.0.1") is False
        assert r.is_allowed("127.0.0.2") is True


class TestAllowedOrigins:
    def test_localhost_allowed(self):
        assert "http://localhost:3000" in ALLOWED_ORIGINS

    def test_127_allowed(self):
        assert "http://127.0.0.1:3000" in ALLOWED_ORIGINS


class TestConfig:
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

    def test_max_connect_attempts(self):
        assert MAX_CONNECT_ATTEMPTS == 5


class TestProfileValidator:
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

    def test_invalid_gyro_axes(self):
        errors = validate_gyro({"axes": "invalid"})
        assert len(errors) > 0

    def test_valid_gyro_axes(self):
        errors = validate_gyro({"axes": "x"})
        assert len(errors) == 0
        errors = validate_gyro({"axes": "y"})
        assert len(errors) == 0
        errors = validate_gyro({"axes": "both"})
        assert len(errors) == 0

    def test_empty_button_name(self):
        profile = {
            "name": "",
            "buttons": [],
        }
        with pytest.raises(ProfileValidationError):
            validate_profile(profile)

    def test_missing_required_button_fields(self):
        profile = {
            "name": "Test",
            "buttons": [
                {"id": "btn_a"},
            ],
        }
        with pytest.raises(ProfileValidationError):
            validate_profile(profile)


class TestBinaryProtocol:
    def test_button_values(self):
        from config import BTN_PRESSED, BTN_RELEASED

        assert BTN_PRESSED == 1
        assert BTN_RELEASED == 0

    def test_message_types_distinct(self):
        from config import MSG_BUTTON, MSG_STICK, MSG_GYRO, MSG_GYRO_ON, MSG_GYRO_OFF

        types = [MSG_BUTTON, MSG_STICK, MSG_GYRO, MSG_GYRO_ON, MSG_GYRO_OFF]
        assert len(types) == len(set(types))

    def test_gyro_on_off(self):
        from config import MSG_GYRO_ON, MSG_GYRO_OFF
        assert MSG_GYRO_ON != MSG_GYRO_OFF
        assert MSG_GYRO_ON not in (MSG_GYRO_OFF,)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


class TestButtonLimit:
    def test_button_limit_enforced(self):
        from config import MAX_BUTTONS_IN_PROFILE
        # Create a profile with too many buttons
        buttons = [
            {"id": f"btn_{i}", "type": "tap", "mapping": i % 14, "x": 50, "y": 50, "size": 50}
            for i in range(MAX_BUTTONS_IN_PROFILE + 1)
        ]
        profile = {"name": "Test", "buttons": buttons}
        with pytest.raises(ProfileValidationError, match="exceeds maximum"):
            validate_profile(profile)

    def test_button_limit_edge_case(self):
        from config import MAX_BUTTONS_IN_PROFILE
        # Create a profile at exactly the limit
        buttons = [
            {"id": f"btn_{i}", "type": "tap", "mapping": i % 14, "x": 50, "y": 50, "size": 50}
            for i in range(MAX_BUTTONS_IN_PROFILE)
        ]
        profile = {"name": "Test", "buttons": buttons}
        # Should not raise
        validate_profile(profile)
