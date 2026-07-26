# Project Impact Intelligence (PII)

> **ET AI Hackathon 2.0 · Problem Statement 4 · EPC Data Centre Intelligence Platform**  
> **Prize Pool:** ₹10,00,000 · **Built by:** Sachin · Anurag University  
> **Backend Server Stack:** FastAPI, PostgreSQL, Redis, local BGE Embeddings, Gemini AI Layers  
> **Frontend Stack:** Next.js, React Flow, Tailwind CSS, Recharts  

---

## 🏗️ System Architecture & Data Flow (Start-to-End)

```
                            [ USER / CLIENT INTERFACE ]
                                    Next.js SPA
                                         |
                                         v
                            [ FastAPI API GATEWAY ]
                                         |
      +----------------------------------+----------------------------------+
      | (Upload Pipeline)                | (RAG / QA Pipeline)              | (Simulation & Risks)
      v                                  v                                  v
[Schema Mapper]                   [RAG Search Pipeline]              [ProjectGraphEngine]
  ├── Exact Lookup                  ├── Local BGE Embeddings           ├── CPM Scheduler (Float)
  ├── Fuzzy Match (Levenshtein)     └── Cosine Sim Query               ├── Monte Carlo (1K runs)
  └── Semantic Compare (BGE)             |                             ├── Recovery Engine
      |                                  v                                  |
      v                         [Gemini L1 / Groq L2]                       v
[CSV / PDF Parsers]                      |                            [Risk Engine]
  ├── Task Columns                       v                            ├── Weather Forecasts
  └── Tier Standards (TIA-942)    [AI Reasoning Agents]               └── Vendor History
      |                                                                     |
      v                                                                     v
[PostgreSQL & pgvector] <─────────────────────────────────────────────[Decision Memory]
```

---

## ⚡ What Is PII?

Project Impact Intelligence (PII) is a production-grade AI platform that transforms how EPC (Engineering, Procurement, and Construction) project managers understand, forecast, and mitigate schedule risk.

### The Problem It Solves
Traditional EPC project management relies on manually inspecting 500-row Excel schedules, calling suppliers individually, and writing static risk reports that are obsolete by the time they are printed. This process consumes **13+ hours per week** per project manager.

### What PII Does Instead
Upload your project schedule (CSV/XLSX) or technical specification (PDF) and PII instantly:
1. **Performs Schema-Agnostic Ingestion:** Maps columns using exact, fuzzy, or semantic matches and caches your layout structure.
2. **Computes the Critical Path:** Uses CPM graph algorithms to determine task float margins and identify delayed items.
3. **Runs Monte Carlo Simulations:** Forecasts P50/P80/P90 project completion dates using 1,000 PERT-Beta schedule iterations.
4. **Assesses Risks:** Aggregates weather forecasts (Open-Meteo), vendor reliability history, and data confidence.
5. **Audits Compliance:** Assesses specifications against Uptime Tier III and TIA-942 standards and raises Non-Conformance Reports (NCRs).
6. **Recommends Recovery Options:** Synthesizes actionable recovery steps (add crew, switch to backup vendor, parallel tasks).
7. **Maintains a Decision Memory:** Learns from approved and rejected scenarios to refine future recommendations.
8. **Hosts RAG-Powered AI Chat:** Answers natural language project queries instantly.

**The result:** **82+ hours saved** per project — a **97% time reduction** compared to manual schedule analysis.

---

## 📁 Repository Directory Structure

```
PII/
├── backend/                             ← FastAPI Core Server
│   ├── app/
│   │   ├── main.py                      ← Router mounting & startup check
│   │   ├── database.py                  ← SQLAlchemy connection & schema check
│   │   ├── api/                         ← Endpoints (auth, projects, compliance, etc.)
│   │   ├── core/                        ← JWT Security & request logging middleware
│   │   └── services/                    ← AI, Graph Engine, Monte Carlo, RAG pipelines
│   ├── tests/                           ← 91 pytest unit & integration tests
│   └── requirements.txt                 ← Server requirements
│
├── frontend/                            ← Next.js client
│   ├── app/                             ← Pages & routing layout
│   ├── components/                      ← React UI (React Flow graph, charts)
│   ├── contexts/                        ← Auth & Project state contexts
│   ├── lib/                             ← API client fetch logic
│   └── package.json                     ← Frontend configuration
```

---

## 🚀 Quick Start (Local Setup)

Ensure you have **Python 3.12+**, **Node.js 18+**, **PostgreSQL** (with pgvector), and **Redis** running locally.

### 1. Run Backend Services (Docker)
```bash
# Run PostgreSQL with pgvector
docker run -d --name pii_pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16

# Run Redis cache & job queue
docker run -d --name pii_redis -p 6379:6379 redis:7-alpine
```

### 2. Configure & Start Backend
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate   # On Windows

# Install packages
pip install -r requirements.txt
pip install -r requirements-ai.txt
pip install -r requirements-dev.txt

# Configure settings
cp .env.example .env
# Edit .env and set your DATABASE_URL, REDIS_URL, and GEMINI_API_KEY

# Run FastAPI Server (port 8000)
uvicorn app.main:app --port 8000
```
Interactive Swagger API documentation will be available at: http://localhost:8000/docs

### 3. Configure & Start Frontend
```bash
cd ../frontend
npm install

# Run Frontend Client (port 3000)
npm run dev
```
Open http://localhost:3000 in your browser.

---

## 📊 Performance Benchmarks (300-Task Project Chain)

PII includes optimized calculations running sensitivity maps and Monte Carlo simulations in milliseconds:

* **CPM Schedule Calculations:** **~23.91 ms**
* **Monte Carlo Simulation (1,000 iterations):** **~1.22 seconds**
* **Sensitivity Analysis Loop:** **< 3 ms**
* **Next.js Static Compilation:** **100% successful with 0 errors**

---

## 🏆 Innovation Highlights
* **Adaptive Schema Memory:** Learns column aliases on the fly, making it fully schema-agnostic.
* **Vectorized Monte Carlo:** NumPy-driven variance correlation runs sensitivity analysis loops instantly.
* **3-Layer Fallback Chain:** Gracefully degrades from Gemini Pro/Flash -> Groq LLaMA-3.3-70B -> local defaults so the application never fails under API quota limits.
* **Uptime Tier Compliance Checker:** Translates physical documents directly to technical standard checks and NCR recommendations.