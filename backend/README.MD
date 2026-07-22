# Project Impact Intelligence — Backend

> **Enterprise AI-powered core engine** for Project Impact Intelligence (PII) — a multi-agent project delivery platform for Data Centre EPC, powered by **Bright AI**.

---

## Folder Structure

```
backend/
├── app/
│   ├── main.py                          ← FastAPI application factory & router mounting
│   ├── config.py                        ← Centralised settings reading from environment & .env
│   ├── database.py                      ← Async SQLAlchemy pgvector setup + pool limits
│   │
│   ├── core/
│   │   ├── middleware.py                ← Global logging + error handling middleware
│   │   └── security.py                  ← JWT hashing, verify, signature validations
│   │
│   ├── models/
│   │   ├── db.py                        ← SQLAlchemy ORM Models (Project, Task, Vendor, etc.)
│   │   └── schemas.py                   ← Pydantic validation request/response structures
│   │
│   ├── api/
│   │   ├── deps.py                      ← JWT token parsing + RBAC permission guards
│   │   ├── auth.py                      ← User register, standard login, and "Try Demo" login
│   │   ├── project.py                   ← Project CRUD + baseline configurations
│   │   ├── upload.py                    ← Upload center, commit status, preview schema mapper
│   │   ├── analysis.py                  ← Risk register, CPM graph run, Monte Carlo metrics
│   │   ├── simulation.py                ← Auto-recovery simulations, scenario compare
│   │   ├── actions.py                   ← Approved actions tracking (Kanban sync)
│   │   ├── report.py                    ← PDF Report generation endpoints
│   │   ├── admin.py                     ← Admin panel, hours saved tracker, system status
│   │   └── websocket.py                 ← Real-time processing progress broadcast
│   │
│   └── services/
│       ├── ai/
│       │   ├── gemini.py                ← 3-Layer AI Provider (Gemini → Groq → degrades gracefully)
│       │   ├── embedding.py             ← Local BGE embedding model (zero API cost)
│       │   └── orchestrator.py          ← multi-agent prompt synthesis & reasoning
│       │
│       ├── intelligence/
│       │   ├── graph_engine.py          ← CPM (earliest/latest start, total float, critical path)
│       │   ├── risk_engine.py           ← Multi-signal risk assessment logic
│       │   ├── montecarlo.py            ← 1000x PERT Beta schedule simulations
│       │   ├── recovery_engine.py       ← Action impact simulator (days saved, confidence)
│       │   ├── project_health.py        ← Weighted composite score calculator
│       │   ├── weather_agent.py         ← 14-day weather forecast keyword correlation
│       │   ├── vendor_scorer.py         ← Cross-project vendor reliability tracking
│       │   ├── specification_agent.py   ← Quality & spec checker
│       │   └── memory_service.py        ← Approved recovery action learning feedback loop
│       │
│       ├── parser/
│       │   ├── csv_parser.py            ← Ingests schedules, dates, and dependencies
│       │   ├── pdf_parser.py            ← Extracts specifications for RAG ingestion
│       │   └── schema_mapper.py         ← Column mapper (Exact → Fuzzy → Semantic BGE)
│       │
│       ├── rag/
│       │   └── pipeline.py              ← Cosine similarity search + context synthesis
│       │
│       ├── queue/
│       │   └── jobs.py                  ← ARQ/in-memory task executor for background processing
│       │
│       └── report/
│           └── generator.py             ← ReportLab PDF generator (narrative, tables, formatting)
│
├── migrations/                          ← Alembic database migrations
├── tests/                               ← Pytest test suite (cpm, risk, parsers, apis)
├── synthetic/                           ← Data generation helper scripts
│   ├── generate_data.py                 ← Generates mock schedules and specifications
│   └── data/                            ← Synthetic schedules (01_simple to 13_mixed_dates)
│
├── .env.example                         ← Configuration template
├── requirements.txt                     ← Production python packages
├── requirements-ai.txt                  ← AI & Embedding packages
├── requirements-dev.txt                 ← Testing & validation tools
├── Dockerfile                           ← Multi-stage production build
├── docker-compose.yml                   ← DB + Redis + App container configuration
└── pytest.ini                           ← Pytest test root environment settings
```

---

## ⚡ Core Engine Innovations (Bright AI)

1. **3-Layer AI Fallback Chain (`app/services/ai/gemini.py`)**
   - **Layer 1:** Google Gemini Pro/Flash (primary)
   - **Layer 2:** Groq LLaMA-3.3-70B-Versatile (runs automatically on Gemini quota limits)
   - **Layer 3:** Graceful Degradation (uses structured fallback data; system never crashes)

2. **Smart Schema Mapper (`app/services/parser/schema_mapper.py`)**
   - Resolves messy sheet column headers using a 3-stage matching cascade:
     * *Exact string match* (dictionary check, confidence 1.0)
     * *Fuzzy matching* (via Levenshtein ratio, confidence 0.7–0.9)
     * *Semantic embedding comparison* (local BGE embeddings, confidence 0.5–0.8)

3. **Predictive Weather Correlation (`app/services/intelligence/weather_agent.py`)**
   - Ingests free 14-day forecasts from the **Open-Meteo API** (completely keyless).
   - Flags outdoor-sensitive tasks matching keywords (*civil, foundation, excavation, structural steel, external*) if forecast exceeds rain, heat, or wind safety guidelines.

4. **Cross-Project Vendor Reliability (`app/services/intelligence/vendor_scorer.py`)**
   - Builds vendor profiles aggregating historical data across all projects in the tenant organisation.
   - Outputs an on-time percentage score which dynamically penalises or boosts task risk calculations.

5. **PERT-Beta Monte Carlo Engine (`app/services/intelligence/montecarlo.py`)**
   - Simulates 1,000 schedule run-throughs mapping task durations to PERT-Beta probability distributions.
   - Computes standard confidence milestones (P50, P80, P90) to support schedule commitments.

6. **Explainable AI Recommendations (`app/services/intelligence/recovery_engine.py`)**
   - AI-recommended actions (Add Crew, Parallel Tasks, Backup Vendor) include confidence values, evidence citations, expected recovery days, and cost ratings.

7. **Decision Memory Service (`app/services/intelligence/memory_service.py`)**
   - Learns from managers' decisions.
   - When a manager approves or rejects recovery actions, it updates a feedback loop that biases future recommendations toward proven solutions.

---

## 🚀 Quick Start (Local Development)

### 1. Requirements & Version Check
The backend requires **Python 3.12** or **Python 3.13** and **PostgreSQL** (version 15+ with the `pgvector` extension installed).

```bash
# Verify Python version
python --version
```

### 2. Set Up Virtual Environment
```bash
# Clone or enter directory
cd backend

# Create virtualenv (Use py -3.12 if you have multiple py versions)
python -m venv .venv

# Activate on Windows
.\.venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
pip install -r requirements-ai.txt
pip install -r requirements-dev.txt
```

#### 🔧 Troubleshooting Numpy/SciPy Import Errors
If you run into import failures with NumPy or SciPy on Windows:
```bash
python -m pip install --upgrade --force-reinstall "numpy<2.0" scipy
```

### 4. Run PostgreSQL + Redis (using Docker)
To get PostgreSQL with `pgvector` and a Redis cache running instantly:
```bash
# Run pgvector PostgreSQL
docker run -d --name pii_pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16

# Run Redis
docker run -d --name pii_redis -p 6379:6379 redis:7-alpine
```

### 5. Setup Local Configurations
```bash
# Copy template env file
cp .env.example .env
```
Open `.env` and configure:
- `DATABASE_URL`: `postgresql+asyncpg://postgres:postgres@localhost:5432/pii`
- `GEMINI_API_KEY`: *(Get a free key at [aistudio.google.com](https://aistudio.google.com))*
- `GROQ_API_KEY`: *(Optional fallback fallback key)*
- `SECRET_KEY`: *(A long random string for JWT signatures)*

### 6. Start the Server
```bash
uvicorn app.main:app --reload --port 8000
```
- Interactive API Docs will be available at: http://localhost:8000/docs
- Alternate Redoc available at: http://localhost:8000/redoc

---

## 🐳 Docker Compose (All Services)

You can run the entire backend stack (FastAPI, Redis, PostgreSQL, Alembic migrations) in containers:
```bash
# Build and bring up stack
docker-compose up --build
```

---

## 🛠️ Testing & Mock Dataset

Generate high-quality synthetic files matching 13 representative project situations:
```bash
python synthetic/generate_data.py
```
This writes CSV schedules, procurement lists, and PDF specifications directly to `synthetic/data/`.

To run the full backend testing suite:
```bash
pytest
```

---

## ⚙️ REST API Reference

| Endpoint | Method | Role Allowed | Description |
|:---|:---:|:---:|:---|
| **Authentication** | | | |
| `/api/v1/auth/register` | `POST` | *All* | Standard user signup |
| `/api/v1/auth/login` | `POST` | *All* | Fetch JWT bearer access token |
| `/api/v1/auth/demo-login` | `POST` | *All* | One-click judge login (creates temp manager user) |
| **Projects** | | | |
| `/api/v1/projects` | `POST` | `admin`, `manager`, `engineer` | Create new data centre project baseline |
| `/api/v1/projects` | `GET` | *All* | List active projects for current tenant |
| **Upload Center** | | | |
| `/api/v1/upload/preview` | `POST` | `admin`, `manager`, `engineer`, `quality`, `procurement` | Preview column header mapping before commit |
| `/api/v1/upload/commit` | `POST` | `admin`, `manager`, `engineer`, `quality`, `procurement` | Upload files and trigger background processing |
| `/api/v1/upload/status/{id}` | `GET` | *All* | Fetch parser progress and mapping accuracy |
| **Schedule Analysis** | | | |
| `/api/v1/analysis/{id}` | `GET` | *All* | Run CPM, risk register extraction, and Monte Carlo |
| `/api/v1/analysis/{id}/dashboard` | `GET` | *All* | Fetch project health scores and KPIs |
| `/api/v1/analysis/query` | `POST` | *All* | AI chat (RAG) over spec documents with page citations |
| **Recovery Simulation** | | | |
| `/api/v1/simulation/auto-recover/{id}`| `POST` | `admin`, `manager`, `engineer` | Fetch AI recommendations ranked by benefit |
| `/api/v1/simulation/run` | `POST` | `admin`, `manager`, `engineer` | Simulate recovery actions on the CPM schedule |
| `/api/v1/simulation/{id}/approve` | `POST` | `admin`, `manager` | Approve recovery scenario |
| `/api/v1/simulation/{id}/reject` | `POST` | `admin`, `manager` | Reject recommendation with reason code |
| **Actions Tracking** | | | |
| `/api/v1/actions` | `GET` | *All* | Fetch approved actions sync to Kanban |
| **PDF Reporting** | | | |
| `/api/v1/report/generate` | `POST` | `admin`, `manager` | Trigger PDF document generation job |
| `/api/v1/report/download/{id}` | `GET` | *All* | Stream PDF report file |
| **Admin & System** | | | |
| `/api/v1/admin/metrics` | `GET` | `admin` | Fetch server response, hours saved, and vendor scores |
| `/api/v1/admin/health` | `GET` | `admin` | Check DB, Redis, and Layer 1/2 AI availability |

---

## 📊 Database Schema Summary

The database uses PostgreSQL with the pgvector extension.

1. **`organisations`**: Root tenant model.
2. **`users`**: Auth credentials and system role.
3. **`projects`**: Project baselines, planned completion, predicted delay, health score.
4. **`uploads`**: Ingested files, parsing scores, mapping definitions.
5. **`tasks`**: Project tasks, dependency edges, floats, early/late times, critical path flag.
6. **`vendors`**: Vendor names, lead times, cross-project on-time percentage records.
7. **`risks`**: AI-extracted schedule, quality, weather, or procurement risks.
8. **`scenarios`**: Simulative recovery runs.
9. **`actions`**: Approved scenarios tracked on the Kanban board.
10. **`document_chunks`**: Ingested document chunks with 384-dimension vector embeddings.
11. **`audit_events`**: Immutable system audit trail including decision learning logs.
12. **`schema_mapping_memory`**: Naming mapping cache per tenant organisation.

---

## ⚡ Multi-Agent prompt pipeline (RAG & Rationale)
When querying the AI Assistant:
1. Retrieval returns relevant chunks from `document_chunks` using cosine similarity.
2. The `KnowledgeGraph` service builds relationships relative to active entities.
3. The prompt is injected with: RAG document chunks + Critical path dependencies + Live weather forecast warnings + Vendor reliability scores.
4. Result: Grounded, mathematically backed answers that explain *why* recommendations are made.

---

*Project Impact Intelligence © 2026*  
*Bright AI · Data Centre EPC Intelligence Platform*