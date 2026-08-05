"""
Unit tests for _extract_chat_text — the function that parses ADK event output.

Zero tests existed before. If the event shape changes, responses silently go
empty without this coverage.
"""

from types import SimpleNamespace

from src.routers.agents import _extract_chat_text


def _event(**kwargs):
    return SimpleNamespace(**kwargs)


# ---------------------------------------------------------------------------
# Empty / no events
# ---------------------------------------------------------------------------


def test_empty_events_returns_empty_string():
    assert _extract_chat_text([]) == ""


def test_event_with_no_useful_fields_returns_empty_string():
    assert _extract_chat_text([_event(other="x")]) == ""


# ---------------------------------------------------------------------------
# Error fields
# ---------------------------------------------------------------------------


def test_error_field_string_returns_error_prefix():
    e = _event(error="something broke")
    assert _extract_chat_text([e]) == "Error: something broke"


def test_detail_field_string_returns_error_prefix():
    e = _event(detail="not found")
    assert _extract_chat_text([e]) == "Error: not found"


def test_error_field_non_string_is_ignored():
    e = _event(error={"code": 500})
    assert _extract_chat_text([e]) == ""


def test_error_empty_string_is_ignored():
    e = _event(error="", result="good")
    assert _extract_chat_text([e]) == "good"


# ---------------------------------------------------------------------------
# result / text fields
# ---------------------------------------------------------------------------


def test_result_field_returned():
    e = _event(result="agent reply")
    assert _extract_chat_text([e]) == "agent reply"


def test_text_field_returned():
    e = _event(text="hello there")
    assert _extract_chat_text([e]) == "hello there"


def test_result_takes_priority_over_text():
    e = _event(result="from result", text="from text")
    assert _extract_chat_text([e]) == "from result"


def test_empty_result_falls_through_to_text():
    e = _event(result="", text="fallback")
    assert _extract_chat_text([e]) == "fallback"


# ---------------------------------------------------------------------------
# Nested content.parts[].text
# ---------------------------------------------------------------------------


def test_nested_content_parts_text_returned():
    part = SimpleNamespace(text="nested text")
    content = SimpleNamespace(parts=[part])
    e = _event(content=content)
    assert _extract_chat_text([e]) == "nested text"


def test_nested_content_multiple_parts_first_nonempty_returned():
    parts = [SimpleNamespace(text=""), SimpleNamespace(text="second")]
    content = SimpleNamespace(parts=parts)
    e = _event(content=content)
    assert _extract_chat_text([e]) == "second"


def test_nested_content_no_text_in_parts_returns_empty():
    part = SimpleNamespace(text="")
    content = SimpleNamespace(parts=[part])
    e = _event(content=content)
    assert _extract_chat_text([e]) == ""


def test_content_none_parts_is_none_does_not_crash():
    content = SimpleNamespace(parts=None)
    e = _event(content=content)
    assert _extract_chat_text([e]) == ""


# ---------------------------------------------------------------------------
# Multiple events — reversed iteration (last event wins)
# ---------------------------------------------------------------------------


def test_last_event_result_is_preferred():
    e1 = _event(result="first")
    e2 = _event(result="last")
    assert _extract_chat_text([e1, e2]) == "last"


def test_skips_empty_events_to_find_result():
    e1 = _event(result="found")
    e2 = _event()  # no useful fields
    assert _extract_chat_text([e1, e2]) == "found"


def test_dict_events_supported_via_read_field():
    """_read_field supports both object and dict shapes."""
    e = {"result": "dict result"}
    assert _extract_chat_text([e]) == "dict result"


def test_dict_event_error_field():
    e = {"error": "dict error"}
    assert _extract_chat_text([e]) == "Error: dict error"
