"""Docling layout parser (Pass 1) — calls the Docling Cloud Run service.

POSTs the raw document to ``/v1/convert/file`` (``to_formats=json``) and
traverses the returned DoclingDocument body tree in DFS reading order,
emitting one ``ParsedElement`` per text node, one per table row, and one per
picture (caption/placeholder). Sectioning is the normalizer's job (Pass 2).

Tree layout (Docling schema):
  body → children (groups/texts) → leaf nodes (texts, tables, pictures)
  Tables are children of text nodes (e.g. a heading has its table as a child).
  A ``visited`` set prevents double-visits when refs appear in multiple lists.

Auth: the Docling service is currently deployed publicly (no IAM), so
ingestion sends no ``Authorization`` header by default. If the service is
re-secured, set ``DOCLING_IDENTITY_TOKEN`` to a Bearer token and it is
attached automatically.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import requests

from src.ingestion.types import FetchedDocument, ParsedDocument, ParsedElement
from src.ingestion.util import groundtruth_hash, slug_from_path

logger = logging.getLogger(__name__)

DEFAULT_DOCLING_URL = "https://docling-serve-428716175586.us-central1.run.app"
CONVERT_PATH = "/v1/convert/file"
DEFAULT_TIMEOUT = 300  # Docling conversion can take a while on large PDFs


class DoclingParser:
    """Pass-1 parser backed by the Docling Cloud Run service."""

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (
            base_url or os.getenv("DOCLING_URL", DEFAULT_DOCLING_URL)
        ).rstrip("/")

    # ------------------------------------------------------------------ #
    # Auth
    # ------------------------------------------------------------------ #
    def _auth_headers(self) -> dict[str, str]:
        """Bearer header only if ``DOCLING_IDENTITY_TOKEN`` is set."""
        token = os.getenv("DOCLING_IDENTITY_TOKEN")
        return {"Authorization": f"Bearer {token.strip()}"} if token else {}

    # ------------------------------------------------------------------ #
    # Parse
    # ------------------------------------------------------------------ #
    def parse(self, doc: FetchedDocument) -> ParsedDocument:
        content = (
            doc.content
            if isinstance(doc.content, bytes)
            else doc.content.encode("utf-8")
        )
        file_name = doc.ref.name or "document"
        mime = doc.mime_type or doc.ref.mime_type or "application/octet-stream"

        response = requests.post(
            f"{self.base_url}{CONVERT_PATH}",
            headers=self._auth_headers(),
            files={"files": (file_name, content, mime)},
            data={
                "to_formats": "json",
                "do_ocr": "true",
                "table_mode": "accurate",
                "image_export_mode": "placeholder",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        if response.status_code != 200:
            raise RuntimeError(
                f"Docling convert failed ({response.status_code}) for "
                f"{doc.ref.path}: {response.text[:500]}"
            )

        payload = response.json()
        return self._to_parsed_document(doc, payload)

    # ------------------------------------------------------------------ #
    # Response -> elements (pure; unit-tested against the saved fixture)
    # ------------------------------------------------------------------ #
    def _to_parsed_document(
        self, doc: FetchedDocument, payload: dict[str, Any]
    ) -> ParsedDocument:
        document = payload.get("document") or {}
        json_content = document.get("json_content") or {}
        elements = self._elements_from_json(json_content)

        title = _first_heading(elements) or _stem(doc.ref.name or doc.ref.path)
        slug = slug_from_path(doc.ref.path, doc.ref.name)
        return ParsedDocument(
            ref=doc.ref,
            title=title,
            slug=slug,
            elements=elements,
            groundtruth_hash=groundtruth_hash(elements),
            metadata={
                "parser": "docling",
                "status": payload.get("status"),
                "source_filename": document.get("filename"),
            },
        )

    @staticmethod
    def _elements_from_json(json_content: dict[str, Any]) -> list[ParsedElement]:
        """Walk the DoclingDocument body tree in DFS reading order.

        Builds ref-to-node lookup maps for O(1) resolution, then does a
        depth-first traversal from ``body.children``. Texts are emitted as
        ``ParsedElement``s; tables are expanded to one element per row
        (``table_header`` / ``table_row``); pictures become a single caption
        or placeholder element. The ``furniture`` subtree (page headers/
        footers) is ignored.

        A ``visited`` set prevents double-visits — text nodes can appear in
        both a group's ``children`` list and as a ``parent`` reference.
        """

        # Build O(1) ref → node maps for each node type.
        def _make_map(key: str) -> dict[str, Any]:
            return {
                f"#{key}/{i}": node
                for i, node in enumerate(json_content.get(key.lstrip("/")) or [])
            }

        texts_map = {
            f"#/texts/{i}": node
            for i, node in enumerate(json_content.get("texts") or [])
        }
        tables_map = {
            f"#/tables/{i}": node
            for i, node in enumerate(json_content.get("tables") or [])
        }
        pictures_map = {
            f"#/pictures/{i}": node
            for i, node in enumerate(json_content.get("pictures") or [])
        }
        groups_map = {
            f"#/groups/{i}": node
            for i, node in enumerate(json_content.get("groups") or [])
        }

        elements: list[ParsedElement] = []
        visited: set[str] = set()

        def visit(ref: str) -> None:
            if ref in visited:
                return
            visited.add(ref)

            if ref.startswith("#/texts/"):
                node = texts_map.get(ref)
                if node is None:
                    return
                body_text = node.get("text")
                if body_text is not None:
                    prov_list = node.get("prov") or []
                    prov = prov_list[0] if prov_list else {}
                    elements.append(
                        ParsedElement(
                            element_ref=ref,
                            label=node.get("label", "text"),
                            text=body_text,
                            prov={
                                "page_no": prov.get("page_no"),
                                "bbox": prov.get("bbox"),
                            }
                            if prov
                            else {},
                        )
                    )
                # Recurse into children — tables/pictures are often children
                # of their parent heading text node.
                for child in node.get("children") or []:
                    child_ref = child.get("$ref")
                    if child_ref:
                        visit(child_ref)

            elif ref.startswith("#/tables/"):
                node = tables_map.get(ref)
                if node is None:
                    return
                table_idx = int(ref.rsplit("/", 1)[-1])
                elements.extend(_table_elements(node, table_idx))
                # Don't recurse into table children (rich-cell groups) —
                # cell text is already captured via the grid.

            elif ref.startswith("#/pictures/"):
                node = pictures_map.get(ref)
                if node is None:
                    return
                pic_idx = int(ref.rsplit("/", 1)[-1])
                elements.extend(_picture_elements(node, pic_idx))

            elif ref.startswith("#/groups/"):
                node = groups_map.get(ref)
                if node is None:
                    return
                for child in node.get("children") or []:
                    child_ref = child.get("$ref")
                    if child_ref:
                        visit(child_ref)

            # "#/body" and "#/furniture" are handled at the call site below.

        body = json_content.get("body") or {}
        for child_obj in body.get("children") or []:
            child_ref = child_obj.get("$ref")
            if child_ref:
                visit(child_ref)

        return elements


# --------------------------------------------------------------------------- #
# Module-level helpers (pure, unit-testable)
# --------------------------------------------------------------------------- #


def _table_elements(table_node: dict[str, Any], table_idx: int) -> list[ParsedElement]:
    """Expand a Docling table node into one ``ParsedElement`` per row.

    Header rows (all cells have ``column_header=True``) get
    ``label="table_header"``; all other rows get ``label="table_row"``.
    Row text is pipe-delimited: ``"Cell1 | Cell2 | Cell3"``.
    The ``element_ref`` encodes the stable row address for future edits:
    ``"#/tables/{table_idx}/row/{row_idx}"``.
    """
    grid = (table_node.get("data") or {}).get("grid") or []
    out: list[ParsedElement] = []
    for row_idx, row in enumerate(grid):
        if not row:
            continue
        is_header = all(cell.get("column_header", False) for cell in row if cell)
        row_text = " | ".join(cell.get("text", "") for cell in row)
        out.append(
            ParsedElement(
                element_ref=f"#/tables/{table_idx}/row/{row_idx}",
                label="table_header" if is_header else "table_row",
                text=row_text,
                prov={},
            )
        )
    return out


def _picture_elements(
    picture_node: dict[str, Any], pic_idx: int
) -> list[ParsedElement]:
    """Produce one ``ParsedElement`` for a picture: caption text or placeholder."""
    captions = picture_node.get("captions") or []
    if captions:
        cap = captions[0]
        text = cap.get("text", "") if isinstance(cap, dict) else str(cap)
        label = "image_caption"
    else:
        text = "[Image]"
        label = "image_placeholder"
    return [
        ParsedElement(
            element_ref=f"#/pictures/{pic_idx}",
            label=label,
            text=text,
            prov={},
        )
    ]


def _first_heading(elements: list[ParsedElement]) -> str | None:
    for el in elements:
        if el.label == "section_header" and el.text.strip():
            return el.text.strip()
    return None


def _stem(name: str) -> str:
    base = name.rsplit("/", 1)[-1]
    return base.rsplit(".", 1)[0] if "." in base else base
