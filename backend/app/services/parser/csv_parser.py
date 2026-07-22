"""
app/services/parser/csv_parser.py
===================================
Resilient CSV / Excel parser.

Principles:
  • Never fail completely — partial success is always better than error.
  • Infer missing fields where possible (end - start → duration).
  • Detect circular dependencies before they reach the graph engine.
  • Return quality score so the UI can show data readiness to the user.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from app.services.parser.schema_mapper import SchemaMapper, SchemaMappingResult


@dataclass
class ParsedTask:
    raw_id: str               # row index or WBS code from upload
    task_name: str
    duration: int
    start_day: Optional[int]
    end_day: Optional[int]
    depends_on: List[str]     # list of raw_ids / names
    status: str
    completion: int           # 0–100
    owner: Optional[str]
    vendor_name: Optional[str]
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedVendor:
    raw_id: str
    vendor_name: str
    equipment_type: Optional[str]
    lead_time_days: Optional[int]
    delivery_status: str
    expected_arrival_day: Optional[int]
    reliability_score: float = 0.8
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParseResult:
    tasks: List[ParsedTask]
    vendors: List[ParsedVendor]
    schema_result: SchemaMappingResult
    quality_score: float          # 0–100
    row_count: int
    warnings: List[str]
    errors: List[str]             # non-fatal issues fixed automatically
    file_type: str                # csv | xlsx


# ── Status normalisation ──────────────────────────────────────────────────────
STATUS_MAP: Dict[str, str] = {
    "done": "completed", "complete": "completed", "finished": "completed",
    "completed": "completed", "100%": "completed",
    "in progress": "running", "in_progress": "running", "started": "running",
    "wip": "running", "active": "running", "running": "running",
    "delayed": "delayed", "late": "delayed", "behind": "delayed",
    "not started": "pending", "not_started": "pending", "pending": "pending",
    "planned": "pending", "future": "pending",
}


def _normalise_status(raw: Any) -> str:
    if pd.isna(raw) or raw is None:
        return "pending"
    return STATUS_MAP.get(str(raw).lower().strip(), "pending")


def _parse_int(val: Any, default: int = 0) -> int:
    try:
        return max(0, int(float(str(val).replace("%", "").strip())))
    except (ValueError, TypeError):
        return default


def _parse_dependencies(raw: Any) -> List[str]:
    """Parse dependency cell: comma/semicolon/pipe separated IDs or names."""
    if pd.isna(raw) or not raw:
        return []
    s = str(raw).strip()
    if not s or s.lower() in ("-", "none", "n/a", "na"):
        return []
    parts = re.split(r"[,;|]+", s)
    return [p.strip() for p in parts if p.strip()]


def _infer_duration(row: Dict[str, Any], warnings: List[str]) -> int:
    """
    Infer duration if not directly provided:
      duration = end_day - start_day
    Falls back to default 1 day with a warning.
    """
    if "duration" in row and row["duration"] is not None:
        return _parse_int(row["duration"], default=1)
    if "end_day" in row and "start_day" in row:
        try:
            diff = int(row["end_day"]) - int(row["start_day"])
            if diff > 0:
                return diff
        except (TypeError, ValueError):
            pass
    warnings.append("Duration missing for some tasks — defaulted to 1 day.")
    return 1


class ScheduleParser:
    """
    Parses uploaded schedule files (CSV or Excel) into structured task/vendor lists.

    Usage:
        parser = ScheduleParser()
        result = parser.parse(file_bytes, "schedule.csv")
    """

    def __init__(self, mapper: Optional[SchemaMapper] = None):
        self.mapper = mapper or SchemaMapper()

    # ── File reading ──────────────────────────────────────────────────────────

    def _read_dataframe(self, content: bytes, filename: str) -> Tuple[pd.DataFrame, str]:
        """Read raw bytes into a DataFrame. Returns (df, file_type)."""
        name = filename.lower()
        if name.endswith(".csv"):
            for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
                try:
                    df = pd.read_csv(io.BytesIO(content), encoding=enc, dtype=str)
                    return df, "csv"
                except Exception:
                    continue
            raise ValueError("Could not decode CSV — try saving as UTF-8.")
        elif name.endswith((".xlsx", ".xls", ".xlsm")):
            df = pd.read_excel(io.BytesIO(content), dtype=str)
            return df, "xlsx"
        else:
            raise ValueError(f"Unsupported file type: {filename}")

    # ── Column mapping ────────────────────────────────────────────────────────

    def _apply_mapping(
        self, df: pd.DataFrame, schema_result: SchemaMappingResult
    ) -> pd.DataFrame:
        """Rename dataframe columns to canonical names."""
        rename_map: Dict[str, str] = {}
        for mf in schema_result.mappings:
            if mf.canonical:
                rename_map[mf.original] = mf.canonical
        return df.rename(columns=rename_map)

    # ── Row → ParsedTask ──────────────────────────────────────────────────────

    def _row_to_task(
        self, idx: int, row: Dict[str, Any], warnings: List[str]
    ) -> Optional[ParsedTask]:
        name = str(row.get("task_name", "")).strip()
        if not name or name.lower() in ("nan", "none", ""):
            return None

        raw_id = str(row.get("raw_id", idx))
        duration = _infer_duration(row, warnings)
        start_day = _parse_int(row.get("start_day"), default=None)  # type: ignore
        end_day = _parse_int(row.get("end_day"), default=None)      # type: ignore
        depends_on = _parse_dependencies(row.get("dependency"))
        status = _normalise_status(row.get("status"))
        completion = _parse_int(row.get("completion"), default=0)
        completion = min(100, max(0, completion))

        # Preserve unknown columns in extra
        known = {
            "task_name", "duration", "start_day", "end_day", "dependency",
            "status", "completion", "owner", "vendor_name", "raw_id",
        }
        extra = {k: v for k, v in row.items() if k not in known and not pd.isna(v)}

        return ParsedTask(
            raw_id=raw_id,
            task_name=name,
            duration=duration,
            start_day=start_day if start_day else None,
            end_day=end_day if end_day else None,
            depends_on=depends_on,
            status=status,
            completion=completion,
            owner=str(row.get("owner", "")).strip() or None,
            vendor_name=str(row.get("vendor_name", "")).strip() or None,
            extra=extra,
        )

    # ── Vendor detection ──────────────────────────────────────────────────────

    def _detect_vendor_columns(self, df: pd.DataFrame) -> bool:
        """Does this dataframe look like a vendor/procurement sheet?"""
        vendor_signals = {"vendor_name", "vendor", "supplier", "lead_time", "equipment_type"}
        cols_lower = {c.lower() for c in df.columns}
        return len(vendor_signals & cols_lower) >= 2

    def _row_to_vendor(self, idx: int, row: Dict[str, Any]) -> Optional[ParsedVendor]:
        name = str(row.get("vendor_name", "")).strip()
        if not name or name.lower() in ("nan", "none", ""):
            return None
        extra = {k: v for k, v in row.items() if not pd.isna(v)}
        return ParsedVendor(
            raw_id=str(idx),
            vendor_name=name,
            equipment_type=str(row.get("equipment_type", "")).strip() or None,
            lead_time_days=_parse_int(row.get("lead_time"), default=None),  # type: ignore
            delivery_status=_normalise_status(row.get("delivery_status")),
            expected_arrival_day=_parse_int(row.get("expected_arrival"), default=None),  # type: ignore
            extra=extra,
        )

    # ── Circular dependency check ──────────────────────────────────────────────

    def _check_cycles(self, tasks: List[ParsedTask]) -> List[str]:
        """Basic cycle detection before graph build. Returns warning messages."""
        name_to_id = {t.task_name: t.raw_id for t in tasks}
        adj: Dict[str, List[str]] = {t.raw_id: [] for t in tasks}
        for t in tasks:
            for dep in t.depends_on:
                dep_id = name_to_id.get(dep, dep)
                if dep_id in adj:
                    adj[t.raw_id].append(dep_id)

        visited: set = set()
        rec_stack: set = set()
        cycles: List[str] = []

        def dfs(node: str) -> bool:
            visited.add(node)
            rec_stack.add(node)
            for neighbour in adj.get(node, []):
                if neighbour not in visited:
                    if dfs(neighbour):
                        return True
                elif neighbour in rec_stack:
                    cycles.append(f"Circular dependency detected involving '{node}'")
                    return True
            rec_stack.discard(node)
            return False

        for node in adj:
            if node not in visited:
                dfs(node)

        return cycles

    # ── Quality scoring ───────────────────────────────────────────────────────

    def _quality_score(
        self,
        tasks: List[ParsedTask],
        schema_result: SchemaMappingResult,
        warnings: List[str],
    ) -> float:
        if not tasks:
            return 0.0
        schema_quality = schema_result.quality_score                    # 0–100
        has_deps = sum(1 for t in tasks if t.depends_on) / max(len(tasks), 1)
        has_status = sum(1 for t in tasks if t.status != "pending") / max(len(tasks), 1)
        warning_penalty = min(20, len(warnings) * 3)
        base = schema_quality * 0.5 + has_deps * 20 + has_status * 10
        return max(0.0, min(100.0, base - warning_penalty))

    # ── Main parse ────────────────────────────────────────────────────────────

    def parse(self, content: bytes, filename: str) -> ParseResult:
        warnings: List[str] = []
        errors: List[str] = []
        tasks: List[ParsedTask] = []
        vendors: List[ParsedVendor] = []

        try:
            df, file_type = self._read_dataframe(content, filename)
        except ValueError as e:
            return ParseResult([], [], SchemaMappingResult([], 0.0, 0, [], []), 0.0, 0, [], [str(e)], "unknown")

        df = df.dropna(how="all").reset_index(drop=True)
        if df.empty:
            return ParseResult([], [], SchemaMappingResult([], 0.0, 0, [], []), 0.0, 0, ["File is empty"], [], file_type)

        # Schema mapping
        schema_result = self.mapper.map(list(df.columns))
        df_mapped = self._apply_mapping(df, schema_result)

        is_vendor_sheet = self._detect_vendor_columns(df)

        for idx, row in df_mapped.iterrows():
            row_dict = row.to_dict()
            row_dict["raw_id"] = str(idx)

            if is_vendor_sheet:
                vendor = self._row_to_vendor(idx, row_dict)
                if vendor:
                    vendors.append(vendor)
            else:
                task = self._row_to_task(idx, row_dict, warnings)
                if task:
                    tasks.append(task)

        if unmapped := schema_result.unmapped_columns:
            warnings.append(f"Unmapped columns (kept as extra data): {', '.join(unmapped)}")

        cycle_warnings = self._check_cycles(tasks)
        warnings.extend(cycle_warnings)

        quality = self._quality_score(tasks, schema_result, warnings)

        return ParseResult(
            tasks=tasks,
            vendors=vendors,
            schema_result=schema_result,
            quality_score=quality,
            row_count=len(df),
            warnings=warnings,
            errors=errors,
            file_type=file_type,
        )
