# Project Impact Intelligence (PII)

> **Enterprise AI Platform for Data Centre EPC Project Delivery**  
> Predict schedule delays, audit TIA-942 Tier III compliance, simulate recovery interventions, and ground natural-language engineering queries using deterministic graph analytics, Monte Carlo simulations, and multi-tenant hybrid RAG.

---

## 1. 🌐 The Real-World Problem & End-to-End User Workflow

### Why Data Centre EPC Projects Fail
Hyperscale data centre construction projects operate under immovable delivery dates with severe delay penalties ($100k+/day). Despite modern tools, projects routinely suffer from three structural points of failure:
1. **Fragmented Primavera P6 / Excel Schedules:** A single campus build spans 50+ contractor and supplier spreadsheets. Dependencies are siloed, meaning a 2-week vendor shipping slip on a 2MW Diesel Generator or Chilled Water System remains hidden until downstream electrical commissioning crashes.
2. **Dense, Disconnected Technical Specifications (TIA-942 / Uptime Tier III):** Critical engineering constraints (e.g., $N+1$ or $2N$ power redundancy, concurrent maintainability, compartmentalized fuel systems) are buried across hundreds of PDF/DOCX submittals, rarely audited in real-time against on-site delivery changes.
3. **Absence of Institutional Decision Memory:** When projects slip, managers improvise recovery actions (e.g., "fast-track commissioning" or "air-freight switchgear"). The outcomes of these high-cost decisions are never systematically logged, causing repeat errors on future builds.

---

### Step-by-Step User Walkthrough: From Ingestion to Decision Memory

```mermaid
flowchart LR
    A["1. Upload & Schema Mapping\n(CSV, XLSX, PDF, DOCX)"] --> B["2. DAG & CPM Engine\n(Critical Path & Float)"]
    B --> C["3. 1,000-Run Monte Carlo\n(PERT-Beta P50/P80/P90)"]
    C --> D["4. TIA-942 Compliance\n(Spec Chunk Extraction & NCRs)"]
    D --> E["5. Hybrid RAG Assistant\n(Gemini L1 / Groq L2 Context QA)"]
    E --> F["6. Decision Memory Loop\n(Track Interventions & Vendor History)"]
```

1. **Upload & Adaptive Schema Mapping:**
   * The user uploads a schedule (`.csv`, `.xlsx`) or technical submittal (`.pdf`, `.docx`).
   * PII's adaptive schema mapper executes exact keyword lookups, Levenshtein fuzzy matching via `RapidFuzz`, and semantic BGE similarity to normalize non-standard headers (e.g., "Supplier Name" $\rightarrow$ `vendor_name`, "Float" $\rightarrow$ `total_float`).
   * The user receives a live preview table with confidence ratings before committing.

2. **Deterministic DAG & CPM Scheduling:**
   * The backend constructs a Directed Acyclic Graph (DAG) with topological sorting.
   * Performs forward and backward passes to compute Early Start (ES), Early Finish (EF), Late Start (LS), and Late Finish (LF).
   * Identifies tasks with zero total float ($TF \le 0$) as the true **Critical Path** and renders them interactively in the React Flow canvas.

3. **1,000-Run Monte Carlo Simulation:**
   * Generates 1,000 randomized iterations using three-point PERT-Beta probability distributions ($O$: Optimistic, $M$: Most Likely, $P$: Pessimistic).
   * Computes probabilistic completion milestones ($P_{50}, P_{80}, P_{90}$) to reveal the real statistical likelihood of missing the contractual handover date.

4. **TIA-942 / Uptime Tier III Compliance:**
   * Ingested specification chunks are audited against Tier III requirements: concurrent maintainability, dual power paths, 12-hour fuel autonomy, and cooling redundancy.
   * Automatically raises Non-Conformance Reports (NCRs) whenever scheduled equipment or vendor lead times violate standards.

5. **Multi-Tenant Hybrid RAG Chat:**
   * Engineers query the platform in plain English (*"What is the delayed delivery impact of the Cummins generator on the switchgear testing schedule?"*).
   * Hybrid retrieval blends 384-dimensional pgvector cosine similarity with lexical keyword matching, synthesized through Gemini 1.5 Flash (with Groq Llama-3.3 failover).

6. **Recovery Simulation & AI Decision Memory:**
   * The user evaluates automated recovery scenarios (*"Split testing into two crews"* or *"Engage backup regional vendor"*).
   * Stacks compound actions to inspect synergy gains.
   * Approving an action creates a live Kanban item in the Action Center and commits the rationale to `audit_events`.
   * Future recommendations dynamically adjust based on historical vendor reliability and recovery success rates.

---

## 2. 🏛️ System Architecture & Multi-Tenant Design

```
                             [ CLIENT TIER (Vercel) ]
                  Next.js 14 App Router · TypeScript · Tailwind CSS
                     React Flow (Interactive DAG) · Recharts
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
  • DOCX Document Parser      • Decision Memory Loop       • Gemini L1 / Groq L2 Failover
            │                           │                           │
            └───────────────────────────┼───────────────────────────┘
                                        ▼
                           [ PERSISTENCE & CACHE ]
                   PostgreSQL + pgvector (Supabase / Neon)
                     Redis Queue & In-Process Fallback
```

### Key Architectural Pillars

* **Strict Multi-Tenant Isolation:**
  Every relational entity (`projects`, `tasks`, `vendors`, `risks`, `scenarios`, `uploads`, `document_chunks`, `actions`, `audit_events`) contains a non-nullable `org_id`. All queries, vector distance lookups, and compound simulation evaluations enforce `org_id == user.org_id`.

* **Unified PostgreSQL + pgvector Schema:**
  Relational data and vector embeddings reside in a single transactional database. Chunks generated from PDF/DOCX specs are indexed with `Vector(384)`, eliminating external vector database synchronization issues.

* **Graceful Queue Degradation (Redis / ARQ $\rightarrow$ Inline HTTP):**
  [`jobs.py`](backend/app/services/queue/jobs.py) catches Redis connection errors (`redis.exceptions.ConnectionError`). When Redis is unprovisioned, jobs execute inline asynchronously within the FastAPI process lifecycle, guaranteeing demo stability without requiring Redis on free-tier deployments.

* **Real-Time WebSocket Updates:**
  Frontend maintains an auto-reconnecting WebSocket connection to `/api/v1/ws/{project_id}` via [`useWebSocket.ts`](frontend/hooks/useWebSocket.ts). Step-by-step ingestion, vectorization percentages, and Monte Carlo completions stream directly to the client without page polling.

* **Two-Tier LLM Failover (Gemini L1 $\rightarrow$ Groq L2):**
  [`gemini.py`](backend/app/services/ai/gemini.py) routes synthesis requests to Gemini 1.5 Flash (Layer 1). If rate-limited or unavailable, it transparently fails over to Groq Llama-3.3-70B (Layer 2), falling back to deterministic template generation if both providers are unreachable.

---

## 3. 🚢 Production Deployment Guide

Deploy using your preferred production stack: **Supabase + Render + Vercel**.

### Step 1: Database Setup (Supabase / PostgreSQL)
1. Create a project in [Supabase](https://supabase.com) (or [Neon.tech](https://neon.tech)).
2. In the **SQL Editor**, enable the vector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Retrieve your **Connection Pooler URI**:
   * Under **Settings > Database > Connection Pooling**, select **Mode: Session** (port `5432`, IPv4).
   * Prepend `postgresql+asyncpg://` to the URI:
     ```
     postgresql+asyncpg://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
     ```
   *(Note: The codebase automatically disables prepared statement caches when connecting via Supabase or Neon poolers).*

---

### Step 2: Backend Setup (Render Web Service)
1. Create a new **Web Service** on [Render](https://render.com) linked to your repository.
2. Configure settings:
   * **Root Directory:** `backend`
   * **Runtime:** `Docker` (Render automatically uses [`backend/Dockerfile`](backend/Dockerfile))
   * **Health Check Path:** `/health`
3. Configure Environment Variables:
   * `DATABASE_URL`: Your Supabase/Neon connection string (`postgresql+asyncpg://...`)
   * `SECRET_KEY`: A 64-character random string (`openssl rand -hex 32`)
   * `GEMINI_API_KEY`: Your Google Gemini API key
   * `GROQ_API_KEY`: *(Optional)* Your Groq API key for L2 failover
   * `CORS_ORIGINS`: `["http://localhost:3000","https://<your-app>.vercel.app"]`
   * `STORAGE_BACKEND`: `local` *(or `s3` with AWS credentials)*
4. Click **Deploy Web Service**. Render binds to `$PORT` automatically.

---

### Step 3: Frontend Setup (Vercel)
1. Import the repository into [Vercel](https://vercel.com).
2. Configure project settings:
   * **Root Directory:** `frontend`
   * **Framework Preset:** Next.js
3. Add Environment Variable:
   * `NEXT_PUBLIC_API_URL`: `https://<your-render-service>.onrender.com` *(no trailing slash)*
4. Click **Deploy**. Update `CORS_ORIGINS` in Render with the final assigned Vercel URL.

---

### ⚙️ Complete Environment Variable Reference

| Variable | Target Layer | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | PostgreSQL async URI with `postgresql+asyncpg://` | `postgresql+asyncpg://postgres:pass@host:5432/db` |
| `SECRET_KEY` | Backend | Cryptographic secret for signing JWT tokens | `b3f8...64charHex` |
| `ALGORITHM` | Backend | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | Session token duration | `1440` (24 hours) |
| `CORS_ORIGINS` | Backend | Allowed frontend origins (JSON array or CSV) | `["https://app.vercel.app","http://localhost:3000"]` |
| `GEMINI_API_KEY` | Backend | Primary LLM intelligence key | `AIzaSy...` |
| `GROQ_API_KEY` | Backend | Optional failover LLM key | `gsk_...` |
| `REDIS_URL` | Backend | Redis instance for ARQ queue | `redis://localhost:6379/0` *(falls back inline)* |
| `STORAGE_BACKEND` | Backend | Ingestion file storage target | `local` *(or `s3`)* |
| `STORAGE_LOCAL_PATH` | Backend | Local directory for uploaded files | `uploads` |
| `NEXT_PUBLIC_API_URL` | Frontend | Target API gateway URL for Next.js client | `https://pii-backend.onrender.com` |

---

## 4. 🔌 API & Feature Reference

Every endpoint is scoped under `/api/v1` with automatic OpenAPI documentation available at `/docs`:

| Endpoint | Method | Role Guard | Description |
| :--- | :---: | :--- | :--- |
| `/api/v1/auth/login` | `POST` | Public | Authenticates credentials or grants 1-click Demo token |
| `/api/v1/projects` | `GET/POST` | Authenticated | Lists tenant projects or initializes new project baseline |
| `/api/v1/upload/preview` | `POST` | `CanUpload` | Parses CSV/XLSX/PDF/DOCX into schema preview without saving |
| `/api/v1/upload/commit` | `POST` | `CanUpload` | Persists file, creates upload record, and enqueues parsing |
| `/api/v1/analysis/{project_id}` | `POST` | Authenticated | Triggers CPM graph calculation, risk scoring & 1K Monte Carlo |
| `/api/v1/simulation/run` | `POST` | `CanSimulate` | Simulates delay recovery (crew, vendor change, parallelizing) |
| `/api/v1/simulation/compound/{project_id}`| `POST` | `CanSimulate` | Stacks two scenarios to calculate combined synergy days |
| `/api/v1/compliance/check` | `POST` | Authenticated | Audits chunked specifications against TIA-942 Tier III |
| `/api/v1/actions` | `GET/POST` | `CanApprove` | Manages Kanban action lifecycle (pending $\rightarrow$ approved $\rightarrow$ completed) |
| `/api/v1/report/pdf` | `POST` | Authenticated | Compiles executive PDF audit report using ReportLab |
| `/api/v1/ws/{project_id}` | `WSS` | Public/Token | Streams live ingestion, embedding, and simulation progress |

---

## 5. 📸 Visual Walkthrough & System Diagrams

The project includes pre-rendered system architecture and workflow visual assets located in [`backend/scratch/`](backend/scratch/):

| System Architecture | User Journey Flow | Full Ingestion Workflow |
| :---: | :---: | :---: |
| ![Architecture](backend/scratch/diagram_architecture.png) | ![User Journey](backend/scratch/diagram_user_journey.png) | ![Workflow](backend/scratch/diagram_workflow.png) |

---

## 6. 🧪 Testing & Future Roadmap

### Verification Suite
Run the 91-test verification suite covering CPM topological sorting, Monte Carlo distributions, schema mapping, and tenant isolation:
```bash
cd backend
pytest tests/ -v
```

### Roadmap
* [x] **Phase 1:** Core CPM scheduling, float calculations, and 1,000-run Monte Carlo simulations.
* [x] **Phase 2:** Multi-format file ingestion (CSV, XLSX, PDF, DOCX) with adaptive fuzzy/semantic mapping.
* [x] **Phase 3:** Multi-tenant pgvector RAG with Gemini L1 / Groq L2 failover and Decision Memory.
* [ ] **Phase 4:** Direct Primavera P6 XML and Autodesk BIM 360 API connectors.
* [ ] **Phase 5:** 3D digital-twin progress heatmaps synchronized with CPM critical-path states.
