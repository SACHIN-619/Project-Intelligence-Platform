# Project Impact Intelligence — Frontend Command Center

> **Mission-Control Web Interface** for Project Impact Intelligence (PII) — built with **Next.js 14 App Router, TypeScript, Tailwind CSS, and React Flow** for real-time EPC Data Centre intelligence.

---

## 🎨 User Experience Architecture

The frontend provides two distinct visual experiences:
1. **Public Landing Experience (`/`)**: A high-impact, light-mode showcase detailing the EPC data center delivery crisis, system capabilities, live canvas animations (`NodeCanvas`), and interactive recovery demonstrations.
2. **Authenticated Command Center (`/(dashboard)/*`)**: A dark-mode, high-density dashboard engineered for EPC project managers, planning directors, and site engineers.

---

## 📁 Directory Structure & Key Modules

```
frontend/
├── app/
│   ├── page.tsx                          ← Public Landing Page (interactive canvas + capabilities)
│   ├── layout.tsx                        ← Root layout (fonts, theme, global toast & auth providers)
│   ├── globals.css                       ← Design system tokens, Tailwind directives, dark mode styling
│   │
│   ├── (auth)/                           ← Authentication Views
│   │   ├── login/page.tsx                ← Email/password login with one-click "Try Demo" login
│   │   └── signup/page.tsx               ← New organization registration flow
│   │
│   └── (dashboard)/                      ← Protected Application Shell
│       ├── layout.tsx                    ← Responsive sidebar navigation, top bar, & auth guard
│       ├── dashboard/page.tsx            ← Executive Command Center (health gauge, KPIs, urgent risks)
│       ├── upload/page.tsx               ← File dropzone with instant schema mapping preview
│       ├── intelligence/page.tsx         ← Knowledge Graph & critical path DAG view
│       ├── health/page.tsx               ← Deep-dive composite health metrics (schedule, risk, vendor)
│       ├── assistant/page.tsx            ← Natural-language AI RAG assistant
│       ├── recovery/page.tsx             ← Scenario simulator & interactive compound recovery builder
│       ├── actions/page.tsx              ← Kanban board for approved recovery interventions
│       ├── report/page.tsx               ← Automated PDF audit & executive report generation
│       └── admin/page.tsx                ← Cross-project vendor scoring & system diagnostics
│
├── components/
│   ├── home/                             ← Landing page visual scenes (Hero, Problem, Architecture)
│   ├── dashboard/                        ← Metric strips, risk cards, and scenario widgets
│   ├── intelligence/                     ← React Flow dependency graph with critical path highlighting
│   ├── upload/                           ← Drag-and-drop file upload with column confirmation
│   ├── recovery/                         ← Scenario comparison and approval cards
│   ├── layout/                           ← App shell (collapsible Sidebar, active project TopBar)
│   └── ui/                               ← Reusable UI atoms (gauges, progress bars, toasts, badges)
│
├── contexts/
│   ├── AuthContext.tsx                   ← JWT token storage, user roles, and login/logout state
│   └── ProjectContext.tsx                ← Multi-project switching and active project persistence
│
├── hooks/
│   ├── useWebSocket.ts                   ← Auto-reconnecting WebSocket client for real-time events
│   └── useToast.ts                       ← Global notification triggers
│
├── lib/
│   ├── api.ts                            ← Type-safe API client mapped 1:1 to FastAPI endpoints
│   └── auth.ts                           ← Cookie & LocalStorage token persistence helpers
│
└── types/
    └── index.ts                          ← Strongly typed TypeScript domain models & API responses
```

---

## ⚡ Core Frontend Features

### 1. Interactive Critical Path Knowledge Graph (`React Flow`)
* Visualizes complex multi-thousand-day construction tasks as an interactive Directed Acyclic Graph (DAG).
* Highlights the critical path in real-time, displays node floats, and colors tasks by delay severity.

### 2. Smart Ingestion & Schema Mapper Preview
* Drag and drop CSV, XLSX, PDF, or DOCX files.
* Displays a live mapping preview before commit, showing auto-detected columns, confidence scores, and unmapped fields.

### 3. Real-Time Pipeline Progress via WebSockets
* Listens to `/api/v1/ws/{project_id}` via `useWebSocket.ts`.
* Dynamically streams parsing progress, embedding status, and Monte Carlo completion without needing page refreshes.

### 4. Interactive Recovery Simulation
* Compare baseline versus recovery options side-by-side.
* Stack two recovery options (e.g., *Backup Vendor + Fast-track Commissioning*) to immediately see calculated synergy days and revised P80 finish dates.

---

## 🚀 Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env.local` file (ignored by git):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🚢 Deploying to Vercel

1. Import your GitHub repository into **Vercel**.
2. Set the **Root Directory** to `frontend`.
3. Add the environment variable:
   * `NEXT_PUBLIC_API_URL`: Your deployed Render backend URL (e.g. `https://pii-backend.onrender.com`).
4. Click **Deploy**.
