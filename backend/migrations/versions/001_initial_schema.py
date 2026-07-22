"""Initial schema — all tables + pgvector

Revision ID: 001_initial
Revises:
Create Date: 2026-01-01 00:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pgvector extension — must exist before Vector columns
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # ── organisations ────────────────────────────────────────────────────────
    op.create_table(
        "organisations",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False, unique=True),
        sa.Column("plan", sa.String(50), server_default="free"),
        sa.Column("status", sa.String(50), server_default="active"),
        sa.Column("settings", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ── users ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("hashed_password", sa.String(255)),
        sa.Column("full_name", sa.String(255)),
        sa.Column("role", sa.String(50), server_default="engineer"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("preferences", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("last_login", sa.DateTime),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_org_id", "users", ["org_id"])

    # ── projects ─────────────────────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("status", sa.String(50), server_default="active"),
        sa.Column("target_completion_day", sa.Integer),
        sa.Column("current_progress", sa.Integer, server_default="0"),
        sa.Column("baseline_completion_day", sa.Integer),
        sa.Column("predicted_completion_day", sa.Integer),
        sa.Column("confidence_score", sa.Float, server_default="0.0"),
        sa.Column("extra_fields", JSONB, server_default="{}"),
        sa.Column("created_by", UUID(as_uuid=False), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean, server_default="false"),
    )
    op.create_index("ix_projects_org_id", "projects", ["org_id"])

    # ── vendors ──────────────────────────────────────────────────────────────
    op.create_table(
        "vendors",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("equipment_type", sa.String(255)),
        sa.Column("lead_time_days", sa.Integer),
        sa.Column("delivery_status", sa.String(50), server_default="on_track"),
        sa.Column("expected_arrival_day", sa.Integer),
        sa.Column("reliability_score", sa.Float, server_default="0.8"),
        sa.Column("extra_fields", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ── tasks ────────────────────────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("planned_start_day", sa.Integer),
        sa.Column("planned_duration", sa.Integer, nullable=False),
        sa.Column("actual_delay", sa.Integer, server_default="0"),
        sa.Column("completion", sa.Integer, server_default="0"),
        sa.Column("depends_on", JSONB, server_default="[]"),
        sa.Column("wbs_code", sa.String(50)),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("owner", sa.String(255)),
        sa.Column("vendor_id", UUID(as_uuid=False), sa.ForeignKey("vendors.id"), nullable=True),
        sa.Column("criticality_score", sa.Float, server_default="0.0"),
        sa.Column("duration_confidence", sa.Float, server_default="1.0"),
        sa.Column("total_float", sa.Integer),
        sa.Column("free_float", sa.Integer),
        sa.Column("extra_fields", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])

    # ── uploads ──────────────────────────────────────────────────────────────
    op.create_table(
        "uploads",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("uploaded_by", UUID(as_uuid=False), sa.ForeignKey("users.id")),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("file_type", sa.String(20)),
        sa.Column("file_size_bytes", sa.Integer),
        sa.Column("storage_path", sa.String(1000)),
        sa.Column("status", sa.String(50), server_default="queued"),
        sa.Column("parse_quality_score", sa.Float),
        sa.Column("schema_mapping", JSONB, server_default="{}"),
        sa.Column("unmapped_columns", JSONB, server_default="[]"),
        sa.Column("row_count", sa.Integer),
        sa.Column("error_message", sa.Text),
        sa.Column("processing_log", JSONB, server_default="[]"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ── document_chunks (with vector column) ──────────────────────────────────
    op.create_table(
        "document_chunks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("upload_id", UUID(as_uuid=False), sa.ForeignKey("uploads.id"), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("chunk_index", sa.Integer),
        sa.Column("source_file", sa.String(500)),
        sa.Column("page_number", sa.Integer),
        sa.Column("chunk_type", sa.String(50), server_default="text"),
        sa.Column("metadata", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    # Add vector column manually (Alembic doesn't know vector type without pgvector registered)
    op.execute("ALTER TABLE document_chunks ADD COLUMN embedding vector(384);")
    op.execute(
        "CREATE INDEX ix_chunks_embedding ON document_chunks "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);"
    )
    op.create_index("ix_chunks_project_id", "document_chunks", ["project_id"])

    # ── risks ─────────────────────────────────────────────────────────────────
    op.create_table(
        "risks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("task_id", UUID(as_uuid=False), sa.ForeignKey("tasks.id"), nullable=True),
        sa.Column("risk_type", sa.String(50)),
        sa.Column("severity", sa.String(20)),
        sa.Column("probability", sa.Float),
        sa.Column("impact_days", sa.Integer),
        sa.Column("risk_score", sa.Float),
        sa.Column("explanation", sa.Text),
        sa.Column("evidence", JSONB, server_default="[]"),
        sa.Column("confidence", sa.Float, server_default="0.8"),
        sa.Column("is_resolved", sa.Boolean, server_default="false"),
        sa.Column("resolved_by_scenario_id", UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_risks_project_id", "risks", ["project_id"])

    # ── scenarios ─────────────────────────────────────────────────────────────
    op.create_table(
        "scenarios",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("created_by", UUID(as_uuid=False), sa.ForeignKey("users.id")),
        sa.Column("name", sa.String(255)),
        sa.Column("action_type", sa.String(100)),
        sa.Column("action_params", JSONB, server_default="{}"),
        sa.Column("old_delay_days", sa.Integer),
        sa.Column("new_delay_days", sa.Integer),
        sa.Column("days_saved", sa.Integer),
        sa.Column("cost_impact", sa.Float, server_default="0.0"),
        sa.Column("feasibility_score", sa.Float),
        sa.Column("confidence", sa.Float),
        sa.Column("monte_carlo_p50", sa.Integer),
        sa.Column("monte_carlo_p80", sa.Integer),
        sa.Column("monte_carlo_p90", sa.Integer),
        sa.Column("on_time_probability", sa.Float),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("approved_by", UUID(as_uuid=False), nullable=True),
        sa.Column("approved_at", sa.DateTime),
        sa.Column("rejection_reason", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ── actions ───────────────────────────────────────────────────────────────
    op.create_table(
        "actions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("scenario_id", UUID(as_uuid=False), sa.ForeignKey("scenarios.id"), nullable=True),
        sa.Column("created_by_ai", sa.Boolean, server_default="true"),
        sa.Column("created_by_user", UUID(as_uuid=False), nullable=True),
        sa.Column("action_type", sa.String(100)),
        sa.Column("description", sa.Text),
        sa.Column("target_task_id", UUID(as_uuid=False), nullable=True),
        sa.Column("priority", sa.String(20), server_default="medium"),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("evidence", JSONB, server_default="[]"),
        sa.Column("estimated_impact_days", sa.Integer),
        sa.Column("confidence", sa.Float),
        sa.Column("approved_by", UUID(as_uuid=False), nullable=True),
        sa.Column("completed_at", sa.DateTime),
        sa.Column("actual_impact_days", sa.Integer),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ── audit_events ──────────────────────────────────────────────────────────
    op.create_table(
        "audit_events",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), nullable=True),
        sa.Column("user_id", UUID(as_uuid=False), nullable=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50)),
        sa.Column("entity_id", UUID(as_uuid=False)),
        sa.Column("before_state", JSONB),
        sa.Column("after_state", JSONB),
        sa.Column("metadata", JSONB, server_default="{}"),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_project_id", "audit_events", ["project_id"])

    # ── schema_mapping_memory ─────────────────────────────────────────────────
    op.create_table(
        "schema_mapping_memory",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=False), nullable=False),
        sa.Column("source_column", sa.String(255), nullable=False),
        sa.Column("canonical_column", sa.String(100), nullable=False),
        sa.Column("mapping_method", sa.String(50)),
        sa.Column("confidence", sa.Float),
        sa.Column("usage_count", sa.Integer, server_default="1"),
        sa.Column("last_used", sa.DateTime, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_schema_memory_org_col", "schema_mapping_memory", ["org_id", "source_column"])


def downgrade() -> None:
    op.drop_table("schema_mapping_memory")
    op.drop_table("audit_events")
    op.drop_table("actions")
    op.drop_table("scenarios")
    op.drop_table("risks")
    op.drop_table("document_chunks")
    op.drop_table("uploads")
    op.drop_table("tasks")
    op.drop_table("vendors")
    op.drop_table("projects")
    op.drop_table("users")
    op.drop_table("organisations")
    op.execute("DROP EXTENSION IF EXISTS vector;")
