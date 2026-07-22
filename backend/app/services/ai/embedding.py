"""
app/services/ai/embedding.py
==============================
Text embedding service for RAG vector search.

Model: BAAI/bge-small-en-v1.5 (384-dim, ~130MB, no API key needed)
Lazy-loaded on first use to keep startup fast.
Falls back to keyword TF-IDF if model unavailable.
"""

from __future__ import annotations

import hashlib
from functools import lru_cache
from typing import List, Optional

import numpy as np


class EmbeddingService:
    """
    Wraps sentence-transformers for text embedding.

    Singleton pattern — model loaded once, reused across requests.
    Falls back to a fast TF-IDF keyword approach if torch unavailable.
    """

    MODEL_NAME = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIM = 384

    def __init__(self):
        self._model = None
        self._mode = "uninitialised"   # neural | tfidf | unavailable

    def _ensure_loaded(self):
        if self._mode != "uninitialised":
            return
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
            self._model = SentenceTransformer(self.MODEL_NAME)
            self._mode = "neural"
            print(f"[EmbeddingService] Loaded {self.MODEL_NAME} (neural mode)")
        except Exception as e:
            print(f"[EmbeddingService] Neural model unavailable ({e}). Using TF-IDF fallback.")
            self._mode = "tfidf"

    # ── Public API ────────────────────────────────────────────────────────────

    def embed(self, text: str) -> List[float]:
        """Embed a single string. Returns list of floats (length = EMBEDDING_DIM)."""
        self._ensure_loaded()
        if self._mode == "neural":
            vec = self._model.encode(text, normalize_embeddings=True)
            return vec.tolist()
        return self._tfidf_embed(text)

    def embed_batch(self, texts: List[str], batch_size: int = 64) -> List[List[float]]:
        """Embed a list of strings efficiently."""
        self._ensure_loaded()
        if not texts:
            return []
        if self._mode == "neural":
            vecs = self._model.encode(
                texts,
                normalize_embeddings=True,
                batch_size=batch_size,
                show_progress_bar=False,
            )
            return [v.tolist() for v in vecs]
        return [self._tfidf_embed(t) for t in texts]

    def cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Cosine similarity between two embedding vectors."""
        va = np.array(a, dtype=np.float32)
        vb = np.array(b, dtype=np.float32)
        denom = np.linalg.norm(va) * np.linalg.norm(vb)
        if denom < 1e-8:
            return 0.0
        return float(np.dot(va, vb) / denom)

    @property
    def mode(self) -> str:
        self._ensure_loaded()
        return self._mode

    # ── TF-IDF fallback ───────────────────────────────────────────────────────

    def _tfidf_embed(self, text: str) -> List[float]:
        """
        Simple deterministic bag-of-words embedding for fallback.
        Produces EMBEDDING_DIM-sized vector by hashing word tokens.
        Not semantically rich but maintains keyword proximity.
        """
        words = text.lower().split()
        vec = np.zeros(self.EMBEDDING_DIM, dtype=np.float32)
        for word in words:
            h = int(hashlib.md5(word.encode()).hexdigest(), 16)
            idx = h % self.EMBEDDING_DIM
            vec[idx] += 1.0
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        return vec.tolist()


# ── Singleton ─────────────────────────────────────────────────────────────────
embedding_service = EmbeddingService()
