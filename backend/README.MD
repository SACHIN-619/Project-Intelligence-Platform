# Project Impact Intelligence — Backend Engine

> **Enterprise FastAPI Core Engine** powering deterministic Critical Path Method (CPM) analytics, 1,000-run Monte Carlo simulations, multi-tenant hybrid RAG, and automated recovery planning for Mission-Critical EPC Data Centre delivery.

---

## 🏛️ Architecture & Module Breakdown

The backend is built around a layered architecture separating API transport, business intelligence, file parsers, and data storage:

```
backend/
├── app/
│   ├── api/                     ← REST API Endpoints & WebSockets
│   │   ├── auth.py              ← Authentication & Demo logins
│   │   ├── project.py           ← Project CRUD & Baseline management
│   │   ├── upload.py            ← File ingestion, schema mapping preview & commit
│   │   ├── analysis.py          ← CPM schedule execution, risks, Monte Carlo endpoints
│   │   ├── simulation.py        ← Recovery scenario simulation & compound stacking
│   │   ├── actions.py           ← Kanban action tracking & decision approval
│   │   ├── compliance.py        ← TIA-942 / Uptime Tier III audit checks
│   │   ├── report.py            ← ReportLab PDF export service
│   │   ├── admin.py             ← Cross-project vendor scoring & system metrics
│   │   ├── websocket.py         ← Real-time ingestion & analysis event streaming
│   │   └── deps.py              ← JWT validation & Role-Based Access Control (RBAC)
│   │
│   ├── core/                    ← Security, logging, & middleware
│   │   ├── security.py          ← Passlib bcrypt hashing & python-jose JWT handling
│   │   └── middleware.py        ← Structured request tracing & global error handling
│   │
│   ├── models/                  ← Data Layers
│   │   ├── db.py                ← SQLAlchemy ORM models with pgvector Vector(384) columns
│   │   └── schemas.py           ← Pydantic v2 validation models
│   │
│   ├── services/                ← Domain Logic & Engines
│   │   ├── ai/                  ← Multi-layer LLM orchestration (Gemini -> Groq -> Local)
│   │   │   ├── gemini.py        ← Gemini 1.5 Flash client with Groq Llama fallback
│   │   │   ├── embedding.py     ← BAAI/bge-small-en-v1.5 and hash fallback embedder
│   │   │   └── orchestrator.py  ← Engineering prompt synthesis & reasoning agents
│   │   ├── intelligence/        ← Core Engineering Algorithms
│   │   │   ├── graph_engine.py  ← Topological sort, forward/backward pass, float & CPM
│   │   │   ├── montecarlo.py    ← Vectorized 1K PERT-Beta distribution simulator
│   │   │   ├── risk_engine.py   ← Composite risk scoring (schedule, quality, procurement)
│   │   │   ├── recovery_engine.py← Scenario generator (crew, vendor swap, parallelization)
│   │   │   ├── vendor_scorer.py ← Historical vendor on-time delivery scoring across org
│   │   │   ├── weather_agent.py ← 14-day Open-Meteo weather risk correlation
│   │   │   ├── project_health.py← Weighted multi-factor health score engine
│   │   │   └── memory_service.py← Decision Memory feedback loop via AuditEvent
│   │   ├── parser/              ← Ingestion Pipeline
│   │   │   ├── csv_parser.py    ← CSV & XLSX schedule parser with date inference
│   │   │   ├── pdf_parser.py    ← PyMuPDF & pdfplumber technical spec extractor
│   │   │   ├── docx_parser.py   ← python-docx parser for project submittals & notes
│   │   │   └── schema_mapper.py ← Adaptive column mapper (Exact, Levenshtein, BGE)
│   │   ├── rag/                 ← Hybrid Knowledge Retrieval
│   │   │   └── pipeline.py      ← pgvector cosine similarity + keyword score + reranking
│   │   ├── queue/               ← Background Processing
│   │   │   └── jobs.py          ← Background ingestion worker (ARQ / in-process fallback)
│   │   └── report/              ← Audit Document Generation
│   │       └── generator.py     ← PDF generator using ReportLab
│   │
│   ├── config.py                ← Settings management with automatic URL & CORS normalization
│   ├── database.py              ← Async SQLAlchemy session factory with pooler support
│   └── main.py                  ← FastAPI application factory & lifecycle management
│
├── tests/                       ← Comprehensive test suite (91 unit & integration tests)
├── Dockerfile                   ← Production Dockerfile with dynamic $PORT binding
└── requirements.txt             ← Production Python packages
```

---

## 🛠️ Key Technical Implementations

### 1. Deterministic Graph & Critical Path Engine (`graph_engine.py`)
* Computes Early Start (ES), Early Finish (EF), Late Start (LS), and Late Finish (LF) across the dependency Directed Acyclic Graph (DAG).
* Calculates Total Float ($TF = LS - ES$) and Free Float ($FF = \min(ES_{succ}) - EF$).
* Tasks with zero total float ($TF \le 0$) are marked as the Critical Path.

### 2. Monte Carlo Simulation (`montecarlo.py`)
* Runs 1,000 randomized iterations over task durations modeled as three-point PERT-Beta probability distributions ($O$: Optimistic, $M$: Most Likely, $P$: Pessimistic).
* Vectorized using NumPy to compute project finish percentiles ($P_{50}, P_{80}, P_{90}$) in milliseconds.

### 3. Multi-Tenant Hybrid RAG (`pipeline.py`)
* **Vector Search:** Embeds incoming queries via BGE-small-en-v1.5 and executes cosine distance scoring over `DocumentChunk` table filtered strictly by `org_id` and `project_id`.
* **Keyword Matching:** Computes lexical coverage to balance keyword recall with semantic relevance.
* **Truth-Value Safe:** Handles pgvector NumPy array validations without truth-value ambiguity errors.

### 4. AI Decision Memory & Continuous Learning (`memory_service.py`)
* Automatically captures every approved/rejected recovery scenario into `audit_events` with `after_state`.
* Evaluates historical outcomes to weight recommendations, ensuring the platform learns from past project decisions.

---

## ⚙️ Environment Variables (`.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL async connection string (`postgresql+asyncpg://...`) | `postgresql+asyncpg://...` |
| `SECRET_KEY` | 64-char random string for JWT encryption | `changeme-in-production` |
| `CORS_ORIGINS` | JSON array or comma-separated allowed frontend origins | `["http://localhost:3000"]` |
| `GEMINI_API_KEY` | Google Gemini API key for engineering intelligence | `None` |
| `GROQ_API_KEY` | Optional Groq key for fast Llama fallback | `None` |
| `REDIS_URL` | Redis URI for queueing (falls back to in-process if unavailable)| `redis://localhost:6379/0` |
| `STORAGE_BACKEND`| File storage type (`local` or `s3`) | `local` |
| `STORAGE_LOCAL_PATH`| Directory for file uploads | `uploads` |

---

## 🧪 Testing

Run the 91-test verification suite:
```bash
pytest tests/ -v
```
Tests cover:
* Topological DAG sorting & CPM edge cases
* PERT-Beta Monte Carlo calculations
* Multi-format schedule parsers & fuzzy schema matching
* Tenant isolation & REST API route security
