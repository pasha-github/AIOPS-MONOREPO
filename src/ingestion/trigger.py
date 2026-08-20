"""Unified ingestion entry point.

All four triggers (startup, REST, agent, scheduled) call the single
``ingestion_trigger`` singleton. It owns the single-run concurrency lock and the
in-memory status that the ``/documents/ingestion/status`` endpoint reads.

No FastAPI import — pure asyncio plus the (sync) manager, bridged with
``asyncio.to_thread`` so blocking connector I/O never stalls the event loop. In a
standalone service the same singleton would sit behind that service's own
HTTP/queue layer.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from src.ingestion.manager import IngestionManager
from src.ingestion.types import IngestionState, IngestionSummary, TriggerSource

logger = logging.getLogger(__name__)

_background_tasks: set = set()


class IngestionTrigger:
    """Process-wide entry point. Serializes runs and tracks status."""

    def __init__(self, manager: IngestionManager | None = None) -> None:
        self._manager = manager or IngestionManager()
        self._lock = asyncio.Lock()
        self._running = False
        self._current: IngestionSummary | None = None
        self._last: IngestionSummary | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Capture the app event loop so sync callers can use ``fire_sync``."""
        self._loop = loop

    async def fire(
        self,
        source: TriggerSource,
        blocking: bool = True,
        selectors: list[str] | None = None,
    ) -> dict:
        """Start an ingestion run. Never raises — always returns a status dict.

        ``blocking=True`` waits for completion and returns the run summary.
        ``blocking=False`` schedules the run in the background and returns
        immediately. If a run is already in progress, returns ``status="busy"``.
        ``selectors`` narrows which sources run (by source_type/source_name);
        ``None`` falls back to the ``INGEST_SOURCES`` env allowlist.
        """
        if self._running:
            return {"status": "busy", **self.status()}

        if blocking:
            summary = await self._run(source, selectors)
            return {"status": summary.state.value, "summary": summary.to_dict()}

        task = asyncio.create_task(self._run(source, selectors))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
        return {"status": "started", "trigger_source": source.value}

    def fire_sync(
        self, source: TriggerSource, selectors: list[str] | None = None
    ) -> dict:
        """Entry point for synchronous callers (e.g. the agent connector tool).

        Schedules a background run on the bound app loop. Requires ``bind_loop``
        to have been called at startup.
        """
        if self._loop is None:
            raise RuntimeError(
                "IngestionTrigger loop not bound; call bind_loop() at startup."
            )
        future = asyncio.run_coroutine_threadsafe(
            self.fire(source, blocking=False, selectors=selectors), self._loop
        )
        return future.result()

    async def _run(
        self, source: TriggerSource, selectors: list[str] | None = None
    ) -> IngestionSummary:
        if self._lock.locked():
            # Lost a race against another caller — report busy rather than queue.
            return IngestionSummary(
                trigger_source=source,
                started_at=datetime.now(),
                finished_at=datetime.now(),
                state=IngestionState.ERROR,
                error="busy",
            )
        async with self._lock:
            self._running = True
            self._current = IngestionSummary(
                trigger_source=source, started_at=datetime.now()
            )
            try:
                summary = await asyncio.to_thread(self._manager.run, source, selectors)
            except Exception as exc:  # defensive — manager already guards itself
                logger.exception("Ingestion run crashed")
                summary = self._current
                summary.state = IngestionState.ERROR
                summary.error = str(exc)
                summary.finished_at = datetime.now()
            finally:
                self._running = False
            self._current = None
            self._last = summary
            return summary

    def status(self) -> dict:
        return {
            "running": self._running,
            "current": self._current.to_dict() if self._current else None,
            "last_run": self._last.to_dict() if self._last else None,
        }


# Module-level singleton (mirrors the `scheduler` singleton in src/utils/scheduler.py).
ingestion_trigger = IngestionTrigger()
