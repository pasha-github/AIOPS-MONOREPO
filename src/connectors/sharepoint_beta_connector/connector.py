"""
SharePoint Beta Connector v1.0.0
Extends SharePoint connector with .docx support for content read/write and comment management.
"""

from __future__ import annotations

import base64
import contextlib
import io
import os
import posixpath
import tempfile
import time
from pathlib import Path
from typing import Any, cast
from urllib.parse import quote, urlparse

import pypdf
import requests as _requests

try:
    from base_connector import BaseConnector, connector_tool
except ModuleNotFoundError:
    from src.connectors.base_connector import BaseConnector, connector_tool

WNS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
W14NS = "{http://schemas.microsoft.com/office/word/2010/wordml}"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Heading style id -> (space before, space after) in twips (20 twips = 1pt)
_HEADING_SPACING = {
    "Heading1": ("360", "160"),  # 18pt before, 8pt after
    "Heading2": ("280", "120"),  # 14pt before, 6pt after
    "Heading3": ("240", "120"),
    "Heading4": ("200", "80"),
    "Heading5": ("200", "80"),
    "Heading6": ("200", "80"),
}


class SharepointBetaConnector(BaseConnector):
    """SharePoint connector with .docx content and comment support via Microsoft Graph."""

    def __init__(
        self,
        SHP_ID_APP: str,
        SHP_ID_APP_SECRET: str,
        SHP_TENANT_ID: str,
        SHP_SITE_URL: str,
        SHP_DOC_LIBRARY: str,
        prefix: str = "",
    ):
        super().__init__(prefix=prefix)
        self.client_id = SHP_ID_APP.strip()
        self.client_secret = SHP_ID_APP_SECRET.strip()
        self.tenant_id = SHP_TENANT_ID.strip()
        self.site_url = SHP_SITE_URL.strip().rstrip("/")
        self.doc_library = SHP_DOC_LIBRARY.strip().strip("/")
        self.graph_base_url = "https://graph.microsoft.com/v1.0"
        self.token_url = (
            f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        )
        self._access_token: str | None = None
        self._access_token_expires_at: float = 0.0
        self._site_id: str | None = None

    # ── Config & Auth ──────────────────────────────────────────────────────────

    def _validate_config(self) -> str | None:
        if not self.client_id:
            return "SHP_ID_APP is required."
        if not self.client_secret:
            return "SHP_ID_APP_SECRET is required."
        if not self.tenant_id:
            return "SHP_TENANT_ID is required."
        if not self.site_url:
            return "SHP_SITE_URL is required."
        if not self.doc_library:
            return "SHP_DOC_LIBRARY is required."
        return None

    def _parse_site_url(self) -> tuple[str, str, str] | None:
        parsed = urlparse(self.site_url)
        host = parsed.netloc
        path = (parsed.path or "").strip("/")
        if not host or not path:
            return None
        parts = [p for p in path.split("/") if p]
        if len(parts) < 2:
            return None
        site_path = f"/{'/'.join(parts)}"
        return host, parts[0], site_path

    def _get_access_token(self) -> dict[str, Any]:
        now = time.time()
        if self._access_token and now < (self._access_token_expires_at - 300):
            return {"status": "success", "access_token": self._access_token}

        response = self.call_api(
            url=self.token_url,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials",
            },
        )

        if response.status_code == 401:
            return {
                "status": "error",
                "code": 401,
                "message": "Authentication failed. Check SHP_TENANT_ID, SHP_ID_APP, and SHP_ID_APP_SECRET.",
            }
        if response.status_code == 403:
            return {
                "status": "error",
                "code": 403,
                "message": "Token request forbidden. Verify app permissions and tenant policy.",
                "details": response.text,
            }
        if response.status_code == 429:
            return {
                "status": "error",
                "code": 429,
                "message": "Token endpoint rate limit exceeded. Retry after a short delay.",
                "details": response.text,
            }
        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Failed to fetch Microsoft Graph access token.",
                "details": response.text,
            }

        try:
            payload = response.json()
        except ValueError:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Token endpoint returned a non-JSON response.",
            }

        token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 3600))
        if not token:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Token endpoint did not return an access token.",
            }

        self._access_token = token
        self._access_token_expires_at = now + expires_in
        return {"status": "success", "access_token": token}

    def _graph_request(
        self,
        endpoint: str,
        method: str = "GET",
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        auth = self._get_access_token()
        if auth["status"] != "success":
            return auth

        req_headers: dict[str, str] = {
            "Accept": "application/json",
            "Authorization": f"Bearer {auth['access_token']}",
        }
        if headers:
            req_headers.update(headers)

        response = self.call_api(
            url=f"{self.graph_base_url}{endpoint}",
            method=method,
            headers=req_headers,
            json=data,
        )

        if response.status_code == 401:
            return {
                "status": "error",
                "code": 401,
                "message": "Authentication failed when calling Microsoft Graph.",
            }
        if response.status_code == 403:
            return {
                "status": "error",
                "code": 403,
                "message": "Forbidden. The app likely lacks required SharePoint/Graph permissions.",
                "details": response.text,
            }
        if response.status_code == 404:
            return {
                "status": "error",
                "code": 404,
                "message": "The requested SharePoint resource was not found.",
                "details": response.text,
            }
        if response.status_code == 429:
            return {
                "status": "error",
                "code": 429,
                "message": "Microsoft Graph rate limit exceeded. Retry after a short delay.",
                "details": response.text,
            }
        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Microsoft Graph request failed.",
                "details": response.text,
            }
        if response.status_code in (202, 204):
            return {"status": "success", "data": None}

        content_type = (response.headers.get("Content-Type") or "").lower()
        if "application/json" in content_type:
            try:
                return {"status": "success", "data": response.json()}
            except ValueError:
                return {
                    "status": "error",
                    "code": 500,
                    "message": "Graph returned invalid JSON.",
                }

        return {"status": "success", "data": response.content}

    def _get_site_id(self) -> dict[str, Any]:
        if self._site_id:
            return {"status": "success", "site_id": self._site_id}

        parsed = self._parse_site_url()
        if parsed is None:
            return {
                "status": "error",
                "code": 400,
                "message": "Invalid SHP_SITE_URL format.",
            }

        host, _, site_path = parsed
        result = self._graph_request(f"/sites/{host}:{site_path}")
        if result["status"] != "success":
            return result

        site_id = (result.get("data") or {}).get("id")
        if not site_id:
            return {
                "status": "error",
                "code": 500,
                "message": "Unable to resolve SharePoint site ID.",
            }

        self._site_id = site_id
        return {"status": "success", "site_id": site_id}

    def _normalize_path(self, document_path: str | None = None) -> str:
        raw_path = (document_path or "").strip()
        if raw_path.startswith("/drive/root:/"):
            raw_path = raw_path[len("/drive/root:/") :]
        elif raw_path.startswith("drive/root:/"):
            raw_path = raw_path[len("drive/root:/") :]

        clean_path = posixpath.normpath(f"/{raw_path}").lstrip("/") if raw_path else ""
        if clean_path.startswith(".."):
            raise ValueError("Invalid path traversal attempt.")

        scope_prefix = f"{self.doc_library}/"
        if clean_path == self.doc_library or clean_path.startswith(scope_prefix):
            return clean_path
        if clean_path:
            return f"{self.doc_library}/{clean_path}".strip("/")
        return self.doc_library

    def _build_children_endpoint(self, site_id: str, folder_path: str) -> str:
        if folder_path:
            return f"/sites/{site_id}/drive/root:/{quote(folder_path)}:/children"
        return f"/sites/{site_id}/drive/root/children"

    def _build_item_endpoint(self, site_id: str, file_path: str) -> str:
        return f"/sites/{site_id}/drive/root:/{quote(file_path)}"

    # ── docx helpers ───────────────────────────────────────────────────────────

    @contextlib.contextmanager
    def _docx_doc(self, docx_bytes: bytes):
        """Yield an opened docx-mcp DocxDocument backed by docx_bytes in a temp file.

        Yields (doc, tmp_path). docx-mcp handles all OOXML bookkeeping
        ([Content_Types].xml, relationships, paraId dedup) on save() — call
        doc.save(backup=False) inside the block, then read tmp_path for the
        resulting bytes. The temp file and the document are cleaned up on exit.
        """
        from docx_mcp.document import DocxDocument as DocxMcpDocument

        tmp_fd, tmp_name = tempfile.mkstemp(suffix=".docx")
        tmp_path = Path(tmp_name)
        try:
            with os.fdopen(tmp_fd, "wb") as fh:
                fh.write(docx_bytes)
            doc = DocxMcpDocument(str(tmp_path))
            doc.open()
            try:
                yield doc, tmp_path
            finally:
                with contextlib.suppress(Exception):
                    doc.close()
        finally:
            with contextlib.suppress(OSError):
                tmp_path.unlink()

    def _extract_docx_text(self, docx_bytes: bytes) -> str:
        with self._docx_doc(docx_bytes) as (doc, _tmp_path):
            root = doc._tree("word/document.xml")
            if root is None:
                return ""
            parts: list[str] = []
            for para in root.iter(f"{WNS}p"):
                text = doc._text(para)
                if text:
                    parts.append(text)
            return "\n".join(parts)

    def _extract_docx_comments(self, docx_bytes: bytes) -> list[dict[str, Any]]:
        with self._docx_doc(docx_bytes) as (doc, _tmp_path):
            return [
                {
                    "id": str(c.get("id", "")),
                    "author": c.get("author", ""),
                    "date": c.get("date", ""),
                    "text": c.get("text", ""),
                }
                for c in doc.get_comments()
            ]

    def _modify_docx_comment(
        self, docx_bytes: bytes, comment_id: str, new_text: str
    ) -> bytes | None:
        with self._docx_doc(docx_bytes) as (doc, tmp_path):
            if not any(str(c["id"]) == comment_id for c in doc.get_comments()):
                return None
            try:
                doc.update_comment(int(comment_id), new_text)
            except (ValueError, KeyError):
                return None
            doc.save(backup=False)
            return tmp_path.read_bytes()

    def _reply_to_docx_comment(
        self, docx_bytes: bytes, parent_comment_id: str, reply_text: str, author: str
    ) -> bytes | None:
        with self._docx_doc(docx_bytes) as (doc, tmp_path):
            if not any(str(c["id"]) == parent_comment_id for c in doc.get_comments()):
                return None
            try:
                result = doc.reply_to_comment(
                    int(parent_comment_id), reply_text, author=author
                )
            except (ValueError, KeyError):
                return None
            # docx-mcp threads the reply in commentsExtended.xml but does not
            # anchor it in document.xml. Word only renders a comment that has a
            # commentReference, so add one next to the parent's reference.
            self._anchor_reply_reference(
                doc, parent_comment_id, str(result["comment_id"])
            )
            doc.save(backup=False)
            return tmp_path.read_bytes()

    @staticmethod
    def _anchor_reply_reference(doc: Any, parent_id: str, reply_id: str) -> None:
        """Add a CommentReference run for reply_id beside the parent's reference
        in document.xml, so Word displays the threaded reply."""
        from lxml import etree  # type: ignore[import-untyped]

        root = doc._tree("word/document.xml")
        if root is None:
            return
        for ref in root.iter(f"{WNS}commentReference"):
            if ref.get(f"{WNS}id") == parent_id:
                parent_run = ref.getparent()
                new_run = etree.Element(f"{WNS}r")
                rpr = etree.SubElement(new_run, f"{WNS}rPr")
                rstyle = etree.SubElement(rpr, f"{WNS}rStyle")
                rstyle.set(f"{WNS}val", "CommentReference")
                cref = etree.SubElement(new_run, f"{WNS}commentReference")
                cref.set(f"{WNS}id", reply_id)
                parent_run.addnext(new_run)
                doc._mark("word/document.xml")
                return

    def _add_docx_comment(
        self, docx_bytes: bytes, anchor_text: str, comment_text: str, author: str
    ) -> tuple[bytes, str] | None:
        """Add a comment anchored to the first paragraph containing anchor_text.

        Returns (new_docx_bytes, new_comment_id) or None if anchor_text is not found.
        """
        with self._docx_doc(docx_bytes) as (doc, tmp_path):
            root = doc._tree("word/document.xml")
            if root is None:
                return None

            target = None
            for para in root.iter(f"{WNS}p"):
                if anchor_text.lower() in doc._text(para).lower():
                    target = para
                    break
            if target is None:
                return None

            # docx-mcp anchors comments by paraId; assign one if the paragraph lacks it
            para_id = target.get(f"{W14NS}paraId")
            if not para_id:
                para_id = doc._new_para_id()
                target.set(f"{W14NS}paraId", para_id)
                doc._mark("word/document.xml")

            result = doc.add_comment(para_id, comment_text, author=author)
            doc.save(backup=False)
            return tmp_path.read_bytes(), str(result["comment_id"])

    def _render_markdown(self, doc: Any, content: str) -> None:
        """Render markdown into the open doc's body, then fix table widths.

        MarkdownConverter clears the body before rendering, so skip empty
        content to avoid leaving an invalid empty body.
        """
        from docx_mcp.markdown import MarkdownConverter

        if not content.strip():
            return
        MarkdownConverter.convert(doc, content)
        self._normalize_tables(doc)
        self._fix_list_numbering(doc)
        self._apply_paragraph_spacing(doc)

    @staticmethod
    def _apply_paragraph_spacing(doc: Any) -> None:
        """Add paragraph spacing so content isn't cramped.

        docx-mcp's styles.xml defines no spacing, so Word packs every line
        tight. Inject a docDefaults baseline (10pt after + 1.15 line spacing)
        and explicit space-before on each heading so sections separate clearly.
        Skipped if the doc already defines docDefaults, so existing real Word
        documents keep their own spacing on update.
        """
        from lxml import etree  # type: ignore[import-untyped]

        styles = doc._tree("word/styles.xml")
        if styles is None or styles.find(f"{WNS}docDefaults") is not None:
            return

        # 1. Document-wide baseline for body paragraphs
        doc_defaults = etree.Element(f"{WNS}docDefaults")
        ppr = etree.SubElement(
            etree.SubElement(doc_defaults, f"{WNS}pPrDefault"), f"{WNS}pPr"
        )
        base = etree.SubElement(ppr, f"{WNS}spacing")
        base.set(f"{WNS}after", "200")  # 10pt after each paragraph
        base.set(f"{WNS}line", "276")  # 1.15x line spacing
        base.set(f"{WNS}lineRule", "auto")
        styles.insert(0, doc_defaults)  # docDefaults must be first child of w:styles

        # 2. Extra space before/after headings for clear section breaks
        for style in styles.findall(f"{WNS}style"):
            sid = style.get(f"{WNS}styleId")
            if sid not in _HEADING_SPACING:
                continue
            style_ppr = style.find(f"{WNS}pPr")
            if style_ppr is None:
                style_ppr = etree.Element(f"{WNS}pPr")
                rpr = style.find(f"{WNS}rPr")
                if rpr is not None:
                    rpr.addprevious(style_ppr)  # pPr precedes rPr in CT_Style
                else:
                    style.append(style_ppr)
            spacing = style_ppr.find(f"{WNS}spacing")
            if spacing is None:
                spacing = etree.Element(f"{WNS}spacing")
                style_ppr.insert(0, spacing)  # spacing precedes outlineLvl in CT_PPr
            before, after = _HEADING_SPACING[sid]
            spacing.set(f"{WNS}before", before)
            spacing.set(f"{WNS}after", after)

        doc._mark("word/styles.xml")

    @staticmethod
    def _fix_list_numbering(doc: Any) -> None:
        """Make ordered lists start at 1.

        docx-mcp's numbering.xml defines numbered levels without a <w:start>,
        which Word renders starting at 0 (0., 1., 2.). Insert <w:start w:val="1"/>
        on every non-bullet level so ordered lists number from 1.
        """
        from lxml import etree  # type: ignore[import-untyped]

        num_tree = doc._tree("word/numbering.xml")
        if num_tree is None:
            return

        changed = False
        for lvl in num_tree.iter(f"{WNS}lvl"):
            num_fmt = lvl.find(f"{WNS}numFmt")
            if num_fmt is None or num_fmt.get(f"{WNS}val") == "bullet":
                continue  # bullets ignore start
            start = lvl.find(f"{WNS}start")
            if start is None:
                start = etree.Element(f"{WNS}start")
                start.set(f"{WNS}val", "1")
                lvl.insert(0, start)  # <w:start> must be the first child of <w:lvl>
                changed = True
            elif start.get(f"{WNS}val") in (None, "0"):
                start.set(f"{WNS}val", "1")
                changed = True

        if changed:
            doc._mark("word/numbering.xml")

    @staticmethod
    def _normalize_tables(doc: Any) -> None:
        """Give markdown-rendered tables explicit grid + cell widths.

        docx-mcp emits tables with `tblW w="0" type="auto"` and no `tblGrid`,
        which Word Online renders with collapsed (zero-width) columns. Set a
        fixed table width, a `tblGrid`, and per-cell widths so columns display.
        """
        from lxml import etree  # type: ignore[import-untyped]

        content_width = 9000  # twips; fits both US Letter and A4 content areas
        root = doc._tree("word/document.xml")
        if root is None:
            return

        changed = False
        for tbl in root.iter(f"{WNS}tbl"):
            rows = tbl.findall(f"{WNS}tr")
            ncols = max((len(r.findall(f"{WNS}tc")) for r in rows), default=0)
            if ncols == 0:
                continue
            col_w = max(content_width // ncols, 1)
            total_w = col_w * ncols

            tbl_pr = tbl.find(f"{WNS}tblPr")
            if tbl_pr is not None:
                tw = tbl_pr.find(f"{WNS}tblW")
                if tw is None:
                    tw = etree.SubElement(tbl_pr, f"{WNS}tblW")
                tw.set(f"{WNS}w", str(total_w))
                tw.set(f"{WNS}type", "dxa")

            # Replace any existing grid; place it right after tblPr
            old_grid = tbl.find(f"{WNS}tblGrid")
            if old_grid is not None:
                tbl.remove(old_grid)
            grid = etree.Element(f"{WNS}tblGrid")
            for _ in range(ncols):
                etree.SubElement(grid, f"{WNS}gridCol").set(f"{WNS}w", str(col_w))
            if tbl_pr is not None:
                tbl_pr.addnext(grid)
            else:
                tbl.insert(0, grid)

            # Per-cell width (tcPr must be the first child of tc)
            for r in rows:
                for tc in r.findall(f"{WNS}tc"):
                    tc_pr = tc.find(f"{WNS}tcPr")
                    if tc_pr is None:
                        tc_pr = etree.Element(f"{WNS}tcPr")
                        tc.insert(0, tc_pr)
                    tcw = tc_pr.find(f"{WNS}tcW")
                    if tcw is None:
                        tcw = etree.SubElement(tc_pr, f"{WNS}tcW")
                    tcw.set(f"{WNS}w", str(col_w))
                    tcw.set(f"{WNS}type", "dxa")
            changed = True

        if changed:
            doc._mark("word/document.xml")

    def _create_docx_bytes(self, content: str) -> bytes:
        """Render markdown content into a new formatted .docx.

        content is treated as markdown (headings, bold/italic, lists, tables,
        code, blockquotes). Plain text is valid markdown; paragraphs are
        separated by blank lines.
        """
        from docx_mcp.document import DocxDocument as DocxMcpDocument

        tmp_fd, tmp_name = tempfile.mkstemp(suffix=".docx")
        os.close(tmp_fd)
        tmp_path = Path(tmp_name)
        try:
            # create() returns an opened blank doc with a single empty paragraph
            doc: Any = DocxMcpDocument.create(str(tmp_path))
            try:
                self._render_markdown(doc, content)
                doc.save(backup=False)
                return tmp_path.read_bytes()
            finally:
                with contextlib.suppress(Exception):
                    doc.close()
        finally:
            with contextlib.suppress(OSError):
                tmp_path.unlink()

    def _update_docx_content(self, existing_bytes: bytes, content: str) -> bytes:
        """Replace a docx body with rendered markdown while preserving comments.

        content is treated as markdown. The comment-anchor paragraphs are held
        across the markdown render (which clears the body) and re-inserted, so
        existing comments stay visible. save() handles OOXML bookkeeping.
        """
        _COMMENT_RELATED = {
            f"{WNS}commentRangeStart",
            f"{WNS}commentRangeEnd",
            f"{WNS}commentReference",
        }

        with self._docx_doc(existing_bytes) as (doc, tmp_path):
            root = doc._tree("word/document.xml")
            body = root.find(f"{WNS}body") if root is not None else None
            if body is None:
                return self._create_docx_bytes(content)

            # Collect comment-anchor paragraphs before rendering. We keep the
            # element references; MarkdownConverter.convert() detaches them from
            # the body but they can be re-inserted afterwards.
            comment_paragraphs = []
            for child in list(body):
                if child.tag == f"{WNS}sectPr":
                    continue
                if any(el.tag in _COMMENT_RELATED for el in child.iter()):
                    for t in child.findall(f".//{WNS}t"):
                        t.text = ""
                    comment_paragraphs.append(child)

            # Render markdown (clears existing body paragraphs/tables, inserts
            # new content before sectPr; empty content is skipped so the body
            # is not left empty/invalid).
            self._render_markdown(doc, content)

            # Re-insert preserved comment anchors after the new content.
            sect_pr = body.find(f"{WNS}sectPr")
            for cp in comment_paragraphs:
                if sect_pr is not None:
                    sect_pr.addprevious(cp)
                else:
                    body.append(cp)

            doc._mark("word/document.xml")
            doc.save(backup=False)
            return tmp_path.read_bytes()

    def _upload_binary(
        self, site_id: str, full_path: str, token: str, data: bytes, content_type: str
    ) -> Any:
        # Direct content PUT (not a chunked upload session). The files this
        # connector writes are small, and a single PUT can never leave an
        # orphaned upload session behind — which is what produced the lingering
        # "a file with the same name is currently being uploaded" error after a
        # failed write.
        upload_url = (
            f"{self.graph_base_url}"
            f"{self._build_item_endpoint(site_id, full_path)}:/content"
        )
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": content_type,
        }

        try:
            return _requests.put(upload_url, headers=headers, data=data, timeout=300)
        except _requests.exceptions.ConnectionError as exc:
            raise ConnectionError(f"Upload failed — connection dropped: {exc}") from exc

    def _download_docx_binary(self, site_id: str, full_path: str) -> dict[str, Any]:
        content_result = self._graph_request(
            f"{self._build_item_endpoint(site_id, full_path)}:/content"
        )
        if content_result["status"] != "success":
            return content_result
        binary = content_result.get("data")
        if not isinstance(binary, (bytes, bytearray)):
            return {
                "status": "error",
                "code": 500,
                "message": "Unexpected content response from Graph.",
            }
        return {"status": "success", "data": bytes(binary)}

    # ── Tools ──────────────────────────────────────────────────────────────────

    @connector_tool
    def list_documents(self, relative_folder_path: str = "") -> dict[str, Any]:
        """List documents in the configured SharePoint library scope.

        Args:
            relative_folder_path: Optional subfolder path within the library. Leave blank for root.
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            folder_path = self._normalize_path(relative_folder_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        endpoint = self._build_children_endpoint(site["site_id"], folder_path)
        result = self._graph_request(endpoint)
        if result["status"] != "success":
            return result

        items = (result.get("data") or {}).get("value", [])
        files = [i for i in items if "file" in i]

        return {
            "status": "success",
            "folder": relative_folder_path,
            "documents": [
                {
                    "name": item.get("name"),
                    "path": item.get("parentReference", {}).get("path"),
                    "url": item.get("webUrl"),
                    "size": item.get("size"),
                    "created": item.get("createdDateTime"),
                    "modified": item.get("lastModifiedDateTime"),
                    "mime_type": (item.get("file") or {}).get("mimeType"),
                }
                for item in files
            ],
        }

    @connector_tool
    def get_document_content(self, document_path: str) -> dict[str, Any]:
        """Get document content from SharePoint.

        .md and text files are returned as plain text.
        .docx files are returned as extracted plain text.
        .pdf files are returned as extracted plain text.
        All other binary files are returned as Base64.

        Args:
            document_path: Path to the document within the configured library.
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}
        if not document_path.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "document_path is required.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            full_path = self._normalize_path(document_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        metadata_result = self._graph_request(
            self._build_item_endpoint(site["site_id"], full_path)
        )
        if metadata_result["status"] != "success":
            return metadata_result

        content_result = self._graph_request(
            f"{self._build_item_endpoint(site['site_id'], full_path)}:/content"
        )
        if content_result["status"] != "success":
            return content_result

        binary = content_result.get("data")
        if not isinstance(binary, (bytes, bytearray)):
            return {
                "status": "error",
                "code": 500,
                "message": "Unexpected content response from Graph.",
            }

        binary = bytes(binary)
        metadata = metadata_result.get("data") or {}
        mime_type = ((metadata.get("file") or {}).get("mimeType") or "").lower()
        lower_path = document_path.lower()

        # .docx → extract plain text
        if lower_path.endswith(".docx"):
            try:
                text = self._extract_docx_text(binary)
            except Exception as exc:
                return {
                    "status": "error",
                    "code": 500,
                    "message": f"Failed to extract docx text: {exc}",
                }
            return {
                "status": "success",
                "document_path": document_path,
                "mime_type": mime_type,
                "content": text,
                "encoding": "utf-8",
            }

        # Text-based files → plain text
        if (
            mime_type.startswith("text/")
            or mime_type in {"application/json", "application/xml"}
            or lower_path.endswith(
                (".md", ".txt", ".json", ".xml", ".yaml", ".yml", ".py")
            )
        ):
            try:
                text_content = binary.decode("utf-8")
            except UnicodeDecodeError:
                text_content = binary.decode("utf-8", errors="replace")
            return {
                "status": "success",
                "document_path": document_path,
                "mime_type": mime_type,
                "content": text_content,
                "encoding": "utf-8",
            }

        # .pdf → extract plain text
        if lower_path.endswith(".pdf") or mime_type == "application/pdf":
            try:
                reader = pypdf.PdfReader(io.BytesIO(binary))
                pages_text = []
                for page in reader.pages:
                    page_text = page.extract_text() or ""
                    if page_text.strip():
                        pages_text.append(page_text)
                text = "\n\n".join(pages_text)
            except Exception as exc:
                return {
                    "status": "error",
                    "code": 500,
                    "message": f"Failed to extract PDF text: {exc}",
                }
            return {
                "status": "success",
                "document_path": document_path,
                "mime_type": mime_type,
                "content": text,
                "encoding": "utf-8",
            }

        # Binary → base64
        return {
            "status": "success",
            "document_path": document_path,
            "mime_type": mime_type,
            "content_base64": base64.b64encode(binary).decode("utf-8"),
            "encoding": "base64",
        }

    @connector_tool
    def create_document(self, document_path: str, content: str) -> dict[str, Any]:
        """Create a new document in SharePoint. Supports .md and .docx formats.

        For .md files, content is stored as raw markdown text.
        For .docx files, content is treated as markdown and rendered into a
        formatted Word document: headings (#), bold (**), italic (*), bullet and
        numbered lists, tables, code blocks, and blockquotes are all supported.
        Separate paragraphs with a blank line (a single newline is a soft break).

        Args:
            document_path: Path for the new document (must end in .md or .docx).
            content: Markdown content to write into the document.
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}

        normalized_path = document_path.strip()
        if not normalized_path:
            return {
                "status": "error",
                "code": 400,
                "message": "document_path is required.",
            }

        lower_path = normalized_path.lower()
        if not (lower_path.endswith(".md") or lower_path.endswith(".docx")):
            return {
                "status": "error",
                "code": 400,
                "message": "create_document supports only .md and .docx files.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            full_path = self._normalize_path(normalized_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        check_result = self._graph_request(
            self._build_item_endpoint(site["site_id"], full_path)
        )
        if check_result["status"] == "success":
            return {
                "status": "error",
                "code": 409,
                "message": "Document already exists.",
                "document_path": normalized_path,
            }
        if check_result.get("code") != 404:
            return check_result

        auth = self._get_access_token()
        if auth["status"] != "success":
            return auth

        upload_url = (
            f"{self.graph_base_url}"
            f"{self._build_item_endpoint(site['site_id'], full_path)}:/content"
        )

        if lower_path.endswith(".docx"):
            try:
                binary = self._create_docx_bytes(content)
            except Exception as exc:
                return {
                    "status": "error",
                    "code": 500,
                    "message": f"Failed to create docx: {exc}",
                }
            try:
                put_response = self._upload_binary(
                    site["site_id"], full_path, auth["access_token"], binary, DOCX_MIME
                )
            except ConnectionError as exc:
                return {"status": "error", "code": 503, "message": str(exc)}
        else:
            put_response = self.call_api(
                url=upload_url,
                method="PUT",
                headers={
                    "Authorization": f"Bearer {auth['access_token']}",
                    "Content-Type": "text/markdown; charset=utf-8",
                    "Prefer": "bypass-shared-lock",
                },
                data=cast(Any, content),
            )

        if put_response.status_code >= 400:
            return {
                "status": "error",
                "code": put_response.status_code,
                "message": "Failed to create document.",
                "details": put_response.text,
            }

        try:
            payload = put_response.json()
        except ValueError:
            payload = {}

        return {
            "status": "success",
            "document_path": normalized_path,
            "message": "Document created successfully.",
            "modified": payload.get("lastModifiedDateTime"),
            "url": payload.get("webUrl"),
        }

    @connector_tool
    def update_document(self, document_path: str, content: str) -> dict[str, Any]:
        """Update an existing document in SharePoint. Supports .md and .docx formats.

        For .md files, content is stored as raw markdown text.
        For .docx files, content is treated as markdown and rendered into a
        formatted Word document (headings, bold/italic, lists, tables, code,
        blockquotes), replacing the body. Existing comments are preserved.
        Separate paragraphs with a blank line (a single newline is a soft break).

        Args:
            document_path: Path to the existing document (must end in .md or .docx).
            content: New markdown content for the document.
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}

        normalized_path = document_path.strip()
        if not normalized_path:
            return {
                "status": "error",
                "code": 400,
                "message": "document_path is required.",
            }

        lower_path = normalized_path.lower()
        if not (lower_path.endswith(".md") or lower_path.endswith(".docx")):
            return {
                "status": "error",
                "code": 400,
                "message": "update_document supports only .md and .docx files.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            full_path = self._normalize_path(normalized_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        check_result = self._graph_request(
            self._build_item_endpoint(site["site_id"], full_path)
        )
        if check_result["status"] != "success":
            return check_result

        auth = self._get_access_token()
        if auth["status"] != "success":
            return auth

        upload_url = (
            f"{self.graph_base_url}"
            f"{self._build_item_endpoint(site['site_id'], full_path)}:/content"
        )

        if lower_path.endswith(".docx"):
            dl = self._download_docx_binary(site["site_id"], full_path)
            if dl["status"] != "success":
                return dl
            try:
                binary = self._update_docx_content(dl["data"], content)
            except Exception as exc:
                return {
                    "status": "error",
                    "code": 500,
                    "message": f"Failed to update docx: {exc}",
                }
            try:
                put_response = self._upload_binary(
                    site["site_id"], full_path, auth["access_token"], binary, DOCX_MIME
                )
            except ConnectionError as exc:
                return {"status": "error", "code": 503, "message": str(exc)}
        else:
            put_response = self.call_api(
                url=upload_url,
                method="PUT",
                headers={
                    "Authorization": f"Bearer {auth['access_token']}",
                    "Content-Type": "text/markdown; charset=utf-8",
                },
                data=cast(Any, content),
            )

        if put_response.status_code >= 400:
            return {
                "status": "error",
                "code": put_response.status_code,
                "message": "Failed to update document.",
                "details": put_response.text,
            }

        try:
            payload = put_response.json()
        except ValueError:
            payload = {}

        return {
            "status": "success",
            "document_path": normalized_path,
            "message": "Document updated successfully.",
            "modified": payload.get("lastModifiedDateTime"),
            "url": payload.get("webUrl"),
        }

    @connector_tool
    def get_document_comments(self, document_path: str) -> dict[str, Any]:
        """Get all comments embedded in a SharePoint .docx document.

        Returns a list of comments with their ID, author, date, and text content.

        Args:
            document_path: Path to the .docx file within the configured library.
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}

        normalized_path = document_path.strip()
        if not normalized_path:
            return {
                "status": "error",
                "code": 400,
                "message": "document_path is required.",
            }
        if not normalized_path.lower().endswith(".docx"):
            return {
                "status": "error",
                "code": 400,
                "message": "get_document_comments only supports .docx files.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            full_path = self._normalize_path(normalized_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        dl = self._download_docx_binary(site["site_id"], full_path)
        if dl["status"] != "success":
            return dl

        try:
            comments = self._extract_docx_comments(dl["data"])
        except Exception as exc:
            return {
                "status": "error",
                "code": 500,
                "message": f"Failed to parse docx comments: {exc}",
            }

        return {
            "status": "success",
            "document_path": normalized_path,
            "comment_count": len(comments),
            "comments": comments,
        }

    @connector_tool
    def update_document_comment(
        self, document_path: str, comment_id: str, new_text: str
    ) -> dict[str, Any]:
        """Update the text of a specific comment in a SharePoint .docx document by its ID.

        Downloads the document, modifies the comment XML, and re-uploads the file.

        Args:
            document_path: Path to the .docx file within the configured library.
            comment_id: The numeric ID of the comment to update (use get_document_comments to find IDs).
            new_text: The new text content for the comment.
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}

        normalized_path = document_path.strip()
        if not normalized_path:
            return {
                "status": "error",
                "code": 400,
                "message": "document_path is required.",
            }
        if not normalized_path.lower().endswith(".docx"):
            return {
                "status": "error",
                "code": 400,
                "message": "update_document_comment only supports .docx files.",
            }
        if not comment_id.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "comment_id is required.",
            }
        if not new_text.strip():
            return {"status": "error", "code": 400, "message": "new_text is required."}

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            full_path = self._normalize_path(normalized_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        dl = self._download_docx_binary(site["site_id"], full_path)
        if dl["status"] != "success":
            return dl

        try:
            new_docx = self._modify_docx_comment(
                dl["data"], comment_id.strip(), new_text
            )
        except Exception as exc:
            return {
                "status": "error",
                "code": 500,
                "message": f"Failed to modify docx comment: {exc}",
            }

        if new_docx is None:
            return {
                "status": "error",
                "code": 404,
                "message": f"Comment with ID '{comment_id}' not found in document.",
            }

        auth = self._get_access_token()
        if auth["status"] != "success":
            return auth

        try:
            put_response = self._upload_binary(
                site["site_id"], full_path, auth["access_token"], new_docx, DOCX_MIME
            )
        except ConnectionError as exc:
            return {"status": "error", "code": 503, "message": str(exc)}

        if put_response.status_code >= 400:
            return {
                "status": "error",
                "code": put_response.status_code,
                "message": "Failed to upload modified document.",
                "details": put_response.text,
            }

        try:
            payload = put_response.json()
        except ValueError:
            payload = {}

        return {
            "status": "success",
            "document_path": normalized_path,
            "comment_id": comment_id,
            "message": "Comment updated successfully.",
            "modified": payload.get("lastModifiedDateTime"),
            "url": payload.get("webUrl"),
        }

    @connector_tool
    def reply_to_comment(
        self,
        document_path: str,
        comment_id: str,
        reply_text: str,
    ) -> dict[str, Any]:
        """Add a reply to an existing comment in a SharePoint .docx document.

        Downloads the document, appends a threaded reply to the specified comment,
        and re-uploads the file.

        Args:
            document_path: Path to the .docx file within the configured library.
            comment_id: The ID of the comment to reply to (use get_document_comments to find IDs).
            reply_text: The text content of the reply.
        """
        author = "RC Enterprise AIOps"
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}

        normalized_path = document_path.strip()
        if not normalized_path:
            return {
                "status": "error",
                "code": 400,
                "message": "document_path is required.",
            }
        if not normalized_path.lower().endswith(".docx"):
            return {
                "status": "error",
                "code": 400,
                "message": "reply_to_comment only supports .docx files.",
            }
        if not comment_id.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "comment_id is required.",
            }
        if not reply_text.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "reply_text is required.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            full_path = self._normalize_path(normalized_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        dl = self._download_docx_binary(site["site_id"], full_path)
        if dl["status"] != "success":
            return dl

        try:
            new_docx = self._reply_to_docx_comment(
                dl["data"], comment_id.strip(), reply_text, author.strip() or "AI Agent"
            )
        except Exception as exc:
            return {
                "status": "error",
                "code": 500,
                "message": f"Failed to add reply: {exc}",
            }

        if new_docx is None:
            return {
                "status": "error",
                "code": 404,
                "message": f"Comment with ID '{comment_id}' not found in document.",
            }

        auth = self._get_access_token()
        if auth["status"] != "success":
            return auth

        try:
            put_response = self._upload_binary(
                site["site_id"], full_path, auth["access_token"], new_docx, DOCX_MIME
            )
        except ConnectionError as exc:
            return {"status": "error", "code": 503, "message": str(exc)}

        if put_response.status_code >= 400:
            return {
                "status": "error",
                "code": put_response.status_code,
                "message": "Failed to upload document with reply.",
                "details": put_response.text,
            }

        try:
            payload = put_response.json()
        except ValueError:
            payload = {}

        return {
            "status": "success",
            "document_path": normalized_path,
            "comment_id": comment_id,
            "message": "Reply added successfully.",
            "modified": payload.get("lastModifiedDateTime"),
            "url": payload.get("webUrl"),
        }

    @connector_tool
    def add_comment(
        self,
        document_path: str,
        anchor_text: str,
        comment_text: str,
        author: str = "AI Agent",
    ) -> dict[str, Any]:
        """Add a new comment anchored to a specific line of text in a .docx document.

        Downloads the document, anchors a comment to the first paragraph containing
        anchor_text, and re-uploads the file.

        Args:
            document_path: Path to the .docx file within the configured library.
            anchor_text: Text in the document to anchor the comment to (case-insensitive match).
            comment_text: The comment content to add.
            author: Author name shown in Word. Defaults to 'AI Agent'.
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}

        normalized_path = document_path.strip()
        if not normalized_path:
            return {
                "status": "error",
                "code": 400,
                "message": "document_path is required.",
            }
        if not normalized_path.lower().endswith(".docx"):
            return {
                "status": "error",
                "code": 400,
                "message": "add_comment only supports .docx files.",
            }
        if not anchor_text.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "anchor_text is required.",
            }
        if not comment_text.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "comment_text is required.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            full_path = self._normalize_path(normalized_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        dl = self._download_docx_binary(site["site_id"], full_path)
        if dl["status"] != "success":
            return dl

        try:
            result = self._add_docx_comment(
                dl["data"], anchor_text, comment_text, author.strip() or "AI Agent"
            )
        except Exception as exc:
            return {
                "status": "error",
                "code": 500,
                "message": f"Failed to add comment: {exc}",
            }

        if result is None:
            return {
                "status": "error",
                "code": 404,
                "message": f"No paragraph found containing '{anchor_text}' in document.",
            }

        new_docx, new_comment_id = result

        auth = self._get_access_token()
        if auth["status"] != "success":
            return auth

        try:
            put_response = self._upload_binary(
                site["site_id"], full_path, auth["access_token"], new_docx, DOCX_MIME
            )
        except ConnectionError as exc:
            return {"status": "error", "code": 503, "message": str(exc)}

        if put_response.status_code >= 400:
            return {
                "status": "error",
                "code": put_response.status_code,
                "message": "Failed to upload document with new comment.",
                "details": put_response.text,
            }

        try:
            payload = put_response.json()
        except ValueError:
            payload = {}

        return {
            "status": "success",
            "document_path": normalized_path,
            "comment_id": new_comment_id,
            "message": "Comment added successfully.",
            "modified": payload.get("lastModifiedDateTime"),
            "url": payload.get("webUrl"),
        }
