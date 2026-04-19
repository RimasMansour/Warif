# backend/tests/unit/test_sensors.py
"""
Unit tests for sensor-related utilities.
Run with:  pytest tests/unit/
"""
import pytest
from src.api.routes.sensors import _compute_status


class FakeThreshold:
    def __init__(self, min_value=None, max_value=None, warning_min=None, warning_max=None):
        self.min_value   = min_value
        self.max_value   = max_value
        self.warning_min = warning_min
        self.warning_max = warning_max


def test_compute_status_no_threshold():
    assert _compute_status(25.0, None) == "normal"


def test_compute_status_normal():
    t = FakeThreshold(min_value=10, max_value=40, warning_min=15, warning_max=35)
    assert _compute_status(25.0, t) == "normal"


def test_compute_status_warning_high():
    t = FakeThreshold(min_value=10, max_value=40, warning_min=15, warning_max=30)
    assert _compute_status(32.0, t) == "warning"


def test_compute_status_critical_high():
    t = FakeThreshold(min_value=10, max_value=40, warning_min=15, warning_max=30)
    assert _compute_status(45.0, t) == "critical"


def test_compute_status_critical_low():
    t = FakeThreshold(min_value=10, max_value=40, warning_min=15, warning_max=30)
    assert _compute_status(5.0, t) == "critical"
