"""SOP ingestion orchestrator.

``IngestionManager.run`` is fully synchronous (opens its own ``Session`` and
makes blocking connector calls); the async trigger runs it via
``asyncio.to_thread`` so the event loop is never blocked. It depends only on
``src.database``/``src.connectors``/``src.ingestion`` — all fetch/parse/store
behaviour flows through injected seams (``SourceFetcher``/``Parser``/``Storage``),
which keeps the package extractable into a standalone service later.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Callable
from datetime import datetime

from sqlmodel import Session, select

from src.database.database import engine
from src.database.models import IngestionSource
from src.ingestion.fetchers import resolve_fetcher
from src.ingestion.normalizer import resolve_normalizer
from src.ingestion.parser import resolve_parser
from src.ingestion.storage import DbStorage
from src.ingestion.types import (
    IngestionState,
    IngestionSummary,
    Normalizer,
    Parser,
    ResolvedSource,
    SourceFetcher,
    SourceResult,
    Storage,
    TriggerSource,
)

# Resolvers pick the right fetcher / parser for a source (by type / backend).
FetcherResolver = Callable[[ResolvedSource], SourceFetcher]
ParserResolver = Callable[[str | None], Parser]

logger = logging.getLogger(__name__)

# Debug gate: INGEST_STOP_AFTER halts a run right after the named stage so each
# step can be inspected in the logs before enabling the next. Unset = full run.
_STOP_STAGES = {"discover", "fetch", "parse", "normalize"}


class IngestionManager:
    """Reads SOP sources, runs fetch -> diff -> parse -> normalize -> store."""

    def __init__(
        self,
        fetcher_resolver: FetcherResolver | None = None,
        parser_resolver: ParserResolver | None = None,
        normalizer: Normalizer | None = None,
        storage: Storage | None = None,
    ) -> None:
        # Defaults wire the production implementations; each is an injection seam.
        # Resolvers select per-source: fetcher by source_type, parser by backend.
        self.fetcher_resolver: FetcherResolver = fetcher_resolver or resolve_fetcher
        self.parser_resolver: ParserResolver = parser_resolver or resolve_parser
        self.normalizer: Normalizer = normalizer or resolve_normalizer()
        self.storage: Storage = storage or DbStorage()

    def run(
        self,
        trigger_source: TriggerSource,
        selectors: list[str] | None = None,
    ) -> IngestionSummary:
        """Synchronous. Safe to call inside ``asyncio.to_thread``.

        ``selectors`` narrows which enabled sources run, matched
        case-insensitively against each source's ``source_type`` or
        ``source_name``. ``None`` falls back to the ``INGEST_SOURCES`` env
        allowlist; if that is unset too, all enabled sources run.
        """
        summary = IngestionSummary(
            trigger_source=trigger_source, started_at=datetime.now()
        )
        try:
            sources = self._load_sources(selectors)
        except Exception as exc:  # catastrophic — e.g. DB unreachable
            logger.exception("Failed to load SOP sources")
            summary.state = IngestionState.ERROR
            summary.error = str(exc)
            summary.finished_at = datetime.now()
            return summary

        logger.info(
            "Ingestion started: trigger=%s sources=%d",
            trigger_source.value,
            len(sources),
        )
        for source in sources:
            summary.sources.append(self._run_source(source))

        summary.state = IngestionState.DONE
        summary.finished_at = datetime.now()
        logger.info(
            "Ingestion done: trigger=%s stored=%d sources=%d",
            trigger_source.value,
            summary.total_stored,
            len(summary.sources),
        )
        return summary

    def _load_sources(self, selectors: list[str] | None = None) -> list[ResolvedSource]:
        selected = self._resolve_selectors(selectors)
        with Session(engine) as session:
            rows = session.exec(
                select(IngestionSource).where(IngestionSource.is_enabled)
            ).all()
            resolved = [
                ResolvedSource(
                    source_id=str(row.ingestion_source_id),
                    source_name=row.source_name,
                    source_type=row.source_type,
                    config=row.config or [],
                    parser_backend=row.parser_backend,
                )
                for row in rows
            ]
        if selected is None:
            return resolved
        kept = [
            source
            for source in resolved
            if source.source_type.lower() in selected
            or source.source_name.lower() in selected
        ]
        skipped = [s.source_name for s in resolved if s not in kept]
        if skipped:
            logger.info(
                "Source allowlist %s active: running %d, skipping %s",
                sorted(selected),
                len(kept),
                ", ".join(skipped),
            )
        return kept

    @staticmethod
    def _resolve_selectors(selectors: list[str] | None) -> set[str] | None:
        """Resolve the active-source allowlist (per-run arg > env > all).

        Returns a lowercased set of selectors, or ``None`` for "all enabled".
        """
        raw = selectors
        if raw is None:
            env = os.getenv("INGEST_SOURCES", "")
            raw = env.split(",") if env else None
        if raw is None:
            return None
        cleaned = {part.strip().lower() for part in raw if part.strip()}
        return cleaned or None

    def _run_source(self, source: ResolvedSource) -> SourceResult:
        result = SourceResult(
            source_id=source.source_id,
            source_name=source.source_name,
            source_type=source.source_type,
        )
        logger.debug(
            "[1/discover] source='%s' (type=%s, parser=%s)",
            source.source_name,
            source.source_type,
            source.parser_backend,
        )
        try:
            fetcher = self.fetcher_resolver(source)
            refs = fetcher.list_documents(source)
        except Exception as exc:  # whole source failed — skip, keep going
            logger.exception(
                "[1/discover] source='%s' listing FAILED", source.source_name
            )
            result.error = str(exc)
            return result

        parser = self.parser_resolver(source.parser_backend)
        result.discovered = len(refs)
        total = len(refs)
        logger.debug(
            "[1/discover] source='%s' found %d document(s)", source.source_name, total
        )
        for i, ref in enumerate(refs, start=1):
            logger.debug(
                "[1/discover]   %d/%d %s (size=%s, version=%s)",
                i,
                total,
                ref.path,
                ref.size,
                ref.version,
            )

        stop_after = os.getenv("INGEST_STOP_AFTER", "").strip().lower()
        if stop_after and stop_after not in _STOP_STAGES:
            logger.warning(
                "Ignoring unknown INGEST_STOP_AFTER=%r (valid: %s)",
                stop_after,
                ", ".join(sorted(_STOP_STAGES)),
            )
            stop_after = ""
        if stop_after == "discover":
            logger.info(
                "[stop] INGEST_STOP_AFTER=discover — listed %d document(s); "
                "halting before fetch.",
                total,
            )
            return result

        for i, ref in enumerate(refs, start=1):
            tag = f"doc {i}/{total} '{ref.path}'"
            try:
                # Metadata-only diff: compare the listing's change token against
                # the stored one. Unchanged documents are skipped without being
                # downloaded. A missing token (version is None) means we can't
                # diff, so the document is always (re)processed.
                prior_version = self.storage.existing_version(ref)
                if (
                    ref.version is not None
                    and prior_version is not None
                    and prior_version == ref.version
                ):
                    logger.debug(
                        "[2/diff] %s — SKIP unchanged (version=%s)", tag, ref.version
                    )
                    self.storage.update_metadata(ref)
                    result.skipped += 1
                    continue
                logger.debug(
                    "[2/diff] %s — CHANGED (stored=%s, current=%s) → processing",
                    tag,
                    prior_version,
                    ref.version,
                )

                result.changed += 1
                fetched = fetcher.fetch_document(source, ref)
                logger.debug(
                    "[3/fetch] %s — fetched (mime=%s, size=%s)",
                    tag,
                    fetched.mime_type,
                    ref.size,
                )
                if stop_after == "fetch":
                    logger.info(
                        "[stop] INGEST_STOP_AFTER=fetch — fetched '%s'; "
                        "halting before parse (no parse/store).",
                        ref.path,
                    )
                    break

                parsed = parser.parse(fetched)  # Pass 1: verbatim elements
                result.parsed += 1
                logger.debug(
                    "[4/parse] %s — %d element(s) (backend=%s)",
                    tag,
                    len(parsed.elements),
                    source.parser_backend,
                )
                if stop_after == "parse":
                    logger.info(
                        "[stop] INGEST_STOP_AFTER=parse — parsed '%s'; "
                        "halting before normalize (no normalize/store).",
                        ref.path,
                    )
                    break

                normalized = self.normalizer.normalize(parsed)  # Pass 2: sections
                logger.debug(
                    "[5/normalize] %s — %d section(s) (status=%s)",
                    tag,
                    len(normalized.sections),
                    normalized.normalization_status,
                )
                if stop_after == "normalize":
                    logger.info(
                        "[stop] INGEST_STOP_AFTER=normalize — normalized '%s'; "
                        "halting before embed/store.",
                        ref.path,
                    )
                    break

                # [6/embed] + content-level skip are logged inside storage.upsert.
                if self.storage.upsert(normalized):
                    result.stored += 1
                    logger.debug(
                        "[7/store] %s — stored (slug=%s)", tag, normalized.slug
                    )
            except Exception as exc:  # per-document failure — skip, keep going
                logger.warning("%s — FAILED: %s", tag, exc, exc_info=True)
                result.doc_errors.append(f"{ref.path}: {exc}")
                # Persist failure provenance (no-op for a never-ingested doc —
                # there is no SopDocument row to attach to yet).
                self.storage.record_failure(ref, str(exc))

        logger.info(
            "[done] source='%s' discovered=%d changed=%d parsed=%d stored=%d skipped=%d errors=%d",
            source.source_name,
            result.discovered,
            result.changed,
            result.parsed,
            result.stored,
            result.skipped,
            len(result.doc_errors),
        )
        return result
