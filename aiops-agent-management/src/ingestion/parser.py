"""Parser (Pass 1) seam: layout extraction into verbatim elements.

``resolve_parser`` selects a parser by ``IngestionSource.parser_backend``:
- ``docling`` (default) → ``DoclingParser`` (Docling Cloud Run; see
  ``docling_processor.py``).
- ``passthrough`` → ``PassthroughParser`` — a dependency-free fallback for dev
  and tests: it treats the raw text as the document, one element per line
  (markdown ``#`` lines become ``section_header``). No external service.

Azure / GCP / AWS layout backends are not implemented yet; selecting them raises.
"""

from __future__ import annotations

import logging

from src.ingestion.docling_processor import DoclingParser
from src.ingestion.types import FetchedDocument, ParsedDocument, ParsedElement, Parser
from src.ingestion.util import groundtruth_hash, slug_from_path

logger = logging.getLogger(__name__)

DEFAULT_PARSER_BACKEND = "docling"


class PassthroughParser:
    """Dependency-free Pass-1 fallback. Splits text into line elements."""

    def parse(self, doc: FetchedDocument) -> ParsedDocument:
        if isinstance(doc.content, bytes):
            try:
                raw = doc.content.decode("utf-8")
            except UnicodeDecodeError:
                raw = ""
        else:
            raw = doc.content or ""

        elements: list[ParsedElement] = []
        for i, line in enumerate(raw.splitlines()):
            stripped = line.strip()
            if not stripped:
                continue
            heading = stripped.lstrip("#").strip() if stripped.startswith("#") else None
            elements.append(
                ParsedElement(
                    element_ref=f"#/line/{i}",
                    label="section_header" if heading is not None else "text",
                    text=heading if heading is not None else stripped,
                )
            )

        title = next(
            (e.text for e in elements if e.label == "section_header"),
            (doc.ref.name or doc.ref.path).rsplit(".", 1)[0],
        )
        logger.debug(
            "PassthroughParser parsed %s: %d elements", doc.ref.path, len(elements)
        )
        return ParsedDocument(
            ref=doc.ref,
            title=title,
            slug=slug_from_path(doc.ref.path, doc.ref.name),
            elements=elements,
            groundtruth_hash=groundtruth_hash(elements),
            metadata={"parser": "passthrough"},
        )


# backend -> parser singleton (parsers cache auth tokens between calls).
_PARSER_REGISTRY: dict[str, Parser] = {
    "docling": DoclingParser(),
    "passthrough": PassthroughParser(),
}


def resolve_parser(parser_backend: str | None) -> Parser:
    """Return the Pass-1 parser for a source's ``parser_backend``."""
    backend = (parser_backend or DEFAULT_PARSER_BACKEND).strip().lower()
    parser = _PARSER_REGISTRY.get(backend)
    if parser is None:
        raise RuntimeError(
            f"No parser registered for parser_backend '{backend}' "
            f"(supported: {', '.join(sorted(_PARSER_REGISTRY))})."
        )
    return parser
