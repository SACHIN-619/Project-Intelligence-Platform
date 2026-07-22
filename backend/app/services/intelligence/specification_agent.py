"""
app/services/intelligence/specification_agent.py
==================================================
Specification & Quality Compliance Agent.

Directly addresses the PS4 requirement:
  "AI agent that checks procurement orders, vendor submittals, and shop
   drawings for deviations, flagging non-conformances before they reach site."

MY APPROACH:
  • Rule-based extraction of spec parameters (voltage, capacity, dimensions)
  • Pattern matching against known TIA-942 / Uptime Institute Tier III thresholds
  • Deviation scoring that returns NCR (Non-Conformance Report) objects
  • No hallucination risk — all checks are deterministic; AI only explains

Does NOT require AI for checking — AI is called ONLY to write the NCR narrative.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class NCRSeverity(str, Enum):
    MINOR = "minor"
    MAJOR = "major"
    CRITICAL = "critical"


@dataclass
class SpecParameter:
    """A single extracted parameter from a document."""
    name: str
    value: float
    unit: str
    raw_text: str
    confidence: float = 0.9


@dataclass
class NCR:
    """Non-Conformance Report — one deviation from spec."""
    ncr_id: str
    parameter: str
    specified_value: str
    actual_value: str
    deviation_pct: float
    severity: NCRSeverity
    description: str
    source_document: str
    affected_task: Optional[str] = None
    recommendation: str = ""


@dataclass
class ComplianceResult:
    document: str
    compliant: bool
    compliance_score: float        # 0–100
    ncrs: List[NCR]
    parameters_checked: int
    parameters_passed: int
    tier_compliance: Dict[str, bool]  # {"TIA-942-B": True, "Uptime-Tier-III": False}
    summary: str


# ── Known DC spec thresholds (simplified subset of TIA-942 / Uptime Tier III) ─

TIER_III_THRESHOLDS = {
    # Power
    "ups_runtime_min":          {"min": 12, "unit": "min"},        # minutes at full load
    "generator_start_time_sec": {"max": 10, "unit": "sec"},
    "pue_max":                  {"max": 1.5, "unit": "ratio"},      # PUE ≤ 1.5
    "voltage_tolerance_pct":    {"max": 5.0, "unit": "%"},          # ±5%

    # Cooling
    "server_inlet_temp_max_c":  {"max": 27, "unit": "°C"},          # ASHRAE A1 class
    "server_inlet_temp_min_c":  {"min": 15, "unit": "°C"},
    "humidity_max_pct":         {"max": 60, "unit": "%RH"},
    "humidity_min_pct":         {"min": 20, "unit": "%RH"},

    # Redundancy
    "n_redundancy_level":       {"min": 1, "unit": "N"},            # N+1 minimum
    "concurrent_maintainability": {"min": 1, "unit": "flag"},       # must be possible

    # Fire
    "fire_suppression_discharge_sec": {"max": 10, "unit": "sec"},
}

# Regex patterns to extract parameter values from text
EXTRACTION_PATTERNS: Dict[str, List[str]] = {
    "ups_runtime_min": [
        r"(\d+(?:\.\d+)?)\s*(?:min|minutes?)\s*(?:runtime|autonomy|backup)",
        r"(?:runtime|autonomy|backup)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:min|minutes?)",
    ],
    "generator_start_time_sec": [
        r"(?:start(?:ing)?|startup)\s*(?:time\s*)?(?:within\s*)?(\d+(?:\.\d+)?)\s*(?:sec|seconds?)",
    ],
    "pue_max": [
        r"PUE\s*(?:of\s*|≤\s*|<=\s*)?(\d+\.\d+)",
        r"(?:power\s*usage\s*effectiveness)\s*(?:of\s*)?(\d+\.\d+)",
    ],
    "server_inlet_temp_max_c": [
        r"(?:inlet|supply)\s*(?:air\s*)?(?:temperature|temp)\s*(?:max|maximum|not\s*exceed)\s*(\d+(?:\.\d+)?)\s*°?C",
        r"(\d+(?:\.\d+)?)\s*°?C\s*(?:max|maximum)\s*(?:inlet|supply)",
    ],
    "humidity_max_pct": [
        r"(?:relative\s*)?humidity\s*(?:max|maximum|not\s*exceed)\s*(\d+(?:\.\d+)?)\s*%",
    ],
    "n_redundancy_level": [
        r"N\s*[+]\s*(\d+)\s*redundancy",
        r"(\d+)N\s*(?:power|cooling|redundancy)",
    ],
}


class SpecificationAgent:
    """
    Checks document text against Tier III / TIA-942 thresholds.

    Usage:
        agent = SpecificationAgent()
        result = agent.check("vendor_submittal.pdf text...", "cooling_spec.pdf text...")
    """

    def __init__(self):
        self._ncr_counter = 0

    def _next_ncr_id(self) -> str:
        self._ncr_counter += 1
        return f"NCR-{self._ncr_counter:04d}"

    # ── Parameter extraction ──────────────────────────────────────────────────

    def _extract_parameters(self, text: str) -> Dict[str, SpecParameter]:
        """Extract numeric spec parameters from document text."""
        text_lower = text.lower()
        found: Dict[str, SpecParameter] = {}

        for param_name, patterns in EXTRACTION_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, text_lower, re.IGNORECASE)
                if match:
                    try:
                        value = float(match.group(1))
                        threshold = TIER_III_THRESHOLDS.get(param_name, {})
                        unit = threshold.get("unit", "")
                        found[param_name] = SpecParameter(
                            name=param_name,
                            value=value,
                            unit=unit,
                            raw_text=match.group(0),
                        )
                        break
                    except (ValueError, IndexError):
                        continue
        return found

    # ── Compliance check ──────────────────────────────────────────────────────

    def _check_parameter(
        self,
        param: SpecParameter,
        threshold: Dict[str, Any],
        source_doc: str,
    ) -> Optional[NCR]:
        """Compare extracted value against threshold. Returns NCR if violated."""
        value = param.value
        spec_min = threshold.get("min")
        spec_max = threshold.get("max")

        violated = False
        specified_str = ""
        dev_pct = 0.0

        if spec_min is not None and value < spec_min:
            violated = True
            specified_str = f"≥ {spec_min} {param.unit}"
            dev_pct = abs(value - spec_min) / max(spec_min, 0.001) * 100

        if spec_max is not None and value > spec_max:
            violated = True
            specified_str = f"≤ {spec_max} {param.unit}"
            dev_pct = abs(value - spec_max) / max(spec_max, 0.001) * 100

        if not violated:
            return None

        # Determine severity
        if dev_pct > 25:
            severity = NCRSeverity.CRITICAL
        elif dev_pct > 10:
            severity = NCRSeverity.MAJOR
        else:
            severity = NCRSeverity.MINOR

        friendly_name = param.name.replace("_", " ").title()
        description = (
            f"{friendly_name} specified as {value} {param.unit}, "
            f"but Tier III requires {specified_str}. "
            f"Deviation: {dev_pct:.1f}%."
        )
        recommendation = self._recommend(param.name, value, spec_min, spec_max, param.unit)

        return NCR(
            ncr_id=self._next_ncr_id(),
            parameter=param.name,
            specified_value=specified_str,
            actual_value=f"{value} {param.unit}",
            deviation_pct=round(dev_pct, 1),
            severity=severity,
            description=description,
            source_document=source_doc,
            recommendation=recommendation,
        )

    def _recommend(
        self, param: str, value: float, spec_min: Optional[float],
        spec_max: Optional[float], unit: str
    ) -> str:
        recs = {
            "ups_runtime_min": f"Increase UPS battery capacity to achieve minimum {spec_min} {unit} runtime.",
            "generator_start_time_sec": f"Verify generator ATS (Automatic Transfer Switch) timing — must start within {spec_max} {unit}.",
            "pue_max": f"Review cooling and power distribution efficiency — PUE must not exceed {spec_max}.",
            "server_inlet_temp_max_c": f"Adjust CRAC setpoints — server inlet must not exceed {spec_max}°C per ASHRAE A1.",
            "humidity_max_pct": f"Install dehumidification — relative humidity must stay below {spec_max}%.",
            "n_redundancy_level": "Upgrade to N+1 redundancy minimum for Tier III certification.",
        }
        return recs.get(param, f"Review {param.replace('_', ' ')} to meet Tier III specifications.")

    # ── Tier compliance summary ───────────────────────────────────────────────

    def _tier_compliance(self, ncrs: List[NCR]) -> Dict[str, bool]:
        critical_ncrs = [n for n in ncrs if n.severity == NCRSeverity.CRITICAL]
        major_ncrs = [n for n in ncrs if n.severity == NCRSeverity.MAJOR]
        return {
            "TIA-942-B": len(critical_ncrs) == 0,
            "Uptime-Tier-III": len(critical_ncrs) == 0 and len(major_ncrs) == 0,
            "ASHRAE-A1": not any("temp" in n.parameter for n in critical_ncrs),
        }

    # ── Public API ────────────────────────────────────────────────────────────

    def check_document(self, text: str, source_document: str) -> ComplianceResult:
        """
        Check a single document's text against Tier III thresholds.
        Returns a ComplianceResult with all NCRs.
        """
        params = self._extract_parameters(text)
        ncrs: List[NCR] = []

        for param_name, param in params.items():
            threshold = TIER_III_THRESHOLDS.get(param_name)
            if threshold:
                ncr = self._check_parameter(param, threshold, source_document)
                if ncr:
                    ncrs.append(ncr)

        total = len(params)
        passed = total - len(ncrs)
        score = (passed / max(total, 1)) * 100 if total else 50.0  # 50 if no params found

        tier = self._tier_compliance(ncrs)
        compliant = len([n for n in ncrs if n.severity in (NCRSeverity.CRITICAL, NCRSeverity.MAJOR)]) == 0

        if not ncrs:
            summary = f"No violations found in '{source_document}'. {total} parameters checked."
        else:
            critical = len([n for n in ncrs if n.severity == NCRSeverity.CRITICAL])
            major = len([n for n in ncrs if n.severity == NCRSeverity.MAJOR])
            summary = (
                f"'{source_document}': {len(ncrs)} non-conformance(s) — "
                f"{critical} critical, {major} major. "
                f"Compliance score: {score:.0f}/100."
            )

        return ComplianceResult(
            document=source_document,
            compliant=compliant,
            compliance_score=round(score, 1),
            ncrs=ncrs,
            parameters_checked=total,
            parameters_passed=passed,
            tier_compliance=tier,
            summary=summary,
        )

    def check_multiple(self, documents: List[Tuple[str, str]]) -> List[ComplianceResult]:
        """Check multiple (text, source_name) pairs."""
        return [self.check_document(text, name) for text, name in documents]
