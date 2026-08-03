"""Tests for the LLM Pass-2 normalizer and its deterministic validator gate.
The LLM call is stubbed — no live model. Validation is exercised directly."""

from __future__ import annotations

import json
from uuid import uuid4

from src.ingestion.normalizer import (
    FlatNormalizer,
    LlmNormalizer,
    resolve_normalizer,
    validate_and_build,
)
from src.ingestion.types import DocumentRef, ParsedDocument, ParsedElement
from src.ingestion.util import groundtruth_hash


def _doc(elements: list[ParsedElement]) -> ParsedDocument:
    return ParsedDocument(
        ref=DocumentRef(source_id=str(uuid4()), path="/x.pdf", name="x.pdf"),
        title="t",
        slug="t",
        elements=elements,
        groundtruth_hash=groundtruth_hash(elements),
    )


def _mq_doc() -> ParsedDocument:
    return _doc(
        [
            ParsedElement(
                element_ref="#/texts/0", label="section_header", text="AMQ9524E"
            ),
            ParsedElement(element_ref="#/texts/1", label="text", text="Check QMs."),
            ParsedElement(
                element_ref="#/texts/2", label="section_header", text="Resolution"
            ),
            ParsedElement(element_ref="#/texts/3", label="text", text="Restart."),
        ]
    )


_VALID = [
    {"title_element_ref": "#/texts/0", "element_refs": ["#/texts/0", "#/texts/1"]},
    {"title_element_ref": "#/texts/2", "element_refs": ["#/texts/2", "#/texts/3"]},
]


# --------------------------------------------------------------------------- #
# Validator
# --------------------------------------------------------------------------- #
def test_validator_accepts_valid_grouping():
    sections = validate_and_build(_mq_doc(), _VALID)
    assert sections is not None
    assert len(sections) == 2
    assert sections[0].title == "AMQ9524E"
    assert sections[0].title_element_ref == "#/texts/0"
    assert [e.element_ref for e in sections[1].elements] == ["#/texts/2", "#/texts/3"]
    assert sections[0].section_index == 0 and sections[1].section_index == 1


def test_validator_rejects_dropped_element():
    bad = [
        {"title_element_ref": "#/texts/0", "element_refs": ["#/texts/0", "#/texts/1"]}
    ]
    assert validate_and_build(_mq_doc(), bad) is None  # #/texts/2,3 dropped


def test_validator_rejects_invented_id():
    bad = [
        {"title_element_ref": "#/texts/0", "element_refs": ["#/texts/0", "#/texts/1"]},
        {"title_element_ref": "#/texts/2", "element_refs": ["#/texts/2", "#/texts/99"]},
    ]
    assert validate_and_build(_mq_doc(), bad) is None


def test_validator_rejects_reorder():
    bad = [
        {"title_element_ref": "#/texts/0", "element_refs": ["#/texts/1", "#/texts/0"]},
        {"title_element_ref": "#/texts/2", "element_refs": ["#/texts/2", "#/texts/3"]},
    ]
    assert validate_and_build(_mq_doc(), bad) is None


def test_validator_accepts_element_split_by_offset():
    doc = _doc([ParsedElement(element_ref="#/texts/0", label="list_item", text="A B")])
    sections = validate_and_build(
        doc,
        [
            {
                "title_element_ref": None,
                "element_refs": [
                    {"ref": "#/texts/0", "start": 0, "end": 1},
                    {"ref": "#/texts/0", "start": 1, "end": 3},
                ],
            }
        ],
    )
    assert sections is not None
    texts = [e.text for e in sections[0].elements]
    assert texts == ["A", " B"]
    assert (
        sections[0].elements[0].char_start == 0
        and sections[0].elements[0].char_end == 1
    )


def test_validator_rejects_split_with_gap():
    doc = _doc([ParsedElement(element_ref="#/texts/0", label="list_item", text="A B")])
    bad = [
        {
            "title_element_ref": None,
            "element_refs": [
                {"ref": "#/texts/0", "start": 0, "end": 1},
                {"ref": "#/texts/0", "start": 2, "end": 3},  # leaves index 1 uncovered
            ],
        }
    ]
    assert validate_and_build(doc, bad) is None


# --------------------------------------------------------------------------- #
# LlmNormalizer (stubbed LLM)
# --------------------------------------------------------------------------- #
class _StubLlm(LlmNormalizer):
    def __init__(self, payload, raise_exc=False):
        super().__init__(model="fake/model")
        self._payload = payload
        self._raise = raise_exc

    def _call_llm(self, system, user):
        if self._raise:
            raise RuntimeError("llm down")
        return json.dumps(self._payload)


def test_llm_normalizer_marks_normalized_on_valid_output():
    doc = _StubLlm({"sections": _VALID}).normalize(_mq_doc())
    assert doc.normalization_status == "normalized"
    assert len(doc.sections) == 2


def test_llm_normalizer_falls_back_on_invalid_output():
    bad = {
        "sections": [{"title_element_ref": "#/texts/0", "element_refs": ["#/texts/0"]}]
    }
    doc = _StubLlm(bad).normalize(_mq_doc())
    assert doc.normalization_status == "fallback_flat"
    assert len(doc.sections) == 2  # flat: two headings


def test_llm_normalizer_falls_back_on_llm_error():
    doc = _StubLlm({}, raise_exc=True).normalize(_mq_doc())
    assert doc.normalization_status == "fallback_flat"


# --------------------------------------------------------------------------- #
# resolve_normalizer
# --------------------------------------------------------------------------- #
def test_resolve_normalizer_env(monkeypatch):
    monkeypatch.setenv("SOP_NORMALIZER_MODEL", "vertex_ai/gemini-2.0-flash")
    assert isinstance(resolve_normalizer(), LlmNormalizer)
    monkeypatch.delenv("SOP_NORMALIZER_MODEL", raising=False)
    assert isinstance(resolve_normalizer(), FlatNormalizer)
