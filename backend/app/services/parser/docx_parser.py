"""
app/services/parser/docx_parser.py
==================================
DOCX document extraction for project specifications, meeting notes, and RFIs.
Extracts paragraphs and tables using python-docx and chunks them for RAG.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

try:
    import docx
except ImportError:
    docx = None

from app.services.parser.pdf_parser import TextChunk, PDFParseResult


class DocxParser:
    """
    Extracts text and table content from DOCX files and chunks for RAG.
    """

    CHUNK_SIZE = 400
    CHUNK_OVERLAP = 50

    DOC_TYPE_SIGNALS: Dict[str, List[str]] = {
        "spec": ["specification", "technical requirement", "standard", "compliance", "tia-942"],
        "rfi": ["request for information", "rfi", "clarification", "query"],
        "meeting_notes": ["minutes", "meeting notes", "mom", "action items"],
        "schedule": ["gantt", "milestone", "schedule", "critical path"],
    }

    def parse(self, content: bytes, filename: str) -> PDFParseResult:
        warnings: List[str] = []
        chunks: List[TextChunk] = []

        if docx is None:
            warnings.append("python-docx is not installed in the environment.")
            return PDFParseResult(
                chunks=[],
                page_count=0,
                document_type="unknown",
                title=filename,
                warnings=warnings,
            )

        try:
            doc = docx.Document(io.BytesIO(content))
        except Exception as e:
            warnings.append(f"Failed to parse docx structure: {e}")
            return PDFParseResult(
                chunks=[],
                page_count=0,
                document_type="unknown",
                title=filename,
                warnings=warnings,
            )

        extracted_paragraphs: List[str] = []
        for p in doc.paragraphs:
            text = p.text.strip()
            if text:
                extracted_paragraphs.append(text)

        # Extract tables as formatted text lines
        for table in doc.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if cells:
                    extracted_paragraphs.append(" | ".join(cells))

        full_text = "\n\n".join(extracted_paragraphs)
        if not full_text:
            warnings.append("Document appears empty or contains only unsupported objects.")

        words = full_text.split()
        chunk_idx = 0
        step = max(1, self.CHUNK_SIZE - self.CHUNK_OVERLAP)

        for i in range(0, max(len(words), 1), step):
            window = words[i : i + self.CHUNK_SIZE]
            if not window:
                break
            chunk_text = " ".join(window)
            chunks.append(
                TextChunk(
                    text=chunk_text,
                    page_number=1 + (i // max(self.CHUNK_SIZE, 1)),
                    chunk_index=chunk_idx,
                    chunk_type="text",
                )
            )
            chunk_idx += 1

        # Detect document type
        text_lower = full_text[:2000].lower()
        doc_type = "unknown"
        for dtype, signals in self.DOC_TYPE_SIGNALS.items():
            if any(s in text_lower for s in signals):
                doc_type = dtype
                break

        return PDFParseResult(
            chunks=chunks,
            page_count=max(1, len(chunks)),
            document_type=doc_type,
            title=doc.core_properties.title if hasattr(doc, "core_properties") and doc.core_properties.title else filename,
            warnings=warnings,
        )
