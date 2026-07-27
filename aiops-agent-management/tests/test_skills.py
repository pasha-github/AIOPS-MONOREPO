import io
import zipfile

from fastapi.testclient import TestClient
from sqlmodel import Session

from src.database.models import Skill

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_zip(
    skill_md: str,
    *,
    top_folder: str | None = None,
    extra_files: dict[str, str] | None = None,
) -> bytes:
    """Return in-memory zip bytes.

    If *top_folder* is given, all files are placed inside that folder (simulating
    a zip exported from a directory). Otherwise files sit at the root.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        prefix = f"{top_folder}/" if top_folder else ""
        zf.writestr(f"{prefix}skill.md", skill_md)
        for rel_path, content in (extra_files or {}).items():
            zf.writestr(f"{prefix}{rel_path}", content)
    return buf.getvalue()


_VALID_SKILL_MD = """\
---
name: my-test-skill
description: A skill for testing
---
Do the thing when asked.
"""

_VALID_SKILL_MD_WITH_TOOLS = """\
---
name: tool-skill
description: Skill with tools
tools:
  - search_tool
  - calc_tool
---
Use search_tool for queries and calc_tool for math.
"""


def _create_skill_json(client: TestClient, name: str = "json-skill") -> dict:
    response = client.post(
        "/skill/",
        json={
            "name": name,
            "description": "A JSON-created skill",
            "instructions": "Do things as instructed.",
        },
    )
    assert response.status_code == 200
    return response.json()


# ---------------------------------------------------------------------------
# JSON CRUD
# ---------------------------------------------------------------------------


def test_create_skill_json(client: TestClient):
    response = client.post(
        "/skill/",
        json={
            "name": "my-skill",
            "description": "Does something useful",
            "instructions": "Follow the user's request carefully.",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "my-skill"
    assert data["description"] == "Does something useful"
    assert data["instructions"] == "Follow the user's request carefully."
    assert data["tools"] == []
    assert data["references"] == {}
    assert data["assets"] == {}
    assert data["scripts"] == {}
    assert "skill_id" in data


def test_create_skill_json_unknown_tools_returns_400(client: TestClient):
    # Tools in the JSON endpoint must match a connected connector config or MCP
    # server. With none attached, any tool name is rejected.
    response = client.post(
        "/skill/",
        json={
            "name": "search-skill",
            "description": "Web search skill",
            "instructions": "Search the web.",
            "tools": ["web_search"],
        },
    )
    assert response.status_code == 400
    assert "web_search" in response.json()["detail"]


def test_create_skill_duplicate_name_returns_409(client: TestClient):
    _create_skill_json(client, "duplicate-skill")
    response = client.post(
        "/skill/",
        json={
            "name": "duplicate-skill",
            "description": "Another one",
            "instructions": "Duplicate.",
        },
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


def test_create_skill_invalid_name_returns_400(client: TestClient):
    response = client.post(
        "/skill/",
        json={
            "name": "My Invalid Skill Name!",
            "description": "Bad name",
            "instructions": "Whatever.",
        },
    )
    assert response.status_code == 400


def test_list_skills_empty(client: TestClient):
    response = client.get("/skill/")
    assert response.status_code == 200
    assert response.json() == []


def test_list_skills_returns_all(client: TestClient):
    _create_skill_json(client, "skill-one")
    _create_skill_json(client, "skill-two")
    response = client.get("/skill/")
    assert response.status_code == 200
    names = {s["name"] for s in response.json()}
    assert {"skill-one", "skill-two"} <= names


def test_get_skill_by_id(client: TestClient):
    created = _create_skill_json(client, "get-me")
    skill_id = created["skill_id"]
    response = client.get(f"/skill/{skill_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "get-me"


def test_get_skill_not_found_returns_404(client: TestClient):
    response = client.get("/skill/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_update_skill_description(client: TestClient):
    created = _create_skill_json(client, "patch-me")
    skill_id = created["skill_id"]
    response = client.patch(
        f"/skill/{skill_id}",
        json={"description": "Updated description"},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "Updated description"
    assert response.json()["name"] == "patch-me"


def test_update_skill_not_found_returns_404(client: TestClient):
    response = client.patch(
        "/skill/00000000-0000-0000-0000-000000000000",
        json={"description": "Won't matter"},
    )
    assert response.status_code == 404


def test_delete_skill(client: TestClient):
    created = _create_skill_json(client, "delete-me")
    skill_id = created["skill_id"]

    response = client.delete(f"/skill/{skill_id}")
    assert response.status_code == 200
    assert response.json() == {"success": True}

    assert client.get(f"/skill/{skill_id}").status_code == 404


def test_delete_skill_not_found_returns_404(client: TestClient):
    response = client.delete("/skill/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_delete_skill_in_use_returns_409(client: TestClient):
    skill = _create_skill_json(client, "in-use-skill")
    skill_id = skill["skill_id"]

    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "Gemini Pro",
            "api_key": "test-key",
            "description": "test",
        },
    )
    client.post(
        "/agent/",
        json={
            "agent_id": "skill-user-agent",
            "name": "Skill User",
            "description": "Uses a skill",
            "primary_use_global": False,
            "primary_model_id": "gemini-pro",
            "skill_ids": [skill_id],
            "isEnabled": True,
        },
    )

    response = client.delete(f"/skill/{skill_id}")
    assert response.status_code == 409
    assert "in use" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# ZIP upload — happy paths
# ---------------------------------------------------------------------------


def test_upload_skill_valid_zip(client: TestClient):
    zip_bytes = _make_zip(_VALID_SKILL_MD)
    response = client.post(
        "/skill/upload",
        files={"file": ("my-test-skill.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "my-test-skill"
    assert data["description"] == "A skill for testing"
    assert "Do the thing" in data["instructions"]


def test_upload_skill_in_top_level_folder(client: TestClient):
    """skill.md one level deep inside the zip (e.g. exported folder)."""
    zip_bytes = _make_zip(_VALID_SKILL_MD, top_folder="my-test-skill")
    response = client.post(
        "/skill/upload",
        files={"file": ("my-test-skill.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "my-test-skill"


def test_upload_skill_with_backslash_separators(client: TestClient):
    """Some Windows zip tools store entries with backslash separators
    instead of the ZIP-spec forward slash. Must extract correctly
    regardless of the OS running the server (e.g. a Linux container)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("my-test-skill\\skill.md", _VALID_SKILL_MD)
        zf.writestr("my-test-skill\\references\\guide.md", "# Guide")
        zf.writestr("my-test-skill\\scripts\\run.py", "print('hello')")
    response = client.post(
        "/skill/upload",
        files={"file": ("my-test-skill.zip", buf.getvalue(), "application/zip")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "my-test-skill"
    assert "guide.md" in data["references"]
    assert "run.py" in data["scripts"]


def test_upload_skill_with_mixed_case_entry_names(client: TestClient):
    """NTFS (Windows) is case-insensitive so "Skill.MD"/"References" resolve
    locally, but Linux filesystems (used by most Docker images) are
    case-sensitive. Uploads must succeed regardless of the OS running the
    server."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("Skill.MD", _VALID_SKILL_MD)
        zf.writestr("References/guide.md", "# Guide")
        zf.writestr("Assets/data.csv", "a,b")
        zf.writestr("SCRIPTS/run.py", "print('hello')")
    response = client.post(
        "/skill/upload",
        files={"file": ("mixed-case.zip", buf.getvalue(), "application/zip")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "my-test-skill"
    assert "guide.md" in data["references"]
    assert "data.csv" in data["assets"]
    assert "run.py" in data["scripts"]


def test_upload_skill_with_references_and_assets(client: TestClient):
    zip_bytes = _make_zip(
        _VALID_SKILL_MD,
        extra_files={
            "references/guide.md": "# Guide\nSome reference text.",
            "assets/data.csv": "col1,col2\nval1,val2",
        },
    )
    response = client.post(
        "/skill/upload",
        files={"file": ("my-test-skill.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "guide.md" in data["references"]
    assert "# Guide" in data["references"]["guide.md"]
    assert "data.csv" in data["assets"]


def test_upload_skill_with_scripts(client: TestClient):
    zip_bytes = _make_zip(
        _VALID_SKILL_MD,
        extra_files={"scripts/run.py": "print('hello')"},
    )
    response = client.post(
        "/skill/upload",
        files={"file": ("my-test-skill.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "run.py" in data["scripts"]
    assert "print" in data["scripts"]["run.py"]


def test_upload_skill_with_tools_in_frontmatter(client: TestClient):
    zip_bytes = _make_zip(_VALID_SKILL_MD_WITH_TOOLS)
    response = client.post(
        "/skill/upload",
        files={"file": ("tool-skill.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data["tools"]) == {"search_tool", "calc_tool"}


def test_upload_skill_script_filename_preserves_extension(client: TestClient):
    """Keys in scripts/references/assets dicts must include the file extension."""
    zip_bytes = _make_zip(
        _VALID_SKILL_MD,
        extra_files={
            "scripts/helper.py": "def greet(): return 'hi'",
            "references/notes.md": "# Notes",
            "assets/data.csv": "a,b",
        },
    )
    response = client.post(
        "/skill/upload",
        files={"file": ("my-test-skill.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "helper.py" in data["scripts"]
    assert "notes.md" in data["references"]
    assert "data.csv" in data["assets"]


# ---------------------------------------------------------------------------
# ZIP upload — error cases
# ---------------------------------------------------------------------------


def test_upload_skill_non_zip_returns_422(client: TestClient):
    response = client.post(
        "/skill/upload",
        files={"file": ("skill.txt", b"not a zip", "text/plain")},
    )
    assert response.status_code == 422


def test_upload_skill_invalid_zip_bytes_returns_422(client: TestClient):
    response = client.post(
        "/skill/upload",
        files={"file": ("skill.zip", b"\x00\x01\x02\x03junk", "application/zip")},
    )
    assert response.status_code == 422


def test_upload_skill_missing_skill_md_returns_422(client: TestClient):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("other.txt", "no skill here")
    response = client.post(
        "/skill/upload",
        files={"file": ("no-skill.zip", buf.getvalue(), "application/zip")},
    )
    assert response.status_code == 422
    assert "skill.md" in response.json()["detail"]


def test_upload_skill_missing_frontmatter_returns_422(client: TestClient):
    zip_bytes = _make_zip("Just plain instructions, no frontmatter block.")
    response = client.post(
        "/skill/upload",
        files={"file": ("bad.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 422
    assert "frontmatter" in response.json()["detail"].lower()


def test_upload_skill_missing_name_in_frontmatter_returns_422(client: TestClient):
    skill_md = """\
---
description: No name here
---
Instructions.
"""
    zip_bytes = _make_zip(skill_md)
    response = client.post(
        "/skill/upload",
        files={"file": ("nameless.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 422
    assert "name" in response.json()["detail"]


def test_upload_skill_missing_description_in_frontmatter_returns_422(
    client: TestClient,
):
    skill_md = """\
---
name: valid-name
---
Instructions.
"""
    zip_bytes = _make_zip(skill_md)
    response = client.post(
        "/skill/upload",
        files={"file": ("no-desc.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 422
    assert "description" in response.json()["detail"]


def test_upload_skill_missing_instructions_body_returns_422(client: TestClient):
    skill_md = """\
---
name: empty-body
description: Has no instructions
---
"""
    zip_bytes = _make_zip(skill_md)
    response = client.post(
        "/skill/upload",
        files={"file": ("empty-body.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 422
    assert "instructions" in response.json()["detail"]


def test_upload_skill_invalid_name_format_returns_400(client: TestClient):
    skill_md = """\
---
name: Invalid Name With Spaces!
description: Bad name format
---
Instructions.
"""
    zip_bytes = _make_zip(skill_md)
    response = client.post(
        "/skill/upload",
        files={"file": ("bad-name.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 400


def test_upload_skill_duplicate_name_returns_409(client: TestClient):
    zip_bytes = _make_zip(_VALID_SKILL_MD)
    client.post(
        "/skill/upload",
        files={"file": ("my-test-skill.zip", zip_bytes, "application/zip")},
    )
    response = client.post(
        "/skill/upload",
        files={"file": ("my-test-skill.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 409
    assert "my-test-skill" in response.json()["detail"]


def test_upload_skill_path_traversal_in_zip_returns_422(client: TestClient):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../evil.py", "malicious")
        zf.writestr("skill.md", _VALID_SKILL_MD)
    response = client.post(
        "/skill/upload",
        files={"file": ("traversal.zip", buf.getvalue(), "application/zip")},
    )
    assert response.status_code == 422
    assert "unsafe" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Upload result is queryable via the REST API
# ---------------------------------------------------------------------------


def test_uploaded_skill_appears_in_list(client: TestClient):
    zip_bytes = _make_zip(_VALID_SKILL_MD)
    client.post(
        "/skill/upload",
        files={"file": ("my-test-skill.zip", zip_bytes, "application/zip")},
    )
    names = {s["name"] for s in client.get("/skill/").json()}
    assert "my-test-skill" in names


def test_uploaded_skill_stored_in_db(client: TestClient, session: Session):
    zip_bytes = _make_zip(_VALID_SKILL_MD)
    response = client.post(
        "/skill/upload",
        files={"file": ("my-test-skill.zip", zip_bytes, "application/zip")},
    )
    skill_id = response.json()["skill_id"]
    from uuid import UUID

    db_skill = session.get(Skill, UUID(skill_id))
    assert db_skill is not None
    assert db_skill.name == "my-test-skill"
    assert db_skill.description == "A skill for testing"
