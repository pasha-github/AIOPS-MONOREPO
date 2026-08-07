"""Root logging setup: console always, rotating file only in debug.

Console (stdout) carries INFO and above, so the terminal and cloud log capture
always see errors plus the one-line per-run ingestion summary. Set
``LOG_LEVEL=DEBUG`` to lower the threshold to the pipeline's per-step
``[1/discover]…[7/store]`` markers AND tee everything to ``logs/aiops.log``.
Idempotent — safe to call across uvicorn ``--reload``.
"""

from __future__ import annotations

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

_MARKER = "_aiops_handler"  # tags handlers we add, so re-runs don't duplicate


def configure_logging() -> Path | None:
    """Attach a console handler (always) + a rotating file handler (DEBUG only).

    Honors ``LOG_LEVEL`` (default ``INFO``) and ``LOG_DIR`` (default ``./logs``).
    Returns the log file path when file logging is on, else ``None``.
    """
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    debug = level == "DEBUG"

    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-7s %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(level)

    # Drop handlers we added previously so reloads don't double-log.
    for handler in list(root.handlers):
        if getattr(handler, _MARKER, False):
            root.removeHandler(handler)

    console = logging.StreamHandler()
    console.setFormatter(fmt)
    setattr(console, _MARKER, True)
    root.addHandler(console)

    # File logging is a debug aid (and avoids writing files inside a container),
    # so it is only attached when LOG_LEVEL=DEBUG.
    log_file: Path | None = None
    if debug:
        log_dir = Path(os.getenv("LOG_DIR", "logs"))
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / "aiops.log"
        file_handler = RotatingFileHandler(
            log_file, maxBytes=5_000_000, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(fmt)
        setattr(file_handler, _MARKER, True)
        root.addHandler(file_handler)

    # Our pipeline loggers live under "src." — ensure they emit at our level.
    logging.getLogger("src").setLevel(level)

    # Quiet chatty HTTP/LLM client libraries so a local/uvicorn terminal (and
    # prod stdout) isn't flooded — and slowed — by their per-request/per-call
    # INFO during ingestion + embedding. Warnings and errors still surface.
    for noisy in ("httpx", "httpcore", "urllib3", "litellm", "LiteLLM", "openai"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    return log_file
