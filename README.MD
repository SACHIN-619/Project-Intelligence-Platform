# PII — Project Impact Intelligence

> **ET AI Hackathon 2.0 · Problem Statement 4 · EPC Data Centre Intelligence Platform**
> Prize Pool: ₹10,00,000 · Built by: Sachin · Anurag University

---

## What Is PII?

Project Impact Intelligence (PII) is a production-grade AI platform that transforms
how EPC (Engineering, Procurement, Construction) project managers understand and
respond to schedule risk.

**The problem it solves:**

Traditional EPC project management relies on manually reading 500-row Excel schedules,
calling vendors individually, and writing risk reports that are obsolete by the time
they're printed. This process takes 13+ hours per week per project manager.

**What PII does instead:**

Upload your project schedule CSV or XLSX → PII instantly:
- Detects which tasks are delayed and by how many days
- Computes the critical path using CPM (Critical Path Method) graph algorithms
- Runs 1,000 Monte Carlo simulations to forecast P50/P80/P90 completion dates
- Identifies and scores every risk using a multi-factor AI engine
- Generates ranked recovery options (backup vendor, parallel execution, add crew)
- Lets you simulate each recovery and see the before/after delay comparison
- Allows you to approve recovery actions and track them on a Kanban board
- Answers natural language questions about your project via RAG-powered AI chat

**The result:** 82+ hours saved per project, 97% time reduction vs manual process.

---

## The Innovation

### 1. Schema-Agnostic Upload
Every company uses different column names in their Excel schedules.
"Task Name" vs "Activity" vs "Work Item" vs "Description" — all mean the same thing.

PII uses a **3-stage schema mapper**:
- Stage 1: Exact dictionary lookup (1.0 confidence)
- Stage 2: Fuzzy string matching via rapidfuzz (0.7–0.9 confidence)
- Stage 3: Semantic embedding similarity via BGE-small (0.5–0.8 confidence)

Plus **tenant-level schema memory** — once your organisation's column names are learned,
they're remembered for every future upload. Gets smarter with use.

### 2. CPM + Monte Carlo in One Pipeline
Most tools do either schedule analysis OR risk simulation. PII does both in one job:

The ARQ worker is NOT running.

You need TWO separate terminals:

Terminal 1:                          Terminal 2:
──────────────────────               ──────────────────────────────────────────
cd backend                           cd backend
uvicorn app.main:app --reload        arq app.services.queue.jobs.WorkerSettings

Without Terminal 2, jobs go into     This picks up jobs from Redis queue
Redis queue but nobody processes     and broadcasts WebSocket events
them. Steps stay grey forever.       that animate the processing steps.