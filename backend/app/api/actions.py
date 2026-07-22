"""
app/api/actions.py
===================
Action management endpoints.

An Action is the COMMITTED result of an approved Scenario —
the concrete work item that changes project state.

  POST /actions              → create action (AI or manual)
  GET  /actions/{id}         → get action detail
  POST /actions/{id}/approve → manager approves
  POST /actions/{id}/reject  → manager rejects
  POST /actions/{id}/complete → mark completed + record actual outcome
  GET  /actions/project/{id} → list all actions for a project
  GET  /actions/project/{id}/board → kanban board view
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth, CanApprove, CanSimulate
from app.models.db import Action, AuditEvent, User
from app.models.schemas import ActionRead, ApproveActionRequest, RejectActionRequest, MessageResponse
from app.config import settings
from app.services.intelligence.memory_service import record_decision, record_outcome

router = APIRouter(prefix="/actions", tags=["Actions"])


# ── Request schemas ───────────────────────────────────────────────────────────

class CreateActionRequest(BaseModel):
    project_id: str
    action_type: str
    description: str
    target_task_id: Optional[str] = None
    priority: str = "medium"          # low | medium | high | critical
    estimated_impact_days: Optional[int] = None
    confidence: Optional[float] = None
    scenario_id: Optional[str] = None
    evidence: List[Dict[str, Any]] = []


class CompleteActionRequest(BaseModel):
    actual_impact_days: int
    notes: Optional[str] = None


class KanbanColumn(BaseModel):
    status: str
    label: str
    actions: List[ActionRead]
    count: int


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_action_or_404(action_id: str, org_id: str, db: AsyncSession) -> Action:
    action = await db.get(Action, action_id)
    if not action or action.org_id != org_id:
        raise HTTPException(status_code=404, detail="Action not found")
    return action


async def _write_audit(
    db: AsyncSession,
    org_id: str,
    user_id: str,
    event_type: str,
    entity_id: str,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
) -> None:
    db.add(AuditEvent(
        org_id=org_id,
        user_id=user_id,
        event_type=event_type,
        entity_type="action",
        entity_id=entity_id,
        before_state=before,
        after_state=after,
    ))


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────
@router.post("", response_model=ActionRead, status_code=status.HTTP_201_CREATED)
async def create_action(
    body: CreateActionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = CanSimulate,
):
    """Create a new recovery action (manual or from an approved scenario)."""
    action = Action(
        org_id=user.org_id,
        project_id=body.project_id,
        scenario_id=body.scenario_id,
        created_by_ai=False,
        created_by_user=user.id,
        action_type=body.action_type,
        description=body.description,
        target_task_id=body.target_task_id,
        priority=body.priority,
        status="pending",
        evidence=body.evidence,
        estimated_impact_days=body.estimated_impact_days,
        confidence=body.confidence,
    )
    db.add(action)
    await db.flush()

    await _write_audit(db, user.org_id, user.id, "action_created", str(action.id),
                       after={"type": body.action_type, "priority": body.priority})
    return ActionRead.model_validate(action)


# ─────────────────────────────────────────────────────────────────────────────
# READ
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{action_id}", response_model=ActionRead)
async def get_action(
    action_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    return ActionRead.model_validate(await _get_action_or_404(action_id, user.org_id, db))


# ─────────────────────────────────────────────────────────────────────────────
# APPROVE
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/{action_id}/approve", response_model=MessageResponse)
async def approve_action(
    action_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = CanApprove,
):
    """
    Manager approves an action. AI never executes — human always controls.
    Records AI memory learning event if enabled.
    """
    action = await _get_action_or_404(action_id, user.org_id, db)
    if action.status != "pending":
        raise HTTPException(400, f"Action is already '{action.status}'")

    before = {"status": action.status}
    action.status = "approved"
    action.approved_by = user.id

    if settings.feature_ai_memory_enabled:
        await record_decision(
            db=db,
            project_id=str(action.project_id),
            org_id=user.org_id,
            user_id=str(user.id),
            action_type=action.action_type or "unknown",
            description=action.description or "",
            estimated_days_saved=action.estimated_impact_days or 0,
            approved=True,
        )

    await _write_audit(db, user.org_id, user.id, "action_approved", action_id,
                       before=before, after={"status": "approved"})
    return MessageResponse(
        message="Action approved.",
        detail=f"Approved by {user.full_name or user.email}",
    )


# ─────────────────────────────────────────────────────────────────────────────
# REJECT
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/{action_id}/reject", response_model=MessageResponse)
async def reject_action(
    action_id: str,
    body: RejectActionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = CanApprove,
):
    """
    Manager rejects an action.
    Records AI memory learning event with reason.
    """
    action = await _get_action_or_404(action_id, user.org_id, db)
    before = {"status": action.status}
    action.status = "rejected"

    if settings.feature_ai_memory_enabled:
        await record_decision(
            db=db,
            project_id=str(action.project_id),
            org_id=user.org_id,
            user_id=str(user.id),
            action_type=action.action_type or "unknown",
            description=action.description or "",
            estimated_days_saved=action.estimated_impact_days or 0,
            approved=False,
            reason=body.reason,
        )

    await _write_audit(db, user.org_id, user.id, "action_rejected", action_id,
                       before=before, after={"status": "rejected", "reason": body.reason})
    return MessageResponse(message="Action rejected.", detail=body.reason)


# ─────────────────────────────────────────────────────────────────────────────
# COMPLETE  — record actual outcome for learning
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/{action_id}/complete", response_model=ActionRead)
async def complete_action(
    action_id: str,
    body: CompleteActionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = CanSimulate,
):
    """
    Mark action as completed and record the ACTUAL impact.
    This data feeds the learning system — was our estimate correct?
    """
    action = await _get_action_or_404(action_id, user.org_id, db)
    if action.status != "approved":
        raise HTTPException(400, "Only approved actions can be completed")

    before = {"status": action.status, "actual_impact": action.actual_impact_days}
    action.status = "completed"
    action.completed_at = datetime.utcnow()
    action.actual_impact_days = body.actual_impact_days

    # Compute estimation accuracy for learning
    if action.estimated_impact_days and action.estimated_impact_days > 0:
        accuracy = body.actual_impact_days / action.estimated_impact_days
    else:
        accuracy = None

    if settings.feature_ai_memory_enabled:
        await record_outcome(
            db=db,
            project_id=str(action.project_id),
            org_id=user.org_id,
            action_id=str(action.id),
            estimated_days_saved=action.estimated_impact_days or 0,
            actual_days_saved=body.actual_impact_days,
        )

    await _write_audit(db, user.org_id, user.id, "action_completed", action_id,
                       before=before, after={
                           "status": "completed",
                           "actual_impact_days": body.actual_impact_days,
                           "estimation_accuracy": accuracy,
                       })
    return ActionRead.model_validate(action)


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/project/{project_id}", response_model=List[ActionRead])
async def list_actions(
    project_id: str,
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    stmt = select(Action).where(
        Action.project_id == project_id,
        Action.org_id == user.org_id,
    )
    if status_filter:
        stmt = stmt.where(Action.status == status_filter)
    stmt = stmt.order_by(Action.created_at.desc())

    rows = (await db.execute(stmt)).scalars().all()
    return [ActionRead.model_validate(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# KANBAN BOARD VIEW
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/project/{project_id}/board", response_model=List[KanbanColumn])
async def action_board(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """
    Returns actions grouped by status for the Kanban board view.
    Columns: Pending → Approved → Completed | Rejected
    """
    rows = (await db.execute(
        select(Action).where(
            Action.project_id == project_id,
            Action.org_id == user.org_id,
        ).order_by(Action.created_at.desc())
    )).scalars().all()

    columns_def = [
        ("pending",   "Pending Review"),
        ("approved",  "Approved — In Progress"),
        ("completed", "Completed"),
        ("rejected",  "Rejected"),
    ]
    board: List[KanbanColumn] = []
    for col_status, col_label in columns_def:
        col_actions = [ActionRead.model_validate(r) for r in rows if r.status == col_status]
        board.append(KanbanColumn(
            status=col_status,
            label=col_label,
            actions=col_actions,
            count=len(col_actions),
        ))
    return board