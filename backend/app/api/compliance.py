"""
app/api/compliance.py
======================
Router for quality and tier compliance checker.
Retrieves parsed document text chunks and runs TIA-942 compliance audits.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Tuple

from app.api.deps import get_db, require_auth
from app.models.db import DocumentChunk, User
from app.services.intelligence import SpecificationAgent

router = APIRouter(prefix="/compliance", tags=["Compliance"])


@router.get("/check/{project_id}")
async def check_compliance(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """
    Query all DocumentChunks for the project, reconstruct text by document,
    and evaluate against TIA-942 / Uptime Tier III standards.
    """
    stmt = select(DocumentChunk).where(
        DocumentChunk.project_id == project_id,
        DocumentChunk.org_id == user.org_id
    ).order_by(DocumentChunk.source_file, DocumentChunk.chunk_index)
    
    chunks = (await db.execute(stmt)).scalars().all()
    if not chunks:
        return {
            "compliant": True,
            "compliance_score": 100.0,
            "ncrs": [],
            "parameters_checked": 0,
            "parameters_passed": 0,
            "tier_compliance": {
                "TIA-942-B": True,
                "Uptime-Tier-III": True,
                "ASHRAE-A1": True
            },
            "summary": "No documents found to perform compliance validation on. Upload specification sheets to test."
        }

    # Group chunks by source filename
    docs: Dict[str, List[str]] = {}
    for c in chunks:
        source = c.source_file or "Document"
        docs.setdefault(source, []).append(c.content)
        
    doc_texts: List[Tuple[str, str]] = []
    for source, parts in docs.items():
        doc_texts.append(("\n".join(parts), source))

    # Evaluate compliance
    agent = SpecificationAgent()
    results = agent.check_multiple(doc_texts)

    # Aggregate compliance records
    all_ncrs: List[Dict[str, Any]] = []
    total_checked = 0
    total_passed = 0
    compliance_scores = []
    
    tier_compliance = {
        "TIA-942-B": True,
        "Uptime-Tier-III": True,
        "ASHRAE-A1": True
    }

    for res in results:
        total_checked += res.parameters_checked
        total_passed += res.parameters_passed
        compliance_scores.append(res.compliance_score)
        
        # Overall compliance fails if any sub-document is non-compliant
        for k, v in res.tier_compliance.items():
            if not v:
                tier_compliance[k] = False

        for ncr in res.ncrs:
            all_ncrs.append({
                "ncr_id": ncr.ncr_id,
                "parameter": ncr.parameter,
                "specified_value": ncr.specified_value,
                "actual_value": ncr.actual_value,
                "deviation_pct": ncr.deviation_pct,
                "severity": ncr.severity.value,
                "description": ncr.description,
                "source_document": ncr.source_document,
                "affected_task": ncr.affected_task,
                "recommendation": ncr.recommendation
            })

    avg_score = sum(compliance_scores) / len(compliance_scores) if compliance_scores else 100.0
    compliant = all(res.compliant for res in results) if results else True

    if total_checked == 0:
        avg_score = 100.0

    return {
        "compliant": compliant,
        "compliance_score": round(avg_score, 1),
        "ncrs": all_ncrs,
        "parameters_checked": total_checked,
        "parameters_passed": total_passed,
        "tier_compliance": tier_compliance,
        "summary": f"Compliance checks completed across {len(results)} source document(s). Found {len(all_ncrs)} non-conformance(s)."
    }
