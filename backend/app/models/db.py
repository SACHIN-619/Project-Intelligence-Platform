"""
app/models/db.py
=================
All SQLAlchemy ORM models.

Design principles:
  • Every table has org_id (tenant isolation)
  • UUIDs as primary keys
  • JSONB 'extra_fields' on key tables (schema evolution)
  • Soft deletes via is_deleted flag
  • Append-only audit_events table
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, Enum as SAEnum, JSON,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


# ─────────────────────────────────────────────────────────────────────────────
# ORGANISATION  (tenant root)
# ─────────────────────────────────────────────────────────────────────────────
class Organisation(Base):
    __tablename__ = "organisations"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    plan = Column(String(50), default="free")  # free | starter | business | enterprise
    status = Column(String(50), default="active")  # pending | active | restricted | suspended
    settings = Column(JSONB, default=dict)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    users = relationship("User", back_populates="organisation", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="organisation", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
# USER
# ─────────────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), ForeignKey("organisations.id"), nullable=False)
    email = Column(String(320), nullable=False)
    hashed_password = Column(String(255))
    full_name = Column(String(255))
    role = Column(String(50), default="engineer")  # engineer | manager | quality | procurement | executive | admin
    is_active = Column(Boolean, default=True)
    preferences = Column(JSONB, default=dict)   # answer_style, preferred_view, etc.
    created_at = Column(DateTime, default=_now)
    last_login = Column(DateTime)

    organisation = relationship("Organisation", back_populates="users")


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT
# ─────────────────────────────────────────────────────────────────────────────
class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), ForeignKey("organisations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="draft")  # draft | active | completed | archived
    target_completion_day = Column(Integer)        # absolute calendar day
    current_progress = Column(Integer, default=0)  # 0–100 %
    baseline_completion_day = Column(Integer)      # frozen on first analysis
    predicted_completion_day = Column(Integer)
    confidence_score = Column(Float, default=0.0)  # 0.0–1.0
    extra_fields = Column(JSONB, default=dict)     # absorbs unknown schema fields
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
    is_deleted = Column(Boolean, default=False)

    organisation = relationship("Organisation", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    vendors = relationship("Vendor", back_populates="project", cascade="all, delete-orphan")
    risks = relationship("Risk", back_populates="project", cascade="all, delete-orphan")
    scenarios = relationship("Scenario", back_populates="project", cascade="all, delete-orphan")
    uploads = relationship("Upload", back_populates="project", cascade="all, delete-orphan")
    document_chunks = relationship("DocumentChunk", back_populates="project", cascade="all, delete-orphan")
    actions = relationship("Action", back_populates="project", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
# TASK  (core scheduling entity)
# ─────────────────────────────────────────────────────────────────────────────
class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), nullable=False)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # scheduling
    planned_start_day = Column(Integer)
    planned_duration = Column(Integer, nullable=False)  # days
    actual_delay = Column(Integer, default=0)           # current delay in days
    completion = Column(Integer, default=0)             # 0–100 %

    # graph
    depends_on = Column(JSONB, default=list)  # list of task_id strings
    wbs_code = Column(String(50))             # work breakdown structure code

    status = Column(String(50), default="pending")  # pending | running | delayed | completed
    owner = Column(String(255))
    vendor_id = Column(UUID(as_uuid=False), ForeignKey("vendors.id"), nullable=True)

    # intelligence
    criticality_score = Column(Float, default=0.0)
    duration_confidence = Column(Float, default=1.0)  # how reliable is the duration estimate
    total_float = Column(Integer)                      # slack days (null until analysed)
    free_float = Column(Integer)

    extra_fields = Column(JSONB, default=dict)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    project = relationship("Project", back_populates="tasks")
    vendor = relationship("Vendor", back_populates="tasks")


# ─────────────────────────────────────────────────────────────────────────────
# VENDOR
# ─────────────────────────────────────────────────────────────────────────────
class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), nullable=False)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    equipment_type = Column(String(255))
    lead_time_days = Column(Integer)
    delivery_status = Column(String(50), default="on_track")  # on_track | at_risk | delayed | delivered
    expected_arrival_day = Column(Integer)
    reliability_score = Column(Float, default=0.8)  # 0–1 historical reliability
    extra_fields = Column(JSONB, default=dict)
    created_at = Column(DateTime, default=_now)

    project = relationship("Project", back_populates="vendors")
    tasks = relationship("Task", back_populates="vendor")


# ─────────────────────────────────────────────────────────────────────────────
# RISK  (computed, never uploaded)
# ─────────────────────────────────────────────────────────────────────────────
class Risk(Base):
    __tablename__ = "risks"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), nullable=False)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False)
    task_id = Column(UUID(as_uuid=False), ForeignKey("tasks.id"), nullable=True)

    risk_type = Column(String(50))    # schedule | quality | procurement | vendor
    severity = Column(String(20))     # low | medium | high | critical
    probability = Column(Float)       # 0–1
    impact_days = Column(Integer)
    risk_score = Column(Float)        # probability × impact
    explanation = Column(Text)
    evidence = Column(JSONB, default=list)   # list of {chunk_id, text, source}
    confidence = Column(Float, default=0.8)
    is_resolved = Column(Boolean, default=False)
    resolved_by_scenario_id = Column(UUID(as_uuid=False), nullable=True)
    created_at = Column(DateTime, default=_now)

    project = relationship("Project", back_populates="risks")


# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO  (what-if simulations)
# ─────────────────────────────────────────────────────────────────────────────
class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), nullable=False)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    name = Column(String(255))
    action_type = Column(String(100))  # backup_vendor | parallel_execution | reschedule | add_crew
    action_params = Column(JSONB, default=dict)
    old_delay_days = Column(Integer)
    new_delay_days = Column(Integer)
    days_saved = Column(Integer)
    cost_impact = Column(Float, default=0.0)
    feasibility_score = Column(Float)
    confidence = Column(Float)
    monte_carlo_p50 = Column(Integer)
    monte_carlo_p80 = Column(Integer)
    monte_carlo_p90 = Column(Integer)
    on_time_probability = Column(Float)
    status = Column(String(50), default="draft")  # draft | approved | rejected | applied
    approved_by = Column(UUID(as_uuid=False), nullable=True)
    approved_at = Column(DateTime)
    rejection_reason = Column(Text)
    created_at = Column(DateTime, default=_now)

    project = relationship("Project", back_populates="scenarios")


# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD  (file ingestion tracking)
# ─────────────────────────────────────────────────────────────────────────────
class Upload(Base):
    __tablename__ = "uploads"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), nullable=False)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False)
    uploaded_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    filename = Column(String(500), nullable=False)
    file_type = Column(String(20))      # csv | xlsx | pdf | docx
    file_size_bytes = Column(Integer)
    storage_path = Column(String(1000))
    status = Column(String(50), default="queued")  # queued | parsing | parsed | indexed | failed
    parse_quality_score = Column(Float)            # 0–100 data quality
    schema_mapping = Column(JSONB, default=dict)   # original_col -> canonical_col
    unmapped_columns = Column(JSONB, default=list) # columns we couldn't map
    row_count = Column(Integer)
    error_message = Column(Text)
    processing_log = Column(JSONB, default=list)  # step-by-step log
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    project = relationship("Project", back_populates="uploads")


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT CHUNK  (RAG — vector search)
# ─────────────────────────────────────────────────────────────────────────────
class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), nullable=False)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False)
    upload_id = Column(UUID(as_uuid=False), ForeignKey("uploads.id"), nullable=True)

    content = Column(Text, nullable=False)
    embedding = Column(Vector(384))     # bge-small produces 384-dim vectors
    chunk_index = Column(Integer)
    source_file = Column(String(500))
    page_number = Column(Integer)
    chunk_type = Column(String(50), default="text")  # text | table | spec | rfi
    # metadata = Column(JSONB, default=dict)
    chunk_metadata = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=_now)

    project = relationship("Project", back_populates="document_chunks")


# ─────────────────────────────────────────────────────────────────────────────
# ACTION  (approved recovery actions)
# ─────────────────────────────────────────────────────────────────────────────
class Action(Base):
    __tablename__ = "actions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), nullable=False)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False)
    scenario_id = Column(UUID(as_uuid=False), ForeignKey("scenarios.id"), nullable=True)
    created_by_ai = Column(Boolean, default=True)
    created_by_user = Column(UUID(as_uuid=False), nullable=True)
    action_type = Column(String(100))
    description = Column(Text)
    target_task_id = Column(UUID(as_uuid=False), nullable=True)
    priority = Column(String(20), default="medium")  # low | medium | high | critical
    status = Column(String(50), default="pending")   # pending | approved | rejected | completed
    evidence = Column(JSONB, default=list)
    estimated_impact_days = Column(Integer)
    confidence = Column(Float)
    approved_by = Column(UUID(as_uuid=False), nullable=True)
    completed_at = Column(DateTime)
    actual_impact_days = Column(Integer)  # filled after resolution — for learning
    created_at = Column(DateTime, default=_now)

    project = relationship("Project", back_populates="actions")


# ─────────────────────────────────────────────────────────────────────────────
# AUDIT EVENT  (append-only, never updated)
# ─────────────────────────────────────────────────────────────────────────────
class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), nullable=False)
    project_id = Column(UUID(as_uuid=False), nullable=True)
    user_id = Column(UUID(as_uuid=False), nullable=True)
    event_type = Column(String(100), nullable=False)  # upload | simulate | approve | delete …
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=False))
    before_state = Column(JSONB)
    after_state = Column(JSONB)
    # metadata = Column(JSONB, default=dict)
    audit_metadata = Column("metadata", JSONB, default=dict)
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=_now)


# ─────────────────────────────────────────────────────────────────────────────
# SCHEMA MAPPING MEMORY  (per-tenant field learning)
# ─────────────────────────────────────────────────────────────────────────────
class SchemaMappingMemory(Base):
    """
    Stores successful field mappings per tenant.
    Next time they upload with the same column name, we map instantly.
    This is the 'adaptive schema learning' feature.
    """
    __tablename__ = "schema_mapping_memory"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id = Column(UUID(as_uuid=False), nullable=False)
    source_column = Column(String(255), nullable=False)   # as it appeared in upload
    canonical_column = Column(String(100), nullable=False) # internal name
    mapping_method = Column(String(50))                   # exact | fuzzy | semantic | user
    confidence = Column(Float)
    usage_count = Column(Integer, default=1)
    last_used = Column(DateTime, default=_now)
    created_at = Column(DateTime, default=_now)
