"""Normalizer (Pass 2) implementations.

``FlatNormalizer`` is the deterministic default: it groups elements into
sections by heading boundary, never touching element text. Table and image
element runs are extracted into **sibling sections** that inherit the parent
heading's ``title`` and ``trigger_text``. This keeps tabular content
independently retrievable and gives row-level ``element_ref``s for the future
``propose_sop_change`` edit flow.

``LlmNormalizer`` (opt-in via ``SOP_NORMALIZER_MODEL``) asks an LLM to
regroup the **text-only** elements into self-contained sections — emitting
structure only (element ids, never prose). Table/image sections are always
built deterministically (same logic as ``FlatNormalizer``) and merged with
the LLM grouping afterward. A deterministic **validator gate** proves the LLM
proposal didn't add, drop, reorder, or alter any text; if it fails, the
document falls back to ``FlatNormalizer``.

Section types
-------------
``section_type`` on ``ParsedSection`` (and the DB column on ``sop_section``):
- ``"text"``  — ordinary prose section (default; stored as NULL in DB)
- ``"table"`` — table rows from a Docling ``tables[]`` node
- ``"image"`` — image caption or placeholder from a Docling ``pictures[]`` node
"""

from __future__ import annotations

import json
import logging
import os

from src.ingestion.types import ParsedDocument, ParsedElement, ParsedSection
from src.ingestion.util import content_hash, groundtruth_hash

logger = logging.getLogger(__name__)

_HEADING_LABEL = "section_header"
_TABLE_LABELS = frozenset({"table_header", "table_row"})
_IMAGE_LABELS = frozenset({"image_caption", "image_placeholder"})
_DERIVED_LABELS = _TABLE_LABELS | _IMAGE_LABELS


# --------------------------------------------------------------------------- #
# Shared helpers
# --------------------------------------------------------------------------- #


def _split_derived(
    elements: list[ParsedElement],
) -> tuple[list[ParsedElement], list[tuple[int, ParsedSection]]]:
    """Separate text elements from table/image runs in a single pass.

    Returns
    -------
    text_elements
        All non-table, non-image elements in their original order.
    derived
        List of ``(insert_after_text_idx, section)`` pairs.  The index is the
        number of text elements seen *before* the run started — used by
        ``_merge_with_derived`` to re-interleave them with text sections.
    """
    text_elements: list[ParsedElement] = []
    derived: list[tuple[int, ParsedSection]] = []

    current_derived: ParsedSection | None = None
    current_text_section_title: str | None = None
    current_text_section_trigger: str | None = None

    i = 0
    while i < len(elements):
        el = elements[i]

        if el.label == _HEADING_LABEL:
            # Close any open derived section (finalize content_hash later).
            current_derived = None
            current_text_section_title = el.text.strip() or None
            current_text_section_trigger = el.text.strip() or None
            text_elements.append(el)
            i += 1

        elif el.label in _TABLE_LABELS:
            # Collect contiguous table rows into one table section.
            if current_derived is None or current_derived.section_type != "table":
                current_derived = ParsedSection(
                    section_index=0,  # renumbered later
                    section_type="table",
                    title=current_text_section_title,
                    trigger_text=current_text_section_trigger,
                )
                derived.append((len(text_elements), current_derived))
            current_derived.elements.append(el)
            i += 1

        elif el.label in _IMAGE_LABELS:
            # Each image becomes its own section (images are not contiguous runs).
            current_derived = None
            img_section = ParsedSection(
                section_index=0,
                section_type="image",
                title=current_text_section_title,
                trigger_text=current_text_section_trigger,
            )
            img_section.elements.append(el)
            derived.append((len(text_elements), img_section))
            i += 1

        else:
            current_derived = None
            text_elements.append(el)
            i += 1

    return text_elements, derived


def _merge_with_derived(
    text_sections: list[ParsedSection],
    derived: list[tuple[int, ParsedSection]],
) -> list[ParsedSection]:
    """Interleave text sections and derived (table/image) sections.

    Each derived section is inserted immediately after the text section that
    contains the text element at ``insert_after_text_idx - 1``.  Section
    indices are renumbered densely and content hashes are set.
    """
    if not derived:
        return text_sections

    # Map each text-element index to its owning text section index.
    # text_sections[k] owns text elements from cum_counts[k] to cum_counts[k+1]-1.
    cum: list[int] = []
    running = 0
    for sec in text_sections:
        cum.append(running)
        running += sum(1 for el in sec.elements if el.label not in _DERIVED_LABELS)
    cum.append(running)

    def _owning_text_section(text_elem_idx: int) -> int:
        """Index of the text section that owns the given text-element position."""
        for k in range(len(text_sections) - 1, -1, -1):
            if cum[k] <= text_elem_idx:
                return k
        return 0

    # Build a list of (text_section_index, derived_section) pairs.
    inserts: list[tuple[int, ParsedSection]] = []
    for text_elem_idx, sec in derived:
        owner = _owning_text_section(text_elem_idx)
        inserts.append((owner, sec))

    # Sort inserts by text section index (stable, preserving document order).
    inserts.sort(key=lambda x: x[0])

    merged: list[ParsedSection] = []
    insert_ptr = 0
    for ts_idx, text_sec in enumerate(text_sections):
        merged.append(text_sec)
        # Append all derived sections whose owner is this text section.
        while insert_ptr < len(inserts) and inserts[insert_ptr][0] == ts_idx:
            merged.append(inserts[insert_ptr][1])
            insert_ptr += 1

    # Append any remaining derived sections (past the last text section).
    while insert_ptr < len(inserts):
        merged.append(inserts[insert_ptr][1])
        insert_ptr += 1

    # Re-number section_index and compute content hashes.
    for idx, sec in enumerate(merged):
        sec.section_index = idx
        sec.content_hash = content_hash(sec.elements)

    return merged


# --------------------------------------------------------------------------- #
# FlatNormalizer
# --------------------------------------------------------------------------- #


class FlatNormalizer:
    """Deterministic sectioning by heading, with table/image sibling sections.

    A new text section starts at each ``section_header`` element. Runs of
    ``table_header``/``table_row`` elements become a sibling table section
    inheriting the parent heading's title and trigger_text. Each image element
    becomes its own image section, also inheriting the parent heading.
    """

    def normalize(self, doc: ParsedDocument) -> ParsedDocument:
        text_elements, derived = _split_derived(doc.elements)
        text_sections = self._sections_from_text_elements(text_elements)
        sections = _merge_with_derived(text_sections, derived)

        if not sections:
            # Edge case: no elements at all — produce one empty section.
            sections = [ParsedSection(section_index=0, content_hash=content_hash([]))]

        doc.sections = sections
        doc.normalization_status = "fallback_flat"
        logger.debug(
            "FlatNormalizer: %d elements -> %d sections (%d text, %d derived, doc=%s)",
            len(doc.elements),
            len(sections),
            len(text_sections),
            len(derived),
            doc.slug,
        )
        return doc

    @staticmethod
    def _sections_from_text_elements(
        elements: list[ParsedElement],
    ) -> list[ParsedSection]:
        """Group text elements into sections by heading boundary."""
        sections: list[ParsedSection] = []
        current: ParsedSection | None = None

        for el in elements:
            is_heading = el.label == _HEADING_LABEL
            if current is None or is_heading:
                current = ParsedSection(section_index=len(sections))
                sections.append(current)
                if is_heading:
                    current.title = el.text.strip() or None
                    current.title_element_ref = el.element_ref
                    current.trigger_text = el.text.strip() or None
            current.elements.append(el)

        for sec in sections:
            sec.content_hash = content_hash(sec.elements)

        return sections


# --------------------------------------------------------------------------- #
# LlmNormalizer
# --------------------------------------------------------------------------- #

_SYSTEM_PROMPT = (
    "You normalize a document's STRUCTURE. You are given an ordered list of text "
    "elements, each with a stable id and label. Group them into self-contained "
    "sections — one section per actionable unit (e.g. one error/trigger plus its "
    "full remediation steps). You output ONLY JSON describing the grouping by id. "
    "Hard rules: (1) Never write, rewrite, summarise, translate, or paraphrase "
    "any text. (2) Reference only the ids given. (3) Assign every element to "
    "exactly one section. (4) Preserve the original reading order — do not "
    "reorder elements across or within sections. (5) `title_element_ref` is the "
    "id of the heading element that titles a section, or null. "
    'Output exactly: {"sections":[{"title_element_ref":"<id|null>",'
    '"element_refs":["<id>", ...]}, ...]} and nothing else.'
)


def _build_user_prompt(doc: ParsedDocument) -> str:
    lines = [
        f"[{i}] id={el.element_ref} label={el.label}: {el.text}"
        for i, el in enumerate(doc.elements)
    ]
    return "Elements (in reading order):\n" + "\n".join(lines)


def _parse_llm_json(raw: str) -> dict | None:
    text = raw.strip()
    if text.startswith("```"):  # strip ```json ... ``` fences
        text = text.split("```", 2)[1]
        if text.lstrip().startswith("json"):
            text = text.lstrip()[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        obj = json.loads(text[start : end + 1])
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        return None


def validate_and_build(
    doc: ParsedDocument, llm_sections: list[dict]
) -> list[ParsedSection] | None:
    """Validate an LLM grouping and build sections, or None if it must be rejected.

    Rejects if the proposal references an unknown id, drops any element, fails to
    cover an element's full text (for splits), reorders elements, or fails the
    groundtruth-hash re-check.
    """
    by_ref = {el.element_ref: el for el in doc.elements}

    # 1. Parse every reference into (ref, start, end), flattened in section order.
    per_section: list[tuple[dict, list[tuple[str, int, int]]]] = []
    flat: list[tuple[str, int, int]] = []
    for sec in llm_sections:
        items: list[tuple[str, int, int]] = []
        for entry in sec.get("element_refs") or []:
            if isinstance(entry, str):
                ref, start, end = entry, None, None
            elif isinstance(entry, dict):
                ref, start, end = entry.get("ref"), entry.get("start"), entry.get("end")
            else:
                return None
            if ref not in by_ref:
                return None  # invented id
            full = len(by_ref[ref].text)
            if start is None or end is None:
                start, end = 0, full
            if not (isinstance(start, int) and isinstance(end, int)):
                return None
            if not (0 <= start <= end <= full):
                return None
            items.append((ref, start, end))
            flat.append((ref, start, end))
        per_section.append((sec, items))

    # 2. Coverage: every element referenced exactly once and fully (splits tile it).
    slices_by_ref: dict[str, list[tuple[int, int]]] = {}
    for ref, start, end in flat:
        slices_by_ref.setdefault(ref, []).append((start, end))
    if set(slices_by_ref) != set(by_ref):
        return None  # missing or extra elements
    for ref, slices in slices_by_ref.items():
        cursor = 0
        for start, end in sorted(slices):
            if start != cursor:
                return None  # gap or overlap
            cursor = end
        if cursor != len(by_ref[ref].text):
            return None  # element not fully covered

    # 3. Order: collapsing consecutive same-ref items must equal the reading order.
    collapsed: list[str] = []
    for ref, _, _ in flat:
        if not collapsed or collapsed[-1] != ref:
            collapsed.append(ref)
    if collapsed != [el.element_ref for el in doc.elements]:
        return None  # reordered or a split spread across non-adjacent positions

    # 4. Groundtruth hash re-check (defence in depth — passes by construction above).
    reconstructed = [
        ParsedElement(
            element_ref=el.element_ref,
            label=el.label,
            text="".join(
                el.text[s:e] for s, e in sorted(slices_by_ref[el.element_ref])
            ),
            prov=el.prov,
        )
        for el in doc.elements
    ]
    if groundtruth_hash(reconstructed) != doc.groundtruth_hash:
        return None

    # 5. Build sections (skip any empty ones); renumber section_index densely.
    sections: list[ParsedSection] = []
    for sec, items in per_section:
        elements: list[ParsedElement] = []
        for ref, start, end in items:
            orig = by_ref[ref]
            if start == 0 and end == len(orig.text):
                elements.append(orig)
            else:
                elements.append(
                    ParsedElement(
                        element_ref=ref,
                        label=orig.label,
                        text=orig.text[start:end],
                        prov=orig.prov,
                        char_start=start,
                        char_end=end,
                    )
                )
        if not elements:
            continue
        title_ref = sec.get("title_element_ref")
        title = by_ref[title_ref].text.strip() if title_ref in by_ref else None
        sections.append(
            ParsedSection(
                section_index=len(sections),
                elements=elements,
                title=title,
                title_element_ref=title_ref if title_ref in by_ref else None,
                trigger_text=title,
                content_hash=content_hash(elements),
            )
        )
    return sections


class LlmNormalizer:
    """Pass-2 normalizer: LLM regroups text elements (structure only) → validator
    gate → flat fallback on any rejection or LLM error.

    Table/image elements are always split out deterministically (same logic as
    ``FlatNormalizer``) before the LLM sees the document — the LLM only groups
    text elements. After the LLM grouping is validated, derived sections are
    merged back in reading order.
    """

    def __init__(self, model: str, fallback: FlatNormalizer | None = None) -> None:
        self.model = model
        self._fallback = fallback or FlatNormalizer()

    def normalize(self, doc: ParsedDocument) -> ParsedDocument:
        text_elements, derived = _split_derived(doc.elements)

        if not text_elements:
            # No text at all — use flat fallback (handles all-table documents).
            return self._fallback.normalize(doc)

        # Build a temporary document over text-only elements so validate_and_build
        # checks against the correct subset.
        text_doc = ParsedDocument(
            ref=doc.ref,
            title=doc.title,
            slug=doc.slug,
            elements=text_elements,
            groundtruth_hash=groundtruth_hash(text_elements),
        )

        sections = None
        try:
            raw = self._call_llm(_SYSTEM_PROMPT, _build_user_prompt(text_doc))
            parsed = _parse_llm_json(raw)
            if parsed is not None:
                sections = validate_and_build(text_doc, parsed.get("sections") or [])
        except Exception as exc:
            logger.warning(
                "LLM normalize errored for doc=%s (%s); using flat fallback",
                doc.slug,
                exc,
            )

        if not sections:
            logger.debug(
                "LLM normalization rejected/empty for doc=%s; flat fallback", doc.slug
            )
            return self._fallback.normalize(doc)

        all_sections = _merge_with_derived(sections, derived)
        doc.sections = all_sections
        doc.normalization_status = "normalized"
        logger.debug(
            "LlmNormalizer: %d elements -> %d sections (%d text + %d derived, "
            "validated, doc=%s)",
            len(doc.elements),
            len(all_sections),
            len(sections),
            len(derived),
            doc.slug,
        )
        return doc

    def _call_llm(self, system: str, user: str) -> str:
        import litellm

        response = litellm.completion(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0,
        )
        # litellm types completion() as ModelResponse | CustomStreamWrapper; a
        # non-streaming call returns ModelResponse, so choices[0].message is valid.
        message = response.choices[0].message  # pyright: ignore[reportAttributeAccessIssue]
        return message.content or ""


def resolve_normalizer():
    """Pick the Pass-2 normalizer: ``SOP_NORMALIZER_MODEL`` → LLM, else flat."""
    model = os.getenv("SOP_NORMALIZER_MODEL", "").strip()
    if model:
        logger.info("SOP normalizer: LlmNormalizer model=%s", model)
        return LlmNormalizer(model)
    logger.info("SOP normalizer: FlatNormalizer (set SOP_NORMALIZER_MODEL for LLM)")
    return FlatNormalizer()
