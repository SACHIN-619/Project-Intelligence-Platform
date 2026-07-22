"""
app/api/upload.py
==================
File upload endpoints.

Flow:
  POST /upload/preview  → parse in-memory, return schema mapping for user review
  POST /upload/commit   → write file to storage, queue background ingestion
  GET  /upload/{id}     → check ingestion status
  GET  /uploads         → list all uploads for a project
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import List

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, require_auth, CanUpload
from app.config import settings
from app.models.db import Upload, User
from app.models.schemas import UploadPreview, UploadResponse, MessageResponse
from app.services.parser.csv_parser import ScheduleParser
from app.services.parser.pdf_parser import PDFParser
from app.services.parser.schema_mapper import SchemaMapper
from app.services.queue.jobs import job_queue, job_process_upload, job_run_analysis

router = APIRouter(prefix="/upload", tags=["Upload"])

# Allowed extensions and size limits
ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls", "pdf", "docx"}
MAX_FILE_SIZE_MB = 50


def _validate_file(filename: str, size: int) -> None:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '.{ext}' not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    if size > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {MAX_FILE_SIZE_MB} MB limit.",
        )


async def _save_file(content: bytes, filename: str) -> str:
    """Persist bytes to local storage; returns absolute path."""
    storage_dir = Path(settings.storage_local_path)
    storage_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}_{Path(filename).name}"
    dest = storage_dir / safe_name
    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)
    return str(dest)


# ─────────────────────────────────────────────────────────────────────────────
# PREVIEW  — parse without persisting
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/preview", response_model=UploadPreview)
async def preview_upload(
    file: UploadFile = File(...),
    user: User = CanUpload,
):
    """
    Parse an uploaded file and return a schema mapping preview.
    Nothing is saved — user confirms before committing.
    """
    content = await file.read()
    _validate_file(file.filename, len(content))

    ext = file.filename.rsplit(".", 1)[-1].lower()
    warnings: List[str] = []

    if ext in ("csv", "xlsx", "xls"):
        mapper = SchemaMapper()
        parser = ScheduleParser(mapper)
        result = parser.parse(content, file.filename)

        # Build sample rows for preview
        sample_rows = []
        for t in result.tasks[:5]:
            sample_rows.append({
                "task": t.task_name,
                "duration": t.duration,
                "status": t.status,
                "depends_on": t.depends_on,
            })

        return UploadPreview(
            filename=file.filename,
            detected_type="schedule" if result.tasks else "vendor",
            row_count=result.row_count,
            columns_detected=[m.original for m in result.schema_result.mappings],
            schema_mapping={
                m.original: m.canonical or "unmapped"
                for m in result.schema_result.mappings
            },
            unmapped_columns=result.schema_result.unmapped_columns,
            quality_score=result.quality_score,
            warnings=result.warnings,
            sample_rows=sample_rows,
        )

    elif ext == "pdf":
        pdf_parser = PDFParser()
        pdf_result = pdf_parser.parse(content, file.filename)
        return UploadPreview(
            filename=file.filename,
            detected_type=pdf_result.document_type,
            row_count=pdf_result.page_count,
            columns_detected=[],
            schema_mapping={},
            unmapped_columns=[],
            quality_score=80.0,
            warnings=pdf_result.warnings,
            sample_rows=[{"text": c.text[:200]} for c in pdf_result.chunks[:3]],
        )

    raise HTTPException(status_code=400, detail="Unsupported file type for preview")


# ─────────────────────────────────────────────────────────────────────────────
# COMMIT  — save file, create DB record, enqueue processing
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/commit", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def commit_upload(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
    user: User = CanUpload,
):
    """
    Save file and enqueue for background processing.
    Returns upload record immediately — poll /upload/{id} for status.
    """
    content = await file.read()
    _validate_file(file.filename, len(content))

    ext = file.filename.rsplit(".", 1)[-1].lower()

    # Save to storage
    file_path = await _save_file(content, file.filename)

    # Create DB record
    upload = Upload(
        org_id=user.org_id,
        project_id=project_id,
        uploaded_by=user.id,
        filename=file.filename,
        file_type=ext,
        file_size_bytes=len(content),
        storage_path=file_path,
        status="queued",
    )
    db.add(upload)
    await db.flush()
    upload_id = str(upload.id)
    await db.commit()

    # Enqueue processing
    await job_queue.enqueue(
        job_process_upload,
        upload_id, project_id, user.org_id, file_path, file.filename
    )
    # Also trigger analysis after processing (delayed via job chaining)
    await job_queue.enqueue(job_run_analysis, project_id, user.org_id)

    return UploadResponse.model_validate(upload)


# ─────────────────────────────────────────────────────────────────────────────
# STATUS  — poll ingestion progress
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{upload_id}", response_model=UploadResponse)
async def get_upload_status(
    upload_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    upload = await db.get(Upload, upload_id)
    if not upload or upload.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Upload not found")
    return UploadResponse.model_validate(upload)


# ─────────────────────────────────────────────────────────────────────────────
# LIST  — all uploads for a project
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/project/{project_id}", response_model=List[UploadResponse])
async def list_uploads(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    stmt = select(Upload).where(
        Upload.project_id == project_id,
        Upload.org_id == user.org_id,
    ).order_by(Upload.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return [UploadResponse.model_validate(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# DELETE  — cancel / remove an upload
# ─────────────────────────────────────────────────────────────────────────────
@router.delete("/{upload_id}", response_model=MessageResponse)
async def delete_upload(
    upload_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    upload = await db.get(Upload, upload_id)
    if not upload or upload.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Upload not found")

    # Remove file from disk
    if upload.storage_path and os.path.exists(upload.storage_path):
        os.remove(upload.storage_path)

    await db.delete(upload)
    return MessageResponse(message="Upload deleted successfully")
