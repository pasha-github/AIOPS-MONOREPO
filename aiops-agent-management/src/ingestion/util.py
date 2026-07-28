"""Small pure helpers shared across the ingestion stages (no I/O, no DB)."""

from __future__ import annotations

import hashlib
import posixpath
import re

from src.ingestion.types import ParsedElement


def sha256_text(text: str) -> str:
    """Hex SHA-256 of a UTF-8 string."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def groundtruth_hash(elements: list[ParsedElement]) -> str:
    """Hash over the concatenated verbatim element texts, in order.

    The anchor the Pass-2 validator checks against: any add/drop/edit of element
    text changes this hash.
    """
    return sha256_text("\n".join(el.text for el in elements))


def content_hash(elements: list[ParsedElement]) -> str:
    """Per-section hash (concat of its elements' text) for re-embed skipping."""
    return sha256_text("\n".join(el.text for el in elements))


_SLUG_STRIP = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    """Lowercase, hyphenated slug; safe as a stable per-document identity."""
    slug = _SLUG_STRIP.sub("-", value.strip().lower()).strip("-")
    return slug or "document"


def slug_from_path(path: str, file_name: str | None = None) -> str:
    """Derive a slug from a source path / file name (extension stripped)."""
    name = file_name or posixpath.basename(path) or path
    stem = name.rsplit(".", 1)[0] if "." in name else name
    return slugify(stem)
