"""SOP ingestion subsystem.

A decoupled package: the trigger/manager core imports no FastAPI or routers, so
it can later be extracted into a standalone service. Edge wiring (main.py,
documents router, scheduler) reaches the pipeline through ``ingestion_trigger``.
"""

from src.ingestion.manager import IngestionManager
from src.ingestion.trigger import IngestionTrigger, ingestion_trigger
from src.ingestion.types import IngestionSummary, TriggerSource

__all__ = [
    "IngestionManager",
    "IngestionSummary",
    "IngestionTrigger",
    "TriggerSource",
    "ingestion_trigger",
]
