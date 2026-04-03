import asyncio
from types import SimpleNamespace

import pytest

import utils.session_summary_plugin as session_summary_plugin_module
from utils.session_summary_plugin import (
    HARDCODED_FALLBACK_MODEL,
    FIRST_MESSAGE_SUMMARY_KEY,
    SessionSummaryPlugin,
    _extract_user_text,
)


def _request_with_text(*texts: str):
    parts = [SimpleNamespace(text=text) for text in texts]
    return SimpleNamespace(
        model="openai/gpt-4o-mini",
        contents=[SimpleNamespace(role="user", parts=parts)],
    )


def test_extract_user_text_joins_text_parts():
    request = _request_with_text("Investigate", " MQ backlog ")
    assert _extract_user_text(request) == "Investigate MQ backlog"


def test_session_summary_plugin_sets_summary_once(monkeypatch: pytest.MonkeyPatch):
    plugin = SessionSummaryPlugin()
    callback_context = SimpleNamespace(state={})
    request = _request_with_text("Investigate queue backlog in production")

    fake_response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content="Production MQ backlog investigation")
            )
        ]
    )
    monkeypatch.setattr(
        "utils.session_summary_plugin.litellm.completion",
        lambda **kwargs: fake_response,
    )

    result = asyncio.run(
        plugin.before_model_callback(
            callback_context=callback_context,
            llm_request=request,
        )
    )
    assert result is None
    assert (
        callback_context.state[FIRST_MESSAGE_SUMMARY_KEY]
        == "Production MQ backlog investigation"
    )


def test_session_summary_plugin_uses_request_model_with_shared_fallback_by_default(
    monkeypatch: pytest.MonkeyPatch,
):
    plugin = SessionSummaryPlugin()
    callback_context = SimpleNamespace(state={})
    request = _request_with_text("Investigate queue backlog in production")

    captured = {}
    fake_response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="Queue backlog"))]
    )

    def fake_completion(**kwargs):
        captured.update(kwargs)
        return fake_response

    monkeypatch.setattr(session_summary_plugin_module, "SUMMARIZER_MODEL", None)
    monkeypatch.setattr(
        "utils.session_summary_plugin.litellm.completion",
        fake_completion,
    )

    asyncio.run(
        plugin.before_model_callback(
            callback_context=callback_context,
            llm_request=request,
        )
    )

    assert captured["model"] == "openai/gpt-4o-mini"
    assert captured["fallbacks"] == [HARDCODED_FALLBACK_MODEL]


def test_session_summary_plugin_skips_when_summary_already_exists(
    monkeypatch: pytest.MonkeyPatch,
):
    plugin = SessionSummaryPlugin()
    callback_context = SimpleNamespace(
        state={FIRST_MESSAGE_SUMMARY_KEY: "Existing summary"}
    )
    request = _request_with_text("Another message")

    called = {"value": False}

    def fake_completion(**kwargs):
        called["value"] = True
        return None

    monkeypatch.setattr(
        "utils.session_summary_plugin.litellm.completion", fake_completion
    )

    asyncio.run(
        plugin.before_model_callback(
            callback_context=callback_context,
            llm_request=request,
        )
    )
    assert called["value"] is False
    assert callback_context.state[FIRST_MESSAGE_SUMMARY_KEY] == "Existing summary"


def test_session_summary_plugin_skips_when_user_text_missing(
    monkeypatch: pytest.MonkeyPatch,
):
    plugin = SessionSummaryPlugin()
    callback_context = SimpleNamespace(state={})
    request = SimpleNamespace(
        model="openai/gpt-4o-mini",
        contents=[
            SimpleNamespace(role="model", parts=[SimpleNamespace(text="ignored")])
        ],
    )

    called = {"value": False}

    def fake_completion(**kwargs):
        called["value"] = True
        return None

    monkeypatch.setattr(
        "utils.session_summary_plugin.litellm.completion", fake_completion
    )

    asyncio.run(
        plugin.before_model_callback(
            callback_context=callback_context,
            llm_request=request,
        )
    )
    assert called["value"] is False
    assert FIRST_MESSAGE_SUMMARY_KEY not in callback_context.state


def test_session_summary_plugin_falls_back_when_model_returns_none_content(
    monkeypatch: pytest.MonkeyPatch,
):
    plugin = SessionSummaryPlugin()
    callback_context = SimpleNamespace(state={})
    request = _request_with_text("Investigate queue backlog in production")

    fake_response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=None))]
    )
    monkeypatch.setattr(
        "utils.session_summary_plugin.litellm.completion",
        lambda **kwargs: fake_response,
    )

    result = asyncio.run(
        plugin.before_model_callback(
            callback_context=callback_context,
            llm_request=request,
        )
    )
    assert result is None
    assert (
        callback_context.state[FIRST_MESSAGE_SUMMARY_KEY]
        == "Investigate queue backlog in production"
    )


def test_session_summary_plugin_falls_back_when_completion_raises(
    monkeypatch: pytest.MonkeyPatch,
):
    plugin = SessionSummaryPlugin()
    callback_context = SimpleNamespace(state={})
    request = _request_with_text("Investigate queue backlog in production")

    def fake_completion(**kwargs):
        raise RuntimeError("provider failure")

    monkeypatch.setattr(
        "utils.session_summary_plugin.litellm.completion", fake_completion
    )

    result = asyncio.run(
        plugin.before_model_callback(
            callback_context=callback_context,
            llm_request=request,
        )
    )
    assert result is None
    assert (
        callback_context.state[FIRST_MESSAGE_SUMMARY_KEY]
        == "Investigate queue backlog in production"
    )
