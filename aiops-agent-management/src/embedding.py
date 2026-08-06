"""SOP embedding backends, shared by ingestion (write) and retrieval (query).

Two implementations behind a small ``Embedder`` seam:
- ``LiteLLMEmbedder`` — real embeddings via litellm, selected when
  ``SOP_EMBEDDING_MODEL`` is set (e.g. ``text-embedding-3-small`` or
  ``vertex_ai/text-embedding-004``, which reuses the same GCP ADC as Docling).
- ``HashingEmbedder`` — deterministic bag-of-words hashing, the default when no
  model is set. Gives lexical similarity so the search path is testable offline
  (SQLite/tests only — its dim won't fit the fixed-dim pgvector column).

Vectors persist in ``SopSectionEmbedding``: a pgvector ``vector(N)`` column +
HNSW index on Postgres, JSON on SQLite. See ``src.retrieval`` for the
dialect-aware search.
"""

from __future__ import annotations

import hashlib
import logging
import math
import os
import re
from typing import Protocol, runtime_checkable

logger = logging.getLogger(__name__)

DEFAULT_HASHING_DIM = 384
_TOKEN = re.compile(r"[a-z0-9]+")


@runtime_checkable
class Embedder(Protocol):
    model_name: str
    dim: int

    def embed(self, texts: list[str]) -> list[list[float]]: ...


class HashingEmbedder:
    """Deterministic bag-of-words hashing embedder (offline default)."""

    def __init__(self, dim: int = DEFAULT_HASHING_DIM) -> None:
        self.dim = dim
        self.model_name = f"hashing-{dim}"

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(text) for text in texts]

    def _vector(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for token in _TOKEN.findall(text.lower()):
            # hashlib (not built-in hash()) so vectors are stable across runs.
            digest = hashlib.md5(token.encode("utf-8")).digest()
            vec[int.from_bytes(digest[:4], "big") % self.dim] += 1.0
        norm = math.sqrt(sum(x * x for x in vec))
        return [x / norm for x in vec] if norm else vec


class LiteLLMEmbedder:
    """Real embeddings via litellm (provider chosen by the model string)."""

    def __init__(self, model: str, dim: int = 0) -> None:
        self.model_name = model
        self.dim = dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        import litellm

        response = litellm.embedding(model=self.model_name, input=texts)
        vectors = [item["embedding"] for item in response["data"]]
        if not self.dim and vectors:
            self.dim = len(vectors[0])
        return vectors


def resolve_embedder() -> Embedder:
    """Pick the embedder: ``SOP_EMBEDDING_MODEL`` → litellm, else hashing."""
    model = os.getenv("SOP_EMBEDDING_MODEL", "").strip()
    if model:
        logger.info("SOP embedder: litellm model=%s", model)
        return LiteLLMEmbedder(model)
    logger.info("SOP embedder: HashingEmbedder (set SOP_EMBEDDING_MODEL for real)")
    return HashingEmbedder()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity of two equal-length vectors (0.0 on degenerate input)."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0
