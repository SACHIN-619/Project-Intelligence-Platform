"""
app/services/queue/jobs.py
============================
Background job definitions — wired to WebSocket for real-time progress.

Job chain per upload:
  job_process_upload  →  parse + embed + store chunks + tasks + vendors
  job_run_analysis    →  graph CPM + risks + Monte Carlo + weather + vendor score
                         + project health score → broadcast analysis_complete

Changes from original:
  ✅ tasks_analysed added to analysis_complete broadcast (fixes CompleteCard)
  ✅ weather_agent wired when feature_weather_agent_enabled = True
  ✅ vendor_scorer wired when feature_vendor_scoring_enabled = True
  ✅ project_health score calculated and saved
  ✅ AI memory event emitted after analysis
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from app.config import settings


# ── Progress broadcast helper ─────────────────────────────────────────────────

async def _broadcast(project_id: str, stage: str, pct: int, detail: str = "") -> None:
    try:
        from app.api.websocket import broadcast_progress
        await broadcast_progress(project_id, stage, pct, detail)
    except Exception:
        pass


# ── JOB 1: process_upload ─────────────────────────────────────────────────────

async def job_process_upload(
    ctx: Dict,
    upload_id: str,
    project_id: str,
    org_id: str,
    file_path: str,
    filename: str,
):
    """
    Full ingestion pipeline:
      1. Read file
      2. Map schema
      3. Parse tasks / vendors / text chunks
      4. Embed chunks → store in DocumentChunk with pgvector
      5. Persist SchemaMappingMemory
      6. Trigger analysis job
    """
    from app.database import get_db_context
    from app.models.db import Upload, Task, Vendor, DocumentChunk, SchemaMappingMemory
    from app.services.parser import ScheduleParser, PDFParser, build_mapper_from_db_memory
    from app.services.ai import embedding_service
    from sqlalchemy import select
    import aiofiles

    async with get_db_context() as db:

        # Step 1: read file
        await _broadcast(project_id, "Reading file", 5, filename)
        try:
            async with aiofiles.open(file_path, "rb") as f:
                content = await f.read()
        except FileNotFoundError:
            await _update_upload(db, upload_id, "failed", "File not found on disk.")
            return

        # Step 2: tenant schema memory
        await _broadcast(project_id, "Loading schema memory", 10)
        mem_rows = (await db.execute(
            select(SchemaMappingMemory).where(SchemaMappingMemory.org_id == org_id)
        )).scalars().all()
        mapper = build_mapper_from_db_memory(mem_rows)

        # Step 3: parse
        await _update_upload(db, upload_id, "parsing", None)
        await _broadcast(project_id, "Detecting column structure", 20,
                         f"Detecting structure of {filename}")

        ext = filename.lower().rsplit(".", 1)[-1]
        chunks_to_embed = []
        quality_score = 0.0

        if ext in ("csv", "xlsx", "xls"):
            parser = ScheduleParser(mapper)
            result = parser.parse(content, filename)

            await _broadcast(project_id, "Saving tasks to database", 40,
                             f"{len(result.tasks)} tasks, {len(result.vendors)} vendors found")

            for pt in result.tasks:
                db.add(Task(
                    org_id=org_id,
                    project_id=project_id,
                    name=pt.task_name,
                    planned_duration=pt.duration,
                    planned_start_day=pt.start_day,
                    depends_on=pt.depends_on,
                    status=pt.status,
                    completion=pt.completion,
                    owner=pt.owner,
                    extra_fields=pt.extra,
                ))

            for pv in result.vendors:
                db.add(Vendor(
                    org_id=org_id,
                    project_id=project_id,
                    name=pv.vendor_name,
                    equipment_type=pv.equipment_type,
                    lead_time_days=pv.lead_time_days,
                    delivery_status=pv.delivery_status,
                    expected_arrival_day=pv.expected_arrival_day,
                    extra_fields=pv.extra,
                ))

            existing_cols = {m.source_column for m in mem_rows}
            for mf in result.schema_result.mappings:
                if mf.canonical and mf.original.lower() not in existing_cols:
                    db.add(SchemaMappingMemory(
                        org_id=org_id,
                        source_column=mf.original.lower(),
                        canonical_column=mf.canonical,
                        mapping_method=mf.method,
                        confidence=mf.confidence,
                    ))

            task_lines = "\n".join(
                f"{t.task_name}: {t.duration} days, depends on {t.depends_on}, status={t.status}"
                for t in result.tasks
            )
            if task_lines:
                chunks_to_embed.append({
                    "text": task_lines, "source": filename, "page": 0, "type": "schedule"
                })
            quality_score = result.quality_score

        elif ext in ("pdf", "docx", "doc"):
            pdf_parser = PDFParser()
            pdf_result = pdf_parser.parse(content, filename)
            chunks_to_embed = [
                {"text": c.text, "source": filename,
                 "page": c.page_number, "type": c.chunk_type}
                for c in pdf_result.chunks
            ]
            quality_score = 80.0
            await _broadcast(project_id, "Saving tasks to database", 40,
                             f"{pdf_result.page_count} pages, {len(chunks_to_embed)} chunks")

        else:
            await _update_upload(db, upload_id, "failed",
                                 f"Unsupported file type: .{ext}")
            return

        await db.flush()

        # Step 4: embed
        await _broadcast(project_id, "Embedding documents for AI search", 65,
                         f"Indexing {len(chunks_to_embed)} text chunks")

        if chunks_to_embed:
            texts = [c["text"] for c in chunks_to_embed]
            try:
                embeddings = embedding_service.embed_batch(texts)
            except Exception:
                embeddings = [None] * len(texts)

            for i, (c, emb) in enumerate(zip(chunks_to_embed, embeddings)):
                db.add(DocumentChunk(
                    org_id=org_id,
                    project_id=project_id,
                    upload_id=upload_id,
                    content=c["text"][:4000],
                    embedding=emb,
                    chunk_index=i,
                    source_file=c["source"],
                    page_number=c.get("page", 0),
                    chunk_type=c.get("type", "text"),
                ))

        # Step 5: finalise upload record
        upload_row = await db.get(Upload, upload_id)
        if upload_row:
            upload_row.status = "indexed"
            upload_row.parse_quality_score = quality_score

        await db.commit()

        await _broadcast(project_id, "Upload complete", 85,
                         f"Quality score: {quality_score:.0f}/100")

        # Step 6: trigger analysis
        await job_run_analysis(ctx, project_id, org_id)


# ── JOB 2: run_analysis ───────────────────────────────────────────────────────

async def job_run_analysis(ctx: Dict, project_id: str, org_id: str):
    """
    Full project analysis:
      1. Build dependency graph from DB tasks
      2. CPM (critical path + float)
      3. Risk engine + vendor scorer adjustment
      4. Weather agent risks (if enabled)
      5. Monte Carlo
      6. Project health score
      7. Save risks + update project record
      8. Broadcast analysis_complete with full stats
    """
    from app.database import get_db_context
    from app.models.db import Task, Vendor, Project, Risk
    from app.services.intelligence import (
        ProjectGraphEngine, TaskNode, TaskStatus,
        RiskEngine, VendorRiskInput,
        MonteCarloEngine, MCConfig,
    )
    from sqlalchemy import select, delete

    await _broadcast(project_id, "Computing critical path", 88)

    async with get_db_context() as db:

        # Load tasks
        t_rows = (await db.execute(
            select(Task).where(Task.project_id == project_id, Task.org_id == org_id)
        )).scalars().all()

        if not t_rows:
            await _broadcast(project_id, "No tasks found", 100,
                             "Upload a schedule file first.")
            return

        # Build graph
        engine = ProjectGraphEngine()
        for t in t_rows:
            engine.add_task(TaskNode(
                task_id=str(t.id),
                name=t.name,
                duration=t.planned_duration,
                status=TaskStatus(t.status),
                actual_delay=t.actual_delay,
                completion=t.completion,
                vendor_id=str(t.vendor_id) if t.vendor_id else None,
                duration_confidence=t.duration_confidence,
            ))

        name_to_id = {t.name: str(t.id) for t in t_rows}
        for t in t_rows:
            for dep_name in (t.depends_on or []):
                dep_id = name_to_id.get(dep_name)
                if dep_id:
                    try:
                        engine.add_dependency(dep_id, str(t.id))
                    except ValueError:
                        pass

        # CPM
        graph_result = engine.compute_schedule()

        # Update task floats in DB
        for t in t_rows:
            st = graph_result.scheduled_tasks.get(str(t.id))
            if st:
                t.total_float = st.total_float
                t.free_float = st.free_float
                t.criticality_score = engine.compute_impact_score(str(t.id))

        # Load vendors
        v_rows = (await db.execute(
            select(Vendor).where(Vendor.project_id == project_id)
        )).scalars().all()

        vendor_inputs = [
            VendorRiskInput(
                vendor_id=str(v.id),
                vendor_name=v.name,
                reliability_score=v.reliability_score,
                delivery_status=v.delivery_status,
                lead_time_days=v.lead_time_days or 0,
                expected_arrival_day=v.expected_arrival_day,
            )
            for v in v_rows
        ]

        # ── Vendor Reliability Scoring (Phase 3 from discussion) ──────────────
        vendor_history_scores = {}
        if settings.feature_vendor_scoring_enabled:
            try:
                from app.services.intelligence.vendor_scorer import compute_vendor_reliability
                vendor_history_scores = await compute_vendor_reliability(db, org_id)
            except Exception as e:
                print(f"[VendorScorer] Warning: {e}")

        # Risk analysis
        await _broadcast(project_id, "Scoring risks", 94)
        risk_engine = RiskEngine(
            low_threshold=settings.risk_threshold_low,
            medium_threshold=settings.risk_threshold_medium,
            high_threshold=settings.risk_threshold_high,
        )
        risk_result = risk_engine.analyse(
            graph_result, engine, vendor_inputs,
            vendor_history_scores=vendor_history_scores,
        )

        # ── Weather Agent (Phase 2 from discussion) ───────────────────────────
        weather_risks = []
        if settings.feature_weather_agent_enabled:
            try:
                from app.services.intelligence.weather_agent import analyse_weather_risks
                task_dicts = [
                    {
                        "name": t.name,
                        "planned_start": str(t.planned_start_day or ""),
                        "planned_finish": str(t.planned_duration or ""),
                    }
                    for t in t_rows
                ]
                weather_risks = await analyse_weather_risks(
                    task_dicts,
                    latitude=settings.default_site_latitude,
                    longitude=settings.default_site_longitude,
                )
            except Exception as e:
                print(f"[WeatherAgent] Warning: {e}")

        # Merge weather risks into risk list
        from app.services.intelligence.risk_engine import (
            RiskItem, RiskType, RiskSeverity
        )
        for wr in weather_risks:
            risk_result.risks.append(RiskItem(
                task_id=None,
                task_name=wr["task_name"],
                risk_type=RiskType.SCHEDULE,
                severity=RiskSeverity(wr["severity"]),
                probability=wr["probability"],
                impact_days=wr["impact_days"],
                risk_score=wr["risk_score"],
                explanation=wr["explanation"],
                confidence=wr["confidence"],
                evidence_hints=wr.get("evidence_hints", []),
            ))

        # Clear old risks and save new ones
        await db.execute(delete(Risk).where(Risk.project_id == project_id))
        for r in risk_result.risks:
            db.add(Risk(
                org_id=org_id,
                project_id=project_id,
                task_id=r.task_id,
                risk_type=r.risk_type.value,
                severity=r.severity.value,
                probability=r.probability,
                impact_days=r.impact_days,
                risk_score=r.risk_score,
                explanation=r.explanation,
                confidence=r.confidence,
            ))

        # ── Monte Carlo ────────────────────────────────────────────────────────
        await _broadcast(project_id, "Running Monte Carlo simulation", 96)
        mc_result = None
        if settings.feature_monte_carlo_enabled:
            try:
                mc = MonteCarloEngine(engine, MCConfig(n_simulations=settings.mc_n_simulations))
                mc_result = mc.run()
            except Exception as e:
                print(f"[MonteCarlo] Warning: {e}")

        # ── Project Health Score ──────────────────────────────────────────────
        await _broadcast(project_id, "Generating AI explanations", 98)
        try:
            from app.services.intelligence.project_health import compute_project_health
            health_score = compute_project_health(
                graph_result=graph_result,
                risk_result=risk_result,
                tasks_count=len(t_rows),
                mc_result=mc_result,
            )
        except Exception as e:
            print(f"[ProjectHealth] Warning: {e}")
            health_score = None

        # ── AI Memory — record analysis event ─────────────────────────────────
        if settings.feature_ai_memory_enabled:
            try:
                from app.services.intelligence.memory_service import record_analysis_event
                await record_analysis_event(
                    db=db,
                    project_id=project_id,
                    org_id=org_id,
                    delay_days=graph_result.total_delay,
                    risk_count=len(risk_result.risks),
                    risk_level=risk_result.project_risk_level.value,
                    top_risk=risk_result.top_risk.explanation if risk_result.top_risk else None,
                )
            except Exception as e:
                print(f"[AIMemory] Warning: {e}")

        # Update project record
        project = await db.get(Project, project_id)
        if project:
            project.baseline_completion_day = (
                project.baseline_completion_day or graph_result.baseline_completion_day
            )
            project.predicted_completion_day = graph_result.project_completion_day
            project.confidence_score = graph_result.overall_confidence
            if health_score is not None:
                project.health_score = health_score.overall_score

        await db.commit()

        # ── Final broadcast (CompleteCard reads these numbers) ────────────────
        delay = graph_result.total_delay
        try:
            from app.api.websocket import broadcast_event
            await broadcast_event(project_id, "analysis_complete", {
                # ↓ tasks_analysed was missing — now fixed
                "tasks_analysed": len(t_rows),
                "delay_days": delay,
                "risk_level": risk_result.project_risk_level.value,
                "confidence": round(graph_result.overall_confidence, 2),
                "risks_found": len(risk_result.risks),
                "weather_risks": len(weather_risks),
                "critical_path": [
                    engine.tasks[tid].name
                    for tid in graph_result.critical_path
                    if tid in engine.tasks
                ][:5],
                "mc_p80": mc_result.p80 if mc_result else None,
                "mc_on_time_probability": (
                    round(mc_result.on_time_probability, 2) if mc_result else None
                ),
                "health_score": (
                    health_score.overall_score if health_score else None
                ),
            })
        except Exception:
            pass


# ── DB helper ─────────────────────────────────────────────────────────────────

async def _update_upload(db, upload_id: str, status: str, error) -> None:
    from app.models.db import Upload
    row = await db.get(Upload, upload_id)
    if row:
        row.status = status
        if error:
            row.error_message = error
        await db.flush()


# ── ARQ worker settings ───────────────────────────────────────────────────────

class WorkerSettings:
    functions = [job_process_upload, job_run_analysis]
    max_jobs = 10
    job_timeout = 300


# ── Queue client ──────────────────────────────────────────────────────────────

class JobQueue:
    def __init__(self):
        self._pool = None
        self._fallback = False

    async def _get_pool(self):
        if self._pool:
            return self._pool
        try:
            from arq import create_pool
            from arq.connections import RedisSettings
            self._pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        except Exception:
            self._fallback = True
        return self._pool

    async def enqueue(self, func, *args, **kwargs):
        pool = await self._get_pool()
        if pool and not self._fallback:
            try:
                job = await pool.enqueue_job(func.__name__, *args, **kwargs)
                return job.job_id if job else None
            except Exception:
                pass
        try:
            await func({}, *args, **kwargs)
        except Exception as e:
            print(f"[JobQueue fallback] {func.__name__} error: {e}")
        return None


job_queue = JobQueue()