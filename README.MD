# Project Impact Intelligence (PII)

> **Enterprise AI Platform for Data Centre EPC Project Delivery**  
> Predict schedule delays, audit TIA-942 compliance, simulate recovery options, and ground natural-language engineering queries using deterministic graph algorithms and hybrid RAG.

---

## 📌 Executive Summary & Problem Solved

### The Problem in Hyperscale EPC Projects
Engineering, Procurement, and Construction (EPC) for data centers requires delivering complex electrical/mechanical infrastructure (generators, chillers, sub-stations, switchgear) under immovable launch deadlines. Project teams routinely suffer from:
1. **Hidden Dependency Cascades:** A 2-week vendor shipping delay on an uninterruptible power supply (UPS) goes undetected until downstream commissioning fails, causing weeks of critical path delays.
2. **Static, Manual Analysis:** Engineers spend **13+ hours weekly** manually reconciling 500+ line Excel/P6 schedules across disconnected contractor spreadsheets.
3. **Information Silos:** Thousands of pages of specifications (e.g., TIA-942 Tier III, ASHRAE, vendor submittals) sit idle in PDFs/DOCX, ungrounded in day-to-day decisions.
4. **No Organizational Memory:** When recovery actions are taken (adding a crew, parallelizing testing, swapping vendors), teams fail to track outcomes, causing repeat mistakes on future builds.

### How PII Solves It (With Real-World Example)
* **Example Scenario:** An upload contains a 14-day vendor shipping slip for a "Chilled Water Chiller". 
* **PII Workflow:**
  1. **Schema Mapping & Ingestion:** PII extracts tasks, durations, and dependencies from CSV, XLSX, PDF, or DOCX, automatically matching columns via exact, Levenshtein fuzzy, and semantic BGE similarity.
  2. **CPM Graph Computation:** Deterministically evaluates forward/backward passes to identify the true critical path and calculate total/free float.
  3. **1,000-Run Monte Carlo Simulation:** Models uncertainty with PERT-Beta probability distributions, surfacing realistic P50, P80, and P90 completion timelines.
  4. **Multi-Signal Risk Engine:** Cross-references open-air tasks with 14-day Open-Meteo weather forecasts and historical vendor delivery scores across previous projects.
  5. **Auto-Recovery Simulation:** Generates quantified recovery scenarios (e.g., "Fast-track Commissioning in parallel: saves 11 days, 85% feasibility").
  6. **Hybrid RAG Engineering Assistant:** Grounded directly in project chunks via 384-dimensional pgvector cosine similarity + lexical matching for instant technical queries.

---

## 🏗️ End-to-End System Architecture

```
                             [ CLIENT TIER (Vercel) ]
                  Next.js 14 App Router · TypeScript · Tailwind CSS
                     React Flow (Dependency Graph) · Recharts
                                        │
                                        │ HTTPS / WSS
                                        ▼
                            [ API GATEWAY (Render) ]
                 FastAPI Core · JWT RBAC (Tenant-Isolated by Org ID)
                                        │
            ┌───────────────────────────┼───────────────────────────┐
            ▼                           ▼                           ▼
    [ INGESTION PIPELINE ]     [ INTELLIGENCE ENGINES ]     [ HYBRID RAG ENGINE ]
  • Exact/Fuzzy/BGE Mapper    • ProjectGraphEngine (CPM)   • BGE-small-en-v1.5
  • CSV/XLSX Schedule Parser  • 1K-Run Monte Carlo (Beta)  • PostgreSQL pgvector (384-d)
  • PDF (PyMuPDF) Extractor   • Multi-Signal Risk Scoring  • Keyword / Recency Scoring
  • DOCX Document Parser      • Decision Memory Loop       • Gemini L1 / Groq L2 Fallback
            │                           │                           │
            └───────────────────────────┼───────────────────────────┘
                                        ▼
                           [ PERSISTENCE & CACHE ]
                   PostgreSQL + pgvector (Supabase / Neon)
                     Redis Queue & In-Process Fallback
```

---

## 🛠️ Tech Stack & Technical Justifications

| Layer | Technology | Why We Chose It Over Alternatives |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 14 (App Router), TypeScript** | Server-side performance, rigid type-safety for complex CPM graph nodes, and zero-config deployment on Vercel. |
| **Interactive Viz** | **React Flow, Recharts** | High-performance interactive DAG visualization for critical paths, float margins, and Monte Carlo probability distribution curves. |
| **Backend API** | **FastAPI (Python 3.12)** | Asynchronous endpoints (`async/await`), automatic OpenAPI docs, and native integration with scientific computing packages. |
| **Database** | **PostgreSQL + pgvector** | Unified relational data model (projects, tasks, tenants) and vector search in a single transactional database without needing an external vector DB. |
| **Embeddings** | **BAAI/bge-small-en-v1.5** | High MTEB retrieval performance with compact 384-dimensional vectors, optimized for fast cosine distance ranking with minimal memory usage. |
| **AI LLM Tier** | **Gemini 1.5 Flash + Groq Llama-3.3 Fallback** | Sub-second latency and large token context with Gemini, backed by an ultra-fast Groq Llama fallback to prevent downtime. |
| **Graph & Sim** | **NetworkX, NumPy, SciPy** | Exact topological sorting, cycles detection, critical path calculation, and vectorized 1,000-run Monte Carlo simulations. |
| **Queue & Worker**| **Redis / ARQ + In-Process Fallback** | Fast background file parsing and simulation queue, with automated graceful degradation to synchronous HTTP execution if Redis is unavailable. |

---

## 📁 Repository Structure

```
PII/
├── backend/                             ← FastAPI Core Engine
│   ├── app/
│   │   ├── api/                         ← REST & WebSocket routers (auth, upload, simulation, RAG)
│   │   ├── core/                        ← JWT auth, tenant middleware, error interceptors
│   │   ├── models/                      ← SQLAlchemy ORM models & Pydantic validation schemas
│   │   ├── services/
│   │   │   ├── ai/                      ← Gemini & Groq LLM orchestration
│   │   │   ├── intelligence/            ← CPM graph engine, Monte Carlo, risk scorer, AI memory
│   │   │   ├── parser/                  ← Schedule (CSV/XLSX), PDF, DOCX parsers & schema mapper
│   │   │   ├── queue/                   ← Background jobs and queue processors
│   │   │   ├── rag/                     ← Vector retrieval & hybrid scoring pipeline
│   │   │   └── report/                  ← ReportLab PDF audit generator
│   │   ├── config.py                    ← Environment settings & CORS parsing
│   │   ├── database.py                  ← Async SQLAlchemy engine with pooler optimization
│   │   └── main.py                      ← Application factory & router registration
│   ├── Dockerfile                       ← Multi-stage production container
│   ├── requirements.txt                 ← Production dependencies
│   └── tests/                           ← 91 unit and integration tests
│
├── frontend/                            ← Next.js 14 Client App
│   ├── app/                             ← App Router pages (Dashboard, Upload, Intelligence, Recovery, Assistant)
│   ├── components/                      ← Reusable UI, React Flow canvas, metric strips
│   ├── contexts/                        ← Auth & Active Project state management
│   ├── hooks/                           ← Custom hooks (useWebSocket, useToast)
│   ├── lib/                             ← API client fetch mapping
│   └── types/                           ← TypeScript interface definitions
│
└── README.md                            ← Root architectural blueprint
```

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
* Python 3.11 or 3.12
* Node.js 18+ and npm
* PostgreSQL database with `pgvector` enabled (or Supabase / Neon instance)

### 2. Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in DATABASE_URL, SECRET_KEY, and GEMINI_API_KEY in .env

uvicorn app.main:app --reload --port 8000
```
Swagger API documentation will be live at: `http://localhost:8000/docs`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Client dashboard will be live at: `http://localhost:3000`

---

## 🌐 Production Deployment

* **Database:** Provision a PostgreSQL instance on **Supabase** or **Neon.tech**. Run `CREATE EXTENSION IF NOT EXISTS vector;`.
* **Backend:** Deploy `backend` to **Render** as a Web Service via Dockerfile. Set environment variables (`DATABASE_URL`, `SECRET_KEY`, `GEMINI_API_KEY`, `CORS_ORIGINS`).
* **Frontend:** Deploy `frontend` to **Vercel**. Set `NEXT_PUBLIC_API_URL=https://<your-render-app>.onrender.com`.

---

## 🛡️ Enterprise Security & Multi-Tenancy
* **Tenant Isolation:** Every primary database entity (`Task`, `Project`, `Upload`, `Risk`, `Scenario`, `DocumentChunk`, `AuditEvent`) is strictly partitioned by `org_id`.
* **RBAC:** Explicit permission guards (`CanUpload`, `CanSimulate`, `CanApprove`, `AdminOnly`) validate user roles before triggering actions.
* **Prepared Statement Compatibility:** Automated statement cache disabling prevents collision issues across transaction connection poolers.
