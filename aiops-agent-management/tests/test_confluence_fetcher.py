"""Unit tests for the Confluence fetcher's web_url construction.

Confluence Cloud's REST API v2 returns ``_links.webui`` relative to the
``/wiki`` base path (e.g. ``/spaces/KEY/pages/123/Title``), not the bare
domain. A prior bug prepended only the domain, producing a 404'ing URL
(missing ``/wiki``). Covered here without any live Confluence call.
"""

from __future__ import annotations

from unittest.mock import patch

from src.ingestion.fetchers.confluence.fetcher import ConfluenceFetcher
from src.ingestion.types import ResolvedSource


def _source() -> ResolvedSource:
    return ResolvedSource(
        source_id="src-1",
        source_name="Confluence SOP Source",
        source_type="confluence",
        config=[
            {"name": "CF_DOMAIN", "value": "royalcyber-team-imqg4rpn.atlassian.net"},
            {"name": "CF_EMAIL", "value": "a@b.com"},
            {"name": "CF_API_TOKEN", "value": "token"},
            {"name": "CF_SPACE_KEY", "value": "RCAIOPS"},
        ],
    )


class _Resp:
    def __init__(self, payload: dict) -> None:
        self._payload = payload
        self.status_code = 200
        self.text = ""

    def json(self) -> dict:
        return self._payload


def _get_side_effect(webui: str):
    def _side_effect(url, headers=None, params=None, timeout=None):
        if url.endswith("/spaces"):
            return _Resp({"results": [{"id": "space-1", "key": "RCAIOPS"}]})
        if url.endswith("/pages"):
            return _Resp(
                {
                    "results": [
                        {
                            "id": "35258369",
                            "title": "Construction Quality Document",
                            "version": {"number": 3, "createdAt": "2026-07-01"},
                            "_links": {"webui": webui},
                        }
                    ]
                }
            )
        raise AssertionError(f"unexpected URL {url}")

    return _side_effect


def test_web_url_prepends_wiki_when_missing():
    fetcher = ConfluenceFetcher()
    with patch(
        "requests.get",
        side_effect=_get_side_effect(
            "/spaces/RCAIOPS/pages/35258369/Construction+Quality+Document"
        ),
    ):
        refs = fetcher.list_documents(_source())

    assert len(refs) == 1
    assert refs[0].web_url == (
        "https://royalcyber-team-imqg4rpn.atlassian.net/wiki"
        "/spaces/RCAIOPS/pages/35258369/Construction+Quality+Document"
    )


def test_web_url_not_double_prefixed_if_api_already_includes_wiki():
    fetcher = ConfluenceFetcher()
    with patch(
        "requests.get",
        side_effect=_get_side_effect(
            "/wiki/spaces/RCAIOPS/pages/35258369/Construction+Quality+Document"
        ),
    ):
        refs = fetcher.list_documents(_source())

    assert refs[0].web_url == (
        "https://royalcyber-team-imqg4rpn.atlassian.net/wiki"
        "/spaces/RCAIOPS/pages/35258369/Construction+Quality+Document"
    )
