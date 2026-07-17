# Project Impact Intelligence — Backend

> Upload project files → instantly see impact → explore recovery options

---

## Folder Structure

```
backend/
├── app/
│   ├── main.py                          ← FastAPI app + router registration
│   ├── config.py                        ← All settings (reads .env)
│   ├── database.py                      ← Async SQLAlchemy + pgvector setup
│   │
│   ├── models/
│   │   ├── db.py                        ← All SQLAlchemy ORM models
│   │   └── schemas.py                   ← All Pydantic request/response schemas
│   │
│   ├── api/
│   │   ├── deps.py                      ← JWT auth + role permission guards
│   │   ├── upload.py                    ← File upload, preview, status
│   │   ├── analysis.py                  ← CPM analysis, dashboard, RAG query
│   │   ├── simulation.py                ← Recovery scenarios, approve/reject
│   │   └── project.py                   ← Project CRUD + auth + report download
│   │
│   ├── services/
│   │   │
│   │   ├── intelligence/                ← THE CORE ENGINE
│   │   │   ├── graph_engine.py          ← CPM + float + confidence propagation
│   │   │   ├── risk_engine.py           ← Multi-signal risk scoring
│   │   │   ├── montecarlo.py            ← Beta-dist MC simulation + sensitivity
│   │   │   ├── recovery_engine.py       ← Template actions + multi-obj scoring
│   │   │   └── confidence.py           ← Data quality → recommendation gating
│   │   │
│   │   ├── parser/
│   │   │   ├── csv_parser.py            ← CSV/Excel → ParsedTask/Vendor
│   │   │   ├── pdf_parser.py            ← PDF → text chunks for RAG
│   │   │   └── schema_mapper.py         ← 3-stage column mapping (rule→fuzzy→semantic)
│   │   │
│   │   ├── ai/
│   │   │   ├── gemini.py                ← Gemini client with fallback templates
│   │   │   └── embedding.py             ← BGE-small embeddings (local, no API key)
│   │   │
│   │   ├── rag/
│   │   │   └── pipeline.py              ← Hybrid retrieval + rerank + synthesis
│   │   │
│   │   ├── queue/
│   │   │   └── jobs.py                  ← ARQ background jobs (parse, analyse)
│   │   │
│   │   └── report/
│   │       └── generator.py             ← ReportLab PDF report builder
│   │
│   └── core/
│       └── __init__.py
│
├── synthetic/
│   ├── generate_data.py                 ← Generates realistic demo dataset
│   └── data/                            ← Output: schedule.csv, procurement.csv, notes.txt
│
├── migrations/                          ← Alembic migrations (init with alembic init)
├── tests/                               ← Pytest tests
├── .env.example                         ← Copy to .env and fill in keys
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Quick Start (Local, No Docker)

```bash
# 1. Clone and enter
cd backend

# 2. Create virtualenv
python -m venv venv
venv\Scripts\activate

# 3. Install deps
pip install -r requirements.txt

# 4. Start Postgres + Redis (Docker just for DB)
docker run -d --name pii_pg -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 pgvector/pgvector:pg16
docker run -d --name pii_redis -p 6379:6379 redis:7-alpine

# 5. Configure environment
cp .env.example .env
# → Set GEMINI_API_KEY in .env (get free key at aistudio.google.com)

# 6. Start server
uvicorn app.main:app --reload --port 8000
```

Server runs at **http://localhost:8000**
API docs at **http://localhost:8000/docs**

---

## Quick Start (Docker Compose)

```bash
cp .env.example .env
# edit .env — set GEMINI_API_KEY

docker-compose up --build
```

---

## Demo Flow (Judges)

```
1. POST /api/v1/auth/demo-login
   → get access_token (no registration needed)

2. POST /api/v1/projects
   body: {"name": "Bangalore DC Phase 1"}
   → get project_id

3. python synthetic/generate_data.py
   → creates synthetic/data/schedule.csv + procurement.csv

4. POST /api/v1/upload/preview
   file: synthetic/data/schedule.csv
   → see smart column mapping preview

5. POST /api/v1/upload/commit
   file: synthetic/data/schedule.csv + project_id
   → background parse + graph build starts

6. GET /api/v1/analysis/{project_id}
   → full CPM + risks + Monte Carlo results

7. POST /api/v1/simulation/auto-recover/{project_id}
   → ranked recovery options (no AI needed)

8. POST /api/v1/simulation/run
   body: {"project_id": "...", "action_type": "backup_vendor",
          "action_params": {"task_id": "...", "delay_reduction_days": 5}}
   → before/after comparison + P80/P90 completion dates

9. POST /api/v1/simulation/{scenario_id}/approve
   → manager approval flow

10. POST /api/v1/report/generate
    → download PDF intelligence report
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/demo-login` | Get demo token instantly |
| POST | `/api/v1/auth/login` | Standard login |
| POST | `/api/v1/projects` | Create project |
| GET  | `/api/v1/projects` | List projects |
| POST | `/api/v1/upload/preview` | Preview schema mapping |
| POST | `/api/v1/upload/commit` | Upload + queue processing |
| GET  | `/api/v1/upload/{id}` | Check processing status |
| GET  | `/api/v1/analysis/{project_id}` | Full CPM + risks + MC |
| GET  | `/api/v1/analysis/{project_id}/dashboard` | Lightweight health view |
| POST | `/api/v1/analysis/{project_id}/run` | Re-trigger analysis |
| POST | `/api/v1/analysis/query` | RAG Q&A over documents |
| POST | `/api/v1/simulation/auto-recover/{id}` | Auto-generate recovery options |
| POST | `/api/v1/simulation/run` | Simulate specific action |
| POST | `/api/v1/simulation/{id}/approve` | Approve scenario |
| POST | `/api/v1/simulation/{id}/reject` | Reject with reason |
| POST | `/api/v1/report/generate` | Generate PDF report |
| GET  | `/api/v1/report/download/{id}` | Download PDF |

---

## Key Design Decisions

| Decision | Reason |
|----------|--------|
| FastAPI + Python | Pandas, NetworkX, NumPy ecosystem |
| PostgreSQL + pgvector | One DB for relational + vector search |
| SQLAlchemy async | Non-blocking throughout |
| ARQ (not Celery) | Lightweight Redis queue, no broker config |
| BGE-small (local) | No API key, 384-dim, fast |
| Gemini free tier | Best free LLM; fallback to templates |
| Beta/PERT distribution | More realistic than uniform for durations |

---

## Environment Variables (key ones)

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/pii_db
REDIS_URL=redis://localhost:6379/0
GEMINI_API_KEY=your_key_here
SECRET_KEY=your_64_char_random_string
```

Get Gemini API key free: https://aistudio.google.com/app/apikey


1. Weather Risk Agent (NEW)
   → Pulls live 14-day forecast from Open-Meteo (free API)
   → Matches against outdoor tasks by keyword detection
   → Adds weather risks automatically to risk register
   → No EPC tool does this currently

2. Vendor Reliability Scoring (NEW)
   → Tracks on-time % per vendor across ALL projects in the org
   → Risk scores are automatically adjusted upward for repeat offenders
   → Creates a vendor performance memory that improves over time

3. 3-Layer AI Fallback (NEW)
   → Gemini → Groq → Graceful degrade
   → Demo literally cannot crash due to AI quota
   → Silent to user — they see answers regardless of which layer responded

4. Confidence Tooltip (NEW)
   → When confidence is 0%, tells user WHY and exactly how to fix it
   → No other AI tool explains its own uncertainty this clearly

# Incase the python version is not 3.13.xx so run below command:
 - cd backend
 - py -3.12 -m venv .venv
 - python --version
 - 


 cd C:\Users\Sachin\Desktop\PII\backend

.\.venv\Scripts\activate

uvicorn app.main:app --reload