"""
backend/app/config.py
======================
Centralised configuration for Project Impact Intelligence.
All values come from environment variables with sensible defaults.

CORRECTED: app_version and storage_local_path were dropped/renamed in a
prior revision — both are used elsewhere in the codebase (main.py,
project.py) and have been restored under their original names.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    app_name: str = "Project Impact Intelligence"
    app_version: str = "1.0.0"                 # RESTORED — used in main.py
    environment: str = "development"
    debug: bool = True
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # ── Database (High-Traffic Config) ────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/pii"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # ── Redis (optional — falls back to in-process queue) ────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Auth ──────────────────────────────────────────────────────────────────
    secret_key: str = "changeme-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440   # 24 hours
    refresh_token_expire_days: int = 7

    # ── Storage (Enterprise S3 + Local Fallback) ──────────────────────────────
    storage_backend: str = "local"
    storage_local_path: str = "uploads"        # RESTORED name (was upload_dir)
    max_upload_size_mb: int = 50
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_bucket_name: Optional[str] = None
    aws_endpoint_url: Optional[str] = None

    # ── AI — Layer 1: Gemini (primary) ───────────────────────────────────────
    gemini_api_key: Optional[str] = None
    gemini_max_tokens: int = 2048
    gemini_temperature: float = 0.2

    # ── AI — Layer 2: Groq (fallback, optional but recommended) ─────────────
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.3-70b-versatile"

    # ── AI — Layer 3: Graceful degradation is built-in, no config needed ────

    # ── Embeddings (local BGE model — no API key required) ───────────────────
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_batch_size: int = 32
    ai_cache_ttl_seconds: int = 3600

    # ── Risk thresholds (adjustable without code change) ──────────────────────
    risk_threshold_low: float = 3.0
    risk_threshold_medium: float = 6.0
    risk_threshold_high: float = 9.0
    recovery_min_benefit_days: int = 1

    # ── Feature flags (toggle from env or admin panel) ────────────────────────
    feature_monte_carlo_enabled: bool = True
    feature_rag_enabled: bool = True
    feature_pdf_export_enabled: bool = True
    feature_weather_agent_enabled: bool = True
    feature_vendor_scoring_enabled: bool = True
    feature_ai_memory_enabled: bool = True

    # ── Monte Carlo ───────────────────────────────────────────────────────────
    mc_n_simulations: int = 1000
    mc_optimistic_factor: float = 0.8
    mc_pessimistic_factor: float = 1.5

    # ── Project health scoring weights (Phase 9 Engine) ───────────────────────
    health_weight_schedule: float = 0.40
    health_weight_quality: float = 0.25
    health_weight_procurement: float = 0.20
    health_weight_resource: float = 0.15

    # ── Geolocation defaults (used by weather agent) ──────────────────────────
    default_site_latitude: float = 12.9716    # Bangalore
    default_site_longitude: float = 77.5946


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton — call once, reuse everywhere efficiently."""
    return Settings()


settings = get_settings()