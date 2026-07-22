"""
app/api/deps.py
================
FastAPI dependency injection helpers.

Responsibilities:
  • Extract + validate JWT from request headers
  • Return current authenticated user (or None)
  • Role-permission guards as reusable FastAPI dependencies

create_access_token lives in app.core.security — imported here so
callers only need to import from one place (api.deps).
"""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import decode_token                  # single source of truth
from app.core.security import create_access_token          # re-export for convenience
from app.database import get_db
from app.models.db import User

__all__ = [
    "get_current_user",
    "require_auth",
    "require_permission",
    "create_access_token",      # re-exported so routes don't need to touch security.py
    "CanUpload",
    "CanAnalyse",
    "CanSimulate",
    "CanApprove",
]

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,           # return None instead of 401 when no token
)

# Role → allowed actions mapping
ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin":        {"upload", "analyse", "simulate", "approve", "manage_users", "configure"},
    "manager":      {"upload", "analyse", "simulate", "approve"},
    "engineer":     {"upload", "analyse", "simulate"},
    "quality":      {"upload", "analyse"},
    "procurement":  {"upload", "analyse"},
    "executive":    {"analyse"},
}


# ── Token → User ──────────────────────────────────────────────────────────────

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Decode the JWT and return the matching User row.
    Returns None (not 401) so downstream deps can decide how to handle.
    """
    if not token:
        return None

    payload = decode_token(token)
    if not payload:
        return None

    user_id: str = payload.get("sub", "")
    if not user_id:
        return None

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        return None

    return user


async def require_auth(user: Optional[User] = Depends(get_current_user)) -> User:
    """Raise HTTP 401 if the request is not authenticated."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to perform this action.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_permission(permission: str):
    """
    Factory that returns a FastAPI dependency checking one permission.

    Usage:
        @router.post("/approve")
        async def approve(user: User = Depends(require_permission("approve"))):
            ...
    """
    async def _guard(user: User = Depends(require_auth)) -> User:
        allowed = ROLE_PERMISSIONS.get(user.role, set())
        if permission not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Your role '{user.role}' cannot perform '{permission}'. "
                    "Contact your project admin if you need access."
                ),
            )
        return user
    return _guard


# ── Permission shortcut dependencies ─────────────────────────────────────────
# Use these directly in route signatures:
#   async def my_route(user: User = CanUpload): ...

CanUpload   = Depends(require_permission("upload"))
CanAnalyse  = Depends(require_permission("analyse"))
CanSimulate = Depends(require_permission("simulate"))
CanApprove  = Depends(require_permission("approve"))
