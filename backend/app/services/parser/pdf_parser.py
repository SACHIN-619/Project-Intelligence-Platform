"""
app/services/parser/pdf_parser.py
===================================
PDF extraction for specifications, submittals, RFIs, and meeting notes.

Extracts:
  • Text blocks (chunked to ~400 tokens for RAG)
  • Tables (preserved as structured dicts)
  • Metadata (page count, title, document type heuristic)
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class TextChunk:
    text: str
    page_number: int
    chunk_index: int
    chunk_type: str = "text"   # text | table | heading | spec
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PDFParseResult:
    chunks: List[TextChunk]
    page_count: int
    document_type: str       # schedule | spec | rfi | report | unknown
    title: Optional[str]
    warnings: List[str]


class PDFParser:
    """
    Extracts and chunks content from PDF documents.
    Falls back to pdfplumber if PyMuPDF is unavailable.
    """

    CHUNK_SIZE = 400    # approximate words per chunk
    CHUNK_OVERLAP = 50  # overlap between adjacent chunks

    # Keywords that signal document type
    DOC_TYPE_SIGNALS: Dict[str, List[str]] = {
        "spec":     ["specification", "technical requirement", "standard", "compliance", "tia-942"],
        "rfi":      ["request for information", "rfi", "clarification", "query"],
        "schedule": ["schedule", "baseline", "milestone", "wbs", "gantt"],
        "report":   ["report", "summary", "status update", "meeting minutes"],
    }

    def parse(self, content: bytes, filename: str) -> PDFParseResult:
        """Parse PDF bytes; try PyMuPDF first, fall back to pdfplumber."""
        try:
            return self._parse_pymupdf(content, filename)
        except ImportError:
            pass
        try:
            return self._parse_pdfplumber(content, filename)
        except ImportError:
            pass
        # Last resort: treat as plain text if somehow decodable
        return PDFParseResult(
            chunks=[TextChunk("[PDF extraction unavailable — install pymupdf or pdfplumber]", 1, 0)],
            page_count=0,
            document_type="unknown",
            title=None,
            warnings=["PDF extraction libraries not installed. Run: pip install pymupdf pdfplumber"],
        )

    # ── PyMuPDF path ──────────────────────────────────────────────────────────

    def _parse_pymupdf(self, content: bytes, filename: str) -> PDFParseResult:
        import fitz  # type: ignore  (pymupdf)

        doc = fitz.open(stream=content, filetype="pdf")
        all_text_by_page: List[str] = []
        warnings: List[str] = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            if text.strip():
                all_text_by_page.append(text)
            else:
                warnings.append(f"Page {page_num + 1} appears to be an image — OCR not applied.")
                all_text_by_page.append("")

        title = doc.metadata.get("title") or self._infer_title(all_text_by_page)
        doc_type = self._detect_doc_type(all_text_by_page, filename)

        chunks = self._chunk_pages(all_text_by_page)
        return PDFParseResult(
            chunks=chunks,
            page_count=len(doc),
            document_type=doc_type,
            title=title,
            warnings=warnings,
        )

    # ── pdfplumber path ───────────────────────────────────────────────────────

    def _parse_pdfplumber(self, content: bytes, filename: str) -> PDFParseResult:
        import pdfplumber  # type: ignore

        all_text_by_page: List[str] = []
        warnings: List[str] = []

        with pdfplumber.open(io.BytesIO(content)) as pdf:
            page_count = len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                all_text_by_page.append(text)

                # Extract tables
                tables = page.extract_tables()
                for t in tables:
                    if t:
                        table_text = "\n".join(
                            " | ".join(str(c) if c else "" for c in row) for row in t
                        )
                        all_text_by_page[-1] += f"\n[TABLE]\n{table_text}\n[/TABLE]"

        title = self._infer_title(all_text_by_page)
        doc_type = self._detect_doc_type(all_text_by_page, filename)
        chunks = self._chunk_pages(all_text_by_page)

        return PDFParseResult(
            chunks=chunks,
            page_count=page_count,
            document_type=doc_type,
            title=title,
            warnings=warnings,
        )

    # ── Chunking ──────────────────────────────────────────────────────────────

    def _chunk_pages(self, pages: List[str]) -> List[TextChunk]:
        """Split full document text into overlapping chunks."""
        chunks: List[TextChunk] = []
        chunk_idx = 0

        for page_num, text in enumerate(pages, start=1):
            if not text.strip():
                continue

            words = text.split()
            step = self.CHUNK_SIZE - self.CHUNK_OVERLAP

            for start in range(0, len(words), step):
                window = words[start: start + self.CHUNK_SIZE]
                chunk_text = " ".join(window).strip()
                if not chunk_text:
                    continue

                ctype = "table" if "[TABLE]" in chunk_text else self._classify_chunk(chunk_text)
                chunks.append(TextChunk(
                    text=chunk_text,
                    page_number=page_num,
                    chunk_index=chunk_idx,
                    chunk_type=ctype,
                ))
                chunk_idx += 1

        return chunks

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _infer_title(self, pages: List[str]) -> Optional[str]:
        if not pages:
            return None
        first_lines = pages[0].strip().split("\n")
        for line in first_lines[:5]:
            clean = line.strip()
            if 5 < len(clean) < 120:
                return clean
        return None

    def _detect_doc_type(self, pages: List[str], filename: str) -> str:
        full_text = " ".join(pages[:3]).lower()  # only check first 3 pages
        fn_lower = filename.lower()

        for doc_type, signals in self.DOC_TYPE_SIGNALS.items():
            if any(s in full_text or s in fn_lower for s in signals):
                return doc_type
        return "unknown"

    def _classify_chunk(self, text: str) -> str:
        lower = text.lower()
        if any(k in lower for k in ["shall", "requirement", "specification", "comply"]):
            return "spec"
        if any(k in lower for k in ["rfi", "request for information", "query"]):
            return "rfi"
        if text.strip().endswith(":") or len(text) < 60:
            return "heading"
        return "text"
