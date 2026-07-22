"""
backend/app/services/report/generator.py
==================================
Generates a downloadable PDF project intelligence report.
Uses ReportLab for PDF creation (no browser/headless Chrome needed).

ENHANCEMENTS from 30-phase discussion:
  Phase 9  — Project Health section with schedule/risk/procurement breakdown
  Phase 3  — Vendor Reliability section (cross-project scoring)
  Phase 25 — AI narrative now uses 3-layer gemini.generate_report_narrative()
"""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


def generate_report(
    project: Dict[str, Any],
    risks: List[Dict],
    scenarios: List[Dict],
    graph_result: Optional[Dict] = None,
    mc_result: Optional[Dict] = None,
    ai_narrative: str = "",
    health_score: Optional[Dict] = None,        # NEW — Phase 9
    vendor_scores: Optional[List[Dict]] = None,  # NEW — Phase 3
    output_dir: str = "/tmp/pii_uploads",
) -> str:
    """
    Build a PDF report and return the file path.

    Args:
        project:        Project metadata dict
        risks:          List of risk dicts
        scenarios:      List of scenario dicts
        graph_result:   Graph analysis result dict
        mc_result:      Monte Carlo result dict
        ai_narrative:   LLM-generated narrative text (from gemini.generate_report_narrative)
        health_score:   ProjectHealthScore dict {overall_score, health_level, ...}
        vendor_scores:  List of vendor reliability dicts (worst first)
        output_dir:     Where to write the PDF

    Returns:
        Absolute path to the generated PDF.
    """
    try:
        return _generate_reportlab(
            project, risks, scenarios, graph_result, mc_result,
            ai_narrative, health_score, vendor_scores, output_dir
        )
    except ImportError:
        return _generate_plain_text(
            project, risks, scenarios, health_score, vendor_scores, output_dir
        )


def _generate_reportlab(
    project, risks, scenarios, graph_result, mc_result,
    ai_narrative, health_score, vendor_scores, output_dir
) -> str:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )

    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"report_{project.get('id','unknown')}_{timestamp}.pdf"
    filepath = str(Path(output_dir) / filename)

    doc = SimpleDocTemplate(filepath, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle", parent=styles["Title"],
        fontSize=18, textColor=colors.HexColor("#1a1a2e"), spaceAfter=6,
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Heading2"],
        fontSize=13, textColor=colors.HexColor("#16213e"), spaceBefore=14, spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=10, leading=14, textColor=colors.HexColor("#333333"),
    )
    caption_style = ParagraphStyle(
        "Caption", parent=styles["Normal"],
        fontSize=8, textColor=colors.grey,
    )

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph(f"Project Intelligence Report", title_style))
    story.append(Paragraph(f"{project.get('name', 'Unknown Project')}", styles["Heading1"]))
    story.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%d %B %Y, %H:%M UTC')} | "
        f"Confidence: {project.get('confidence_score', 0):.0%}",
        caption_style,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 10))

    # ── Executive Summary (AI-generated via 3-layer Gemini/Groq) ───────────────
    story.append(Paragraph("Executive Summary", section_style))
    if ai_narrative:
        for para in ai_narrative.split("\n\n"):
            if para.strip():
                story.append(Paragraph(para.strip(), body_style))
                story.append(Spacer(1, 6))
    else:
        delay = project.get("delay_days", 0)
        summary = (
            f"This project is currently at {project.get('completion_pct', 0)}% completion "
            f"with a predicted delay of {delay} day(s). "
            f"Risk level: {project.get('risk_level', 'unknown').upper()}. "
            f"{len(risks)} risk(s) identified, {len(scenarios)} recovery scenario(s) evaluated."
        )
        story.append(Paragraph(summary, body_style))
    story.append(Spacer(1, 10))

    # ── Project Health Breakdown (Phase 9) ─────────────────────────────────
    if health_score:
        story.append(Paragraph("Project Health Breakdown", section_style))
        story.append(Paragraph(
            f"Overall Health Score: <b>{health_score.get('overall_score', 0):.0f}/100</b> "
            f"({health_score.get('health_level', 'unknown').replace('_', ' ').upper()})",
            body_style,
        ))
        story.append(Spacer(1, 4))

        health_data = [
            ["Dimension", "Score", "Weight"],
            ["Schedule Health", f"{health_score.get('schedule_score', 0):.0f}/100", "40%"],
            ["Risk Health", f"{health_score.get('risk_score', 0):.0f}/100", "30%"],
            ["Procurement Health", f"{health_score.get('procurement_score', 0):.0f}/100", "20%"],
            ["Forecast Confidence", f"{health_score.get('confidence_score', 0):.0f}/100", "10%"],
        ]
        health_table = Table(health_data, colWidths=[7*cm, 4*cm, 3*cm])
        health_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4361ee")),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f2ff")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING",  (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(health_table)
        if health_score.get("summary"):
            story.append(Spacer(1, 6))
            story.append(Paragraph(health_score["summary"], body_style))
        story.append(Spacer(1, 12))

    # ── Key Metrics ───────────────────────────────────────────────────────────
    story.append(Paragraph("Key Metrics", section_style))
    kpi_data = [
        ["Metric", "Value"],
        ["Completion", f"{project.get('completion_pct', 0)}%"],
        ["Predicted Delay", f"{project.get('delay_days', 0)} day(s)"],
        ["Risk Level", project.get("risk_level", "—").upper()],
        ["Confidence", f"{project.get('confidence_score', 0):.0%}"],
        ["Active Risks", str(len(risks))],
        ["Recovery Scenarios", str(len(scenarios))],
    ]
    if mc_result:
        kpi_data += [
            ["P80 Completion", f"Day {mc_result.get('p80','—')}"],
            ["On-Time Probability", f"{mc_result.get('on_time_probability', 0):.0%}"],
        ]

    kpi_table = Table(kpi_data, colWidths=[8*cm, 8*cm])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#16213e")),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, 0), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("FONTSIZE",   (0, 1), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 12))

    # ── Risk Register ─────────────────────────────────────────────────────────
    if risks:
        story.append(Paragraph("Risk Register", section_style))
        risk_data = [["Task / Area", "Type", "Severity", "Probability", "Impact (Days)", "Score"]]
        for r in risks[:10]:
            sev = r.get("severity", "?").upper()
            risk_data.append([
                r.get("task_name") or r.get("risk_type", "—"),
                r.get("risk_type", "—"),
                sev,
                f"{r.get('probability', 0):.0%}",
                str(r.get("impact_days", 0)),
                f"{r.get('risk_score', 0):.1f}",
            ])
        risk_table = Table(risk_data, colWidths=[4*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2*cm])
        risk_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e63946")),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff5f5")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ]))
        story.append(risk_table)
        story.append(Spacer(1, 12))

    # ── Vendor Reliability Section (Phase 3) ───────────────────────────────
    if vendor_scores:
        story.append(Paragraph("Vendor Reliability Analysis", section_style))
        story.append(Paragraph(
            "Cross-project delivery performance for vendors on this project. "
            "Vendors with low reliability scores receive automatic risk score adjustments.",
            body_style,
        ))
        story.append(Spacer(1, 4))

        vendor_data = [["Vendor", "On-Time %", "Avg Delay (Days)", "Risk Level"]]
        for v in vendor_scores[:8]:
            vendor_data.append([
                v.get("vendor_name", "—"),
                f"{v.get('reliability_score', 0):.0f}%",
                f"{v.get('avg_delay_days', 0):.1f}",
                v.get("risk_level", "—").upper(),
            ])
        vendor_table = Table(vendor_data, colWidths=[6*cm, 3*cm, 4*cm, 3*cm])
        vendor_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f77f00")),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff8f0")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ]))
        story.append(vendor_table)
        story.append(Spacer(1, 12))

    # ── Recovery Scenarios ────────────────────────────────────────────────────
    if scenarios:
        story.append(Paragraph("Recovery Scenarios Evaluated", section_style))
        sc_data = [["Action", "Days Saved", "Cost", "Confidence", "Feasibility", "Status"]]
        for s in scenarios:
            sc_data.append([
                s.get("title", s.get("action_type", "—"))[:35],
                f"+{s.get('days_saved', 0)}",
                s.get("cost_level", "—").capitalize(),
                f"{s.get('confidence', 0):.0%}",
                f"{s.get('feasibility_score', 0):.0%}",
                s.get("status", "draft").capitalize(),
            ])
        sc_table = Table(sc_data, colWidths=[5*cm, 2*cm, 2*cm, 2.5*cm, 2.5*cm, 2*cm])
        sc_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2a9d8f")),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0faf9")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ]))
        story.append(sc_table)
        story.append(Spacer(1, 12))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Generated by Project Impact Intelligence | Confidential | Not for distribution",
        caption_style,
    ))

    doc.build(story)
    return filepath


def _generate_plain_text(
    project, risks, scenarios, health_score, vendor_scores, output_dir
) -> str:
    """Minimal text report fallback when ReportLab is unavailable."""
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"report_{project.get('id','unknown')}_{timestamp}.txt"
    filepath = str(Path(output_dir) / filename)

    lines = [
        "PROJECT IMPACT INTELLIGENCE REPORT",
        "=" * 50,
        f"Project: {project.get('name', 'Unknown')}",
        f"Generated: {datetime.utcnow().isoformat()}",
        f"Delay: {project.get('delay_days', 0)} days",
        f"Risk Level: {project.get('risk_level', '?').upper()}",
        "",
    ]

    if health_score:
        lines += [
            "PROJECT HEALTH BREAKDOWN:",
            f"  Overall Score: {health_score.get('overall_score', 0):.0f}/100 ({health_score.get('health_level', 'unknown').upper()})",
            f"  - Schedule Health: {health_score.get('schedule_score', 0):.0f}/100",
            f"  - Risk Health: {health_score.get('risk_score', 0):.0f}/100",
            f"  - Procurement Health: {health_score.get('procurement_score', 0):.0f}/100",
            "",
        ]

    lines += [
        "RISKS:",
        *[f"  - {r.get('task_name','?') or r.get('risk_type','?')}: {r.get('severity','?')} ({r.get('impact_days',0)} days)" for r in risks[:10]],
        "",
    ]

    if vendor_scores:
        lines += [
            "VENDOR RELIABILITY ANALYSIS:",
            *[f"  - {v.get('vendor_name','?')}: On-Time {v.get('reliability_score',0):.0f}%, Avg Delay {v.get('avg_delay_days',0):.1f} days" for v in vendor_scores[:8]],
            "",
        ]

    lines += [
        "RECOVERY SCENARIOS:",
        *[f"  - {s.get('title','?')}: saves {s.get('days_saved',0)} days" for s in scenarios],
    ]

    with open(filepath, "w") as f:
        f.write("\n".join(lines))
    return filepath