from types import SimpleNamespace

import pytest

from utils.session_summary import FIRST_MESSAGE_SUMMARY_KEY, _extract_user_text, make_session_summary_callback


def _request_with_text(*texts: str):
    parts = [SimpleNamespace(text=text) for text in texts]
    return SimpleNamespace(contents=[SimpleNamespace(role="user", parts=parts)])


def test_extract_user_text_joins_text_parts():
    request = _request_with_text("Investigate", " MQ backlog ")
    assert _extract_user_text(request) == "Investigate MQ backlog"


def test_session_summary_callback_sets_summary_once(monkeypatch: pytest.MonkeyPatch):
    callback = make_session_summary_callback("openai/gpt-4o-mini")
    callback_context = SimpleNamespace(state={})
    request = _request_with_text("Investigate queue backlog in production")

    fake_response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="Production MQ backlog investigation"))]
    )
    monkeypatch.setattr("utils.session_summary.litellm.completion", lambda **kwargs: fake_response)

    result = callback(callback_context, request)
    assert result is None
    assert callback_context.state[FIRST_MESSAGE_SUMMARY_KEY] == "Production MQ backlog investigation"


def test_session_summary_callback_skips_when_summary_already_exists(monkeypatch: pytest.MonkeyPatch):
    callback = make_session_summary_callback("openai/gpt-4o-mini")
    callback_context = SimpleNamespace(state={FIRST_MESSAGE_SUMMARY_KEY: "Existing summary"})
    request = _request_with_text("Another message")

    called = {"value": False}

    def fake_completion(**kwargs):
        called["value"] = True
        return None

    monkeypatch.setattr("utils.session_summary.litellm.completion", fake_completion)

    callback(callback_context, request)
    assert called["value"] is False
    assert callback_context.state[FIRST_MESSAGE_SUMMARY_KEY] == "Existing summary"


def test_session_summary_callback_skips_when_user_text_missing(monkeypatch: pytest.MonkeyPatch):
    callback = make_session_summary_callback("openai/gpt-4o-mini")
    callback_context = SimpleNamespace(state={})
    request = SimpleNamespace(contents=[SimpleNamespace(role="model", parts=[SimpleNamespace(text="ignored")])])

    called = {"value": False}

    def fake_completion(**kwargs):
        called["value"] = True
        return None

    monkeypatch.setattr("utils.session_summary.litellm.completion", fake_completion)

    callback(callback_context, request)
    assert called["value"] is False
    assert FIRST_MESSAGE_SUMMARY_KEY not in callback_context.state


def test_session_summary_callback_falls_back_when_model_returns_none_content(monkeypatch: pytest.MonkeyPatch):
    callback = make_session_summary_callback("openai/gpt-4o-mini")
    callback_context = SimpleNamespace(state={})
    request = _request_with_text("Investigate queue backlog in production")

    fake_response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=None))])
    monkeypatch.setattr("utils.session_summary.litellm.completion", lambda **kwargs: fake_response)

    result = callback(callback_context, request)
    assert result is None
    assert callback_context.state[FIRST_MESSAGE_SUMMARY_KEY] == "Investigate queue backlog in production"


def test_session_summary_callback_falls_back_when_completion_raises(monkeypatch: pytest.MonkeyPatch):
    callback = make_session_summary_callback("openai/gpt-4o-mini")
    callback_context = SimpleNamespace(state={})
    request = _request_with_text("Investigate queue backlog in production")

    def fake_completion(**kwargs):
        raise RuntimeError("provider failure")

    monkeypatch.setattr("utils.session_summary.litellm.completion", fake_completion)

    result = callback(callback_context, request)
    assert result is None
    assert callback_context.state[FIRST_MESSAGE_SUMMARY_KEY] == "Investigate queue backlog in production"
