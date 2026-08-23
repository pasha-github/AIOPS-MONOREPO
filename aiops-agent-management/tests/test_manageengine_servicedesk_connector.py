import json

from src.connectors.manageengine_servicedesk_connector.connector import (
    ManageEngineServiceDeskConnector,
)


class _Response:
    status_code = 200
    text = "ok"

    @staticmethod
    def json():
        return {"response_status": {"status": "success"}}


class _JsonResponse:
    status_code = 200
    text = "ok"

    def __init__(self, body):
        self._body = body

    def json(self):
        return self._body


def _connector():
    connector = ManageEngineServiceDeskConnector(
        CLIENT_ID="client-id",
        CLIENT_SECRET="client-secret",
        API_DOMAIN="https://sdpondemand.manageengine.in",
        ACCOUNTS_SERVER_URL="https://accounts.zoho.in/",
        PORTAL="itdesk",
    )
    connector.access_token = "token"
    connector.access_token_expires_at = float("inf")
    return connector


def test_exposes_request_and_change_crud_tools():
    connector = _connector()
    assert connector.tool_names == [
        "create_change",
        "create_request",
        "delete_change",
        "delete_request",
        "get_change",
        "get_request",
        "list_changes",
        "list_requests",
        "update_change",
        "update_request",
    ]


def test_create_request_uses_form_encoded_input_data(monkeypatch):
    connector = _connector()
    captured = {}

    def fake_call_api(**kwargs):
        captured.update(kwargs)
        return _Response()

    monkeypatch.setattr(connector, "call_api", fake_call_api)

    result = connector.create_request({"subject": "VPN unavailable"})

    assert result["status"] == "success"
    assert captured["url"] == (
        "https://sdpondemand.manageengine.in/app/itdesk/api/v3/requests"
    )
    assert captured["method"] == "POST"
    assert captured["headers"]["Authorization"] == "Zoho-oauthtoken token"
    assert captured["headers"]["Content-Type"] == "application/x-www-form-urlencoded"
    assert json.loads(captured["data"]["input_data"]) == {
        "request": {"subject": "VPN unavailable"}
    }


def test_create_request_surfaces_internal_id_and_request_number(monkeypatch):
    connector = _connector()

    def fake_call_api(**kwargs):
        return _JsonResponse(
            {"request": {"id": "35131000000350002", "display_id": "10"}}
        )

    monkeypatch.setattr(connector, "call_api", fake_call_api)

    result = connector.create_request({"subject": "VPN unavailable"})

    assert result["request_id_for_updates"] == "35131000000350002"
    assert result["request_number"] == "10"
    assert result["request_identifiers"] == [
        {
            "request_id_for_updates": "35131000000350002",
            "request_number": "10",
        }
    ]


def test_list_changes_puts_list_info_in_query(monkeypatch):
    connector = _connector()
    captured = {}

    def fake_call_api(**kwargs):
        captured.update(kwargs)
        return _Response()

    monkeypatch.setattr(connector, "call_api", fake_call_api)

    connector.list_changes({"row_count": 25, "start_index": 1})

    assert captured["method"] == "GET"
    assert captured["data"] is None
    assert json.loads(captured["params"]["input_data"]) == {
        "list_info": {"row_count": 25, "start_index": 1}
    }


def test_change_requires_title():
    result = _connector().create_change({})
    assert result == {
        "status": "error",
        "code": 400,
        "message": "title is required.",
    }


def test_rejects_nonnumeric_request_ids_without_calling_api(monkeypatch):
    connector = _connector()

    def fail_call_api(**kwargs):
        raise AssertionError("must not call API")

    monkeypatch.setattr(connector, "call_api", fail_call_api)
    result = connector.get_request("REQ-123")
    assert result["status"] == "error"
    assert result["code"] == 400


def test_update_request_resolves_short_request_number(monkeypatch):
    connector = _connector()
    captured = []

    def fake_call_api(**kwargs):
        captured.append(kwargs)
        if len(captured) == 1:
            return _JsonResponse(
                {"requests": [{"id": "35131000000350002", "display_id": "10"}]}
            )
        return _JsonResponse(
            {"request": {"id": "35131000000350002", "display_id": "10"}}
        )

    monkeypatch.setattr(connector, "call_api", fake_call_api)

    result = connector.update_request("10", {"subject": "Updated"})

    assert result["status"] == "success"
    assert captured[0]["method"] == "GET"
    assert captured[0]["url"] == (
        "https://sdpondemand.manageengine.in/app/itdesk/api/v3/requests"
    )
    assert json.loads(captured[0]["params"]["input_data"]) == {
        "list_info": {
            "row_count": 1,
            "start_index": 1,
            "search_criteria": {
                "field": "display_id",
                "condition": "is",
                "value": "10",
            },
        }
    }
    assert captured[1]["method"] == "PUT"
    assert captured[1]["url"] == (
        "https://sdpondemand.manageengine.in/app/itdesk/api/v3/requests/"
        "35131000000350002"
    )
    assert result["request_id_for_updates"] == "35131000000350002"


def test_portal_is_optional():
    connector = ManageEngineServiceDeskConnector(
        CLIENT_ID="client-id",
        CLIENT_SECRET="client-secret",
        API_DOMAIN="https://sdpondemand.manageengine.com",
        ACCOUNTS_SERVER_URL="https://accounts.zoho.com",
    )
    assert connector.api_base == "https://sdpondemand.manageengine.com/api/v3"


def test_generates_access_token_with_client_credentials(monkeypatch):
    connector = ManageEngineServiceDeskConnector(
        CLIENT_ID="client-id",
        CLIENT_SECRET="client-secret",
        API_DOMAIN="https://sdpondemand.manageengine.in",
        ACCOUNTS_SERVER_URL="https://accounts.zoho.in",
    )
    captured = []

    class TokenResponse:
        status_code = 200
        text = "ok"

        @staticmethod
        def json():
            return {
                "access_token": "generated-token",
                "api_domain": "https://www.zohoapis.in",
                "expires_in": 3600,
            }

    def fake_call_api(**kwargs):
        captured.append(kwargs)
        return TokenResponse() if len(captured) == 1 else _Response()

    monkeypatch.setattr(connector, "call_api", fake_call_api)
    result = connector.get_request("35131000000350002")

    assert result["status"] == "success"
    assert captured[0]["url"] == "https://accounts.zoho.in/oauth/v2/token"
    assert captured[0]["data"] == {
        "client_id": "client-id",
        "client_secret": "client-secret",
        "grant_type": "client_credentials",
        "scope": "SDPOnDemand.requests.ALL,SDPOnDemand.changes.ALL",
    }
    assert captured[1]["url"] == (
        "https://sdpondemand.manageengine.in/api/v3/requests/35131000000350002"
    )
    assert captured[1]["headers"]["Authorization"] == (
        "Zoho-oauthtoken generated-token"
    )
