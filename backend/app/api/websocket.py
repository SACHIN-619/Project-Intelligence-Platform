"""
app/api/websocket.py
=====================
WebSocket endpoint for real-time job progress.

Frontend connects to:
  ws://localhost:8000/api/v1/ws/{project_id}?token=<jwt>

Server pushes events:
  {"type": "upload_progress",   "pct": 45, "stage": "Embedding documents"}
  {"type": "analysis_complete", "delay_days": 9, "risk_level": "high"}
  {"type": "risk_found",        "task": "Cooling", "severity": "high"}
  {"type": "error",             "message": "..."}

Clients can send:
  {"action": "ping"}   → server replies {"type": "pong"}
"""

from __future__ import annotations

import asyncio
import json
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from loguru import logger

from app.core.security import decode_token

router = APIRouter(tags=["WebSocket"])

# ── Connection manager ────────────────────────────────────────────────────────

class ConnectionManager:
    """
    Manages active WebSocket connections per project.
    Allows broadcasting to all users watching the same project.
    """

    def __init__(self):
        # project_id → set of active WebSocket connections
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, project_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(project_id, set()).add(ws)
        logger.info(f"[WS] Client connected to project {project_id[:8]}. "
                    f"Total: {len(self._connections[project_id])}")

    def disconnect(self, project_id: str, ws: WebSocket) -> None:
        if project_id in self._connections:
            self._connections[project_id].discard(ws)
            if not self._connections[project_id]:
                del self._connections[project_id]

    async def broadcast(self, project_id: str, event: dict) -> None:
        """Send event to all clients watching this project."""
        dead: Set[WebSocket] = set()
        for ws in list(self._connections.get(project_id, [])):
            try:
                await ws.send_json(event)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(project_id, ws)

    async def send_personal(self, ws: WebSocket, event: dict) -> None:
        try:
            await ws.send_json(event)
        except Exception:
            pass


manager = ConnectionManager()


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/{project_id}")
async def project_websocket(
    project_id: str,
    ws: WebSocket,
    token: str = Query(default=""),
):
    """
    Real-time event stream for a project.
    Validates JWT before accepting the connection.
    """
    # Validate token
    payload = decode_token(token) if token else None
    if not payload:
        await ws.close(code=4001, reason="Unauthorized — valid token required")
        return

    await manager.connect(project_id, ws)

    # Send welcome event
    await manager.send_personal(ws, {
        "type": "connected",
        "project_id": project_id,
        "message": "Real-time updates active.",
    })

    try:
        while True:
            # Keep connection alive; handle client messages
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=30)
                msg = json.loads(data)

                if msg.get("action") == "ping":
                    await manager.send_personal(ws, {"type": "pong"})

            except asyncio.TimeoutError:
                # Send heartbeat every 30s
                await manager.send_personal(ws, {"type": "heartbeat"})

    except WebSocketDisconnect:
        manager.disconnect(project_id, ws)
        logger.info(f"[WS] Client disconnected from project {project_id[:8]}")


# ── Helper: broadcast from background jobs ────────────────────────────────────

async def broadcast_event(project_id: str, event_type: str, data: dict) -> None:
    """
    Called from background jobs to push updates to connected clients.

    Example:
        await broadcast_event(project_id, "analysis_complete", {
            "delay_days": 9,
            "risk_level": "high",
            "confidence": 0.81,
        })
    """
    await manager.broadcast(project_id, {"type": event_type, **data})


async def broadcast_progress(
    project_id: str,
    stage: str,
    pct: int,
    detail: str = "",
) -> None:
    """Shortcut for progress update events."""
    await manager.broadcast(project_id, {
        "type": "progress",
        "stage": stage,
        "pct": pct,
        "detail": detail,
    })
