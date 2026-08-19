"""
Tests for agent file upload, download, list, and delete endpoints.

Security-sensitive coverage:
- Disallowed file extensions are rejected (bypass prevention)
- Oversized files are rejected (DoS prevention)
- Download sets correct Content-Disposition header
- Delete removes file from agent.knowledge_file_ids (no orphan references)
- list_files returns 404 for unknown agents
"""

import io

from fastapi.testclient import TestClient


def _upload(
    client: TestClient,
    filename: str,
    content: bytes = b"data",
    content_type: str = "application/pdf",
):
    return client.post(
        "/agent/files",
        files={"file": (filename, io.BytesIO(content), content_type)},
    )


def _create_model(client: TestClient, model_id: str = "m1"):
    client.post(
        "/llms/",
        json={
            "model_id": model_id,
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "key",
            "description": "model",
        },
    )


def _create_agent(
    client: TestClient, agent_id: str = "a1", file_ids: list | None = None
):
    payload = {
        "agent_id": agent_id,
        "name": "Agent",
        "description": "desc",
        "primary_use_global": False,
        "primary_model_id": "m1",
        "isEnabled": True,
    }
    if file_ids is not None:
        payload["knowledge_file_ids"] = file_ids
    return client.post("/agent/", json=payload)


# ---------------------------------------------------------------------------
# Upload — allowed extensions
# ---------------------------------------------------------------------------


def test_upload_pdf_succeeds(client: TestClient):
    res = _upload(client, "report.pdf")
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    assert data["filename"] == "report.pdf"


def test_upload_docx_succeeds(client: TestClient):
    res = _upload(
        client,
        "doc.docx",
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert res.status_code == 200


def test_upload_csv_succeeds(client: TestClient):
    res = _upload(client, "data.csv", content_type="text/csv")
    assert res.status_code == 200


def test_upload_zip_succeeds(client: TestClient):
    res = _upload(client, "archive.zip", content_type="application/zip")
    assert res.status_code == 200


def test_upload_html_succeeds(client: TestClient):
    res = _upload(client, "page.html", content_type="text/html")
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# Upload — disallowed extensions (security: bypass prevention)
# ---------------------------------------------------------------------------


def test_upload_exe_rejected(client: TestClient):
    res = _upload(client, "malware.exe", content_type="application/octet-stream")
    assert res.status_code == 400
    assert "not allowed" in res.json()["detail"].lower()


def test_upload_py_rejected(client: TestClient):
    res = _upload(client, "script.py", content_type="text/plain")
    assert res.status_code == 400


def test_upload_js_rejected(client: TestClient):
    res = _upload(client, "inject.js", content_type="text/javascript")
    assert res.status_code == 400


def test_upload_no_extension_rejected(client: TestClient):
    res = _upload(client, "noextension", content_type="application/pdf")
    assert res.status_code == 400


def test_upload_double_extension_uses_last(client: TestClient):
    # "report.pdf.exe" — last extension is .exe, must be rejected
    res = _upload(client, "report.pdf.exe", content_type="application/octet-stream")
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Upload — size limit (security: DoS prevention)
# ---------------------------------------------------------------------------


def test_upload_oversized_file_rejected(client: TestClient):
    big = b"x" * (50 * 1024 * 1024 + 1)  # 50MB + 1 byte
    res = _upload(client, "big.pdf", content=big)
    assert res.status_code == 400
    assert "50mb" in res.json()["detail"].lower()


def test_upload_exactly_at_limit_accepted(client: TestClient):
    # Exactly 50MB should pass
    at_limit = b"x" * (50 * 1024 * 1024)
    res = _upload(client, "limit.pdf", content=at_limit)
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# Upload — response fields
# ---------------------------------------------------------------------------


def test_upload_returns_correct_size(client: TestClient):
    content = b"hello world"
    res = _upload(client, "note.pdf", content=content)
    assert res.status_code == 200
    assert res.json()["size"] == len(content)


def test_upload_returns_id_and_created_at(client: TestClient):
    res = _upload(client, "note.pdf")
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    assert "created_at" in data


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------


def test_download_returns_file_content(client: TestClient):
    content = b"pdf content here"
    file_id = _upload(client, "doc.pdf", content=content).json()["id"]
    res = client.get(f"/agent/files/{file_id}")
    assert res.status_code == 200
    assert res.content == content


def test_download_sets_content_disposition_header(client: TestClient):
    file_id = _upload(client, "report.pdf").json()["id"]
    res = client.get(f"/agent/files/{file_id}")
    assert res.status_code == 200
    assert "attachment" in res.headers["content-disposition"]
    assert "report.pdf" in res.headers["content-disposition"]


def test_download_sets_correct_media_type(client: TestClient):
    file_id = _upload(client, "data.csv", content_type="text/csv").json()["id"]
    res = client.get(f"/agent/files/{file_id}")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]


def test_download_not_found_returns_404(client: TestClient):
    res = client.get("/agent/files/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# List files
# ---------------------------------------------------------------------------


def test_list_files_agent_not_found_returns_404(client: TestClient):
    res = client.get("/agent/ghost/files")
    assert res.status_code == 404


def test_list_files_uses_get_session_dependency_structural():
    """
    Structural: all agent_files endpoints must use Depends(get_session) so the
    test session override works and tables exist in the test database.
    Using Session(engine) directly bypasses the override and hits the global
    engine where the agent_file table may not exist (e.g. on CI).
    """
    import inspect

    import src.routers.agent_files as af_module

    full_source = inspect.getsource(af_module)
    assert "Depends(get_session)" in full_source, (
        "agent_files endpoints must use Depends(get_session) — "
        "Session(engine) directly bypasses the test session override and breaks CI"
    )
    assert "Session(engine)" not in full_source, (
        "agent_files must not use Session(engine) directly — use Depends(get_session)"
    )


def test_list_files_empty_when_no_files_attached(client: TestClient):
    _create_model(client)
    _create_agent(client)
    res = client.get("/agent/a1/files")
    assert res.status_code == 200
    assert res.json() == []


def test_list_files_returns_attached_files(client: TestClient):
    _create_model(client)
    file_id = _upload(client, "doc.pdf").json()["id"]
    _create_agent(client, file_ids=[file_id])
    res = client.get("/agent/a1/files")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == file_id


def test_list_files_ignores_unknown_file_ids(client: TestClient):
    _create_model(client)
    _create_agent(client, file_ids=["00000000-0000-0000-0000-000000000000"])
    res = client.get("/agent/a1/files")
    assert res.status_code == 200
    assert res.json() == []


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


def test_delete_file_returns_204(client: TestClient):
    file_id = _upload(client, "doc.pdf").json()["id"]
    res = client.delete(f"/agent/files/{file_id}")
    assert res.status_code == 204


def test_delete_file_not_found_returns_404(client: TestClient):
    res = client.delete("/agent/files/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


def test_delete_file_makes_download_unavailable(client: TestClient):
    file_id = _upload(client, "doc.pdf").json()["id"]
    client.delete(f"/agent/files/{file_id}")
    res = client.get(f"/agent/files/{file_id}")
    assert res.status_code == 404


def test_delete_file_removes_from_agent_knowledge_file_ids(client: TestClient):
    """Deleting a file must remove its ID from agent.knowledge_file_ids."""
    _create_model(client)
    file_id = _upload(client, "doc.pdf").json()["id"]
    _create_agent(client, file_ids=[file_id])

    client.delete(f"/agent/files/{file_id}")

    res = client.get("/agent/a1/files")
    assert res.status_code == 200
    assert res.json() == []


def test_delete_file_removes_only_target_from_agent(client: TestClient):
    """Deleting one file must not remove other file IDs from the agent."""
    _create_model(client)
    id1 = _upload(client, "keep.pdf").json()["id"]
    id2 = _upload(client, "delete.pdf").json()["id"]
    _create_agent(client, file_ids=[id1, id2])

    client.delete(f"/agent/files/{id2}")

    res = client.get("/agent/a1/files")
    assert res.status_code == 200
    ids = [f["id"] for f in res.json()]
    assert id1 in ids
    assert id2 not in ids


def test_delete_file_removes_from_multiple_agents(client: TestClient):
    """A file referenced by multiple agents must be cleaned from all of them."""
    _create_model(client)
    file_id = _upload(client, "shared.pdf").json()["id"]
    _create_agent(client, agent_id="a1", file_ids=[file_id])
    _create_agent(client, agent_id="a2", file_ids=[file_id])

    client.delete(f"/agent/files/{file_id}")

    assert client.get("/agent/a1/files").json() == []
    assert client.get("/agent/a2/files").json() == []
