"""
Embedding provider abstraction.

Providers:
  OllamaEmbedder  — local Ollama (default, EMBED_PROVIDER=ollama)
  NomicEmbedder   — Nomic AI cloud API (EMBED_PROVIDER=nomic, free)

Both return a list[float] of length EMBED_DIMENSIONS (default 768).

Usage:
  from kb.embedder import embed, embed_batch
  vector = embed("some text")

To switch providers, set in .env:
  # Cloud (Nomic, free):
  EMBED_PROVIDER=nomic
  NOMIC_API_KEY=your_key

  # Local (Ollama):
  EMBED_PROVIDER=ollama
  OLLAMA_EMBED_MODEL=nomic-embed-text
"""
from __future__ import annotations

import abc

import httpx

from kb.config import (
    EMBED_DIMENSIONS,
    EMBED_PROVIDER,
    NOMIC_API_KEY,
    NOMIC_EMBED_MODEL,
    OLLAMA_EMBED_MODEL,
    OLLAMA_HOST,
)

_TIMEOUT = httpx.Timeout(120.0)


# ── Base ──────────────────────────────────────────────────────────────────────

class BaseEmbedder(abc.ABC):
    @abc.abstractmethod
    def embed(self, text: str) -> list[float]: ...

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(t) for t in texts]


# ── Ollama (local) ────────────────────────────────────────────────────────────

class OllamaEmbedder(BaseEmbedder):
    """Calls Ollama /api/embed directly via httpx (HTTP/1.1 forced)."""

    def __init__(self) -> None:
        self._url = f"{OLLAMA_HOST.rstrip('/')}/api/embed"
        self._model = OLLAMA_EMBED_MODEL
        self._headers = {"Connection": "close"}

    def embed(self, text: str) -> list[float]:
        resp = httpx.post(
            self._url,
            json={"model": self._model, "input": text},
            timeout=_TIMEOUT,
            headers=self._headers,
        )
        resp.raise_for_status()
        return resp.json()["embeddings"][0]


# ── Nomic (cloud, free) ───────────────────────────────────────────────────────

class NomicEmbedder(BaseEmbedder):
    """
    Calls Nomic AI embedding API (free tier).
    nomic-embed-text-v1.5 outputs 768 dims natively — matches pgvector table.

    Docs: https://docs.nomic.ai/reference/endpoints/nomic-embed-text
    """

    _URL = "https://api-atlas.nomic.ai/v1/embedding/text"

    def __init__(self) -> None:
        if not NOMIC_API_KEY:
            raise RuntimeError("NOMIC_API_KEY is not set. Add it to your .env.")
        self._headers = {
            "Authorization": f"Bearer {NOMIC_API_KEY}",
            "Content-Type": "application/json",
        }
        self._model = NOMIC_EMBED_MODEL

    def embed(self, text: str) -> list[float]:
        resp = httpx.post(
            self._URL,
            json={"model": self._model, "texts": [text], "task_type": "search_document"},
            headers=self._headers,
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()["embeddings"][0]


# ── Factory ───────────────────────────────────────────────────────────────────

def get_embedder() -> BaseEmbedder:
    provider = EMBED_PROVIDER.lower()
    if provider == "ollama":
        return OllamaEmbedder()
    if provider == "nomic":
        return NomicEmbedder()
    raise ValueError(f"Unknown EMBED_PROVIDER '{provider}'. Choices: ollama, nomic")


# ── Public helpers (backwards-compatible) ─────────────────────────────────────

def embed(text: str) -> list[float]:
    return get_embedder().embed(text)


def embed_batch(texts: list[str]) -> list[list[float]]:
    return get_embedder().embed_batch(texts)
