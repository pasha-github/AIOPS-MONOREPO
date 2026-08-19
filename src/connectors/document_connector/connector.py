"""
Document Connector (knowledge-base retrieval) v1.1.0
-----------------------------------------------------
Agent-facing tools over the ingested document corpus. Retrieval is **id-only**:
search returns section ids + metadata, and the fetch tool takes ids — there is
no free-text path into stored content, and a section is always returned whole
(its elements joined in order). Reads the data-plane tables only; ingestion runs
separately as a system identity.

Every result includes source attribution (source_type, source_name, web_url,
document_title) so the agent can cite origin and provide a direct link to the
source document without any follow-up lookups.

Set the DOCUMENT_DOMAIN_LABEL env var (e.g. "SOPs", "Policies", "Procedures",
"Knowledge Base") to tailor tool descriptions for each client domain without
changing code.
"""

import os
from typing import Any

from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext

from src import retrieval
from src.ingestion.trigger import ingestion_trigger
from src.ingestion.types import TriggerSource

_LABEL = os.getenv("DOCUMENT_DOMAIN_LABEL", "documents")


class DocumentConnector(BaseConnector):
    """Retrieval tools over the ingested document knowledge base.

    Provides search, section fetch, document listing, and sync trigger.
    Tool names are intentionally generic so this connector works across client
    domains (construction SOPs, operations procedures, hospitality policies, etc.).
    Set DOCUMENT_DOMAIN_LABEL to contextualize the domain in descriptions.
    """

    def __init__(self, prefix: str = ""):
        super().__init__(prefix=prefix)

    @connector_tool
    def search_documents(
        self, query: str, top_k: int, tool_context: ToolContext
    ) -> dict[str, Any]:
        """Searches the knowledge base for sections relevant to a query.

        Returns several candidates (id + title + a short `snippet` + relevance
        `score`) — NOT full text. Each candidate also carries its complete origin:
        `source_type` (sharepoint | onedrive | confluence), `source_name`,
        `source_uri` (path within the source), `web_url` (direct browser link to
        the document), and `document_title`. Use these fields to cite WHERE an
        answer comes from and to include a reference link.

        Review the snippets and titles, then call `get_section` on the best 1-3
        ids to read the full content and confirm it fits. If none fit, don't force
        an irrelevant result.

        Efficiency: one search is usually enough — pick the best ids from the
        results rather than searching again with reworded terms. If a snippet
        already answers the question you may not need to fetch the full section.

        Args:
            query: Error code, symptom, topic, or short task description.
            top_k: How many candidates to return; use ~5 so you can compare
                (defaults to 5 if <= 0).

        Returns:
            Candidate sections with `section_id`, `document_id`, `document_title`,
            `source_type`, `source_name`, `source_uri`, `web_url`, `title`,
            `snippet`, and `score`. Read full text via `get_section(id)`.
        """
        results = retrieval.search_sop(query, top_k=top_k if top_k > 0 else 5)
        return {"status": "success", "count": len(results), "results": results}

    @connector_tool
    def get_section(
        self, sop_section_id: str, tool_context: ToolContext
    ) -> dict[str, Any]:
        """Fetches one section in full (the complete content for that topic).

        The result carries complete origin for citation:
        - `source_type` (sharepoint | onedrive | confluence)
        - `source_name` — the registered source label
        - `web_url` — direct browser link to the source document
        - `document_title` — name of the document this section belongs to

        Always cite the source when you answer. Format references as:
        `[document_title](web_url) — source_name (source_type), Section: "title"`

        Efficiency: fetch a section once per turn — do not re-fetch an id you
        already retrieved, and don't pull a whole document section-by-section
        unless the user explicitly asks for the entire document.

        Args:
            sop_section_id: Id from a `search_documents` or `list_sections` result.

        Returns:
            The whole section rendered as markdown plus its ordered elements
            (each with a stable `element_ref` for citation), and the source
            attribution fields above.
        """
        section = retrieval.get_sop_section(sop_section_id)
        if section is None:
            return {"status": "not_found", "sop_section_id": sop_section_id}
        return {"status": "success", "section": section}

    @connector_tool
    def list_sections(
        self, sop_document_id: str, tool_context: ToolContext
    ) -> dict[str, Any]:
        """Lists a document's sections by id (titles + element refs, no full text).

        Use to navigate a known document — e.g. after `search_documents` returns
        a document id and you need to find additional relevant sections within it.

        Args:
            sop_document_id: The document id (from a search result).

        Returns:
            Sections in reading order with `sop_section_id`, `title`, and
            `element_refs`.
        """
        sections = retrieval.list_sop_sections(sop_document_id)
        return {"status": "success", "count": len(sections), "sections": sections}

    @connector_tool
    def sync_documents(self, tool_context: ToolContext) -> dict[str, Any]:
        """Triggers a background re-sync of all document sources.

        Use only when the user reports that content is stale or out of date —
        not for normal lookups. Sync runs independently of this session and may
        take several minutes to complete.

        Returns:
            The trigger status. Check ingestion logs for progress.
        """
        result = ingestion_trigger.fire_sync(TriggerSource.AGENT)
        return {"status": "success", "trigger": result}
