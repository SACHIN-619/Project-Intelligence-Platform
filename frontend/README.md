# Project Impact Intelligence — Frontend

> **Next.js 14 client** for the Project Impact Intelligence (PII) platform — a multi-agent AI system purpose-built for Data Centre EPC project delivery, powered by **Bright AI**.

---

## What This Is

The frontend is the mission-control interface for project teams managing hyperscale data centre construction. It connects to the PII backend to surface AI-generated intelligence — risk alerts, schedule predictions, spec compliance checks, and RAG-powered Q&A — in a structured, role-aware application shell.

**Public homepage** → Light-mode, Framer Motion scroll-zoom landing page  
**Application shell** → Dark-mode, authenticated, full-featured Command Center

---

## Folder Structure

```
frontend/
├── app/
│   ├── page.tsx                          ← Root route: Homepage (public) or redirect to /dashboard
│   ├── layout.tsx                        ← Root layout — fonts, metadata, providers, toast
│   ├── globals.css                       ← Design system: tokens, utilities, component classes
│   │
│   ├── (auth)/                           ← Auth route group (no app shell)
│   │   ├── login/page.tsx                ← Login form + demo-login button
│   │   └── signup/page.tsx               ← Registration form
│   │
│   └── (dashboard)/                      ← App route group (authenticated shell)
│       ├── layout.tsx                    ← Sidebar + top bar + auth guard
│       ├── dashboard/page.tsx            ← Command Center: health score, KPIs, risks
│       ├── upload/page.tsx               ← Smart upload with schema preview
│       ├── intelligence/page.tsx         ← Knowledge Graph + risk engine view
│       ├── health/page.tsx               ← Project health score detail
│       ├── assistant/page.tsx            ← Bright AI chat (RAG Q&A)
│       ├── recovery/page.tsx             ← Recovery scenarios + approval flow
│       ├── actions/page.tsx              ← Action tracker
│       ├── report/page.tsx               ← PDF report generation
│       └── admin/page.tsx                ← Admin panel (admin role only)
│
├── components/
│   ├── home/                             ← Homepage-only components (light mode)
│   │   ├── NodeCanvas.tsx                ← WebGL-style canvas animation engine (3 modes)
│   │   ├── HomeNavbar.tsx                ← Scroll-aware glassmorphic navigation
│   │   ├── HeroScene.tsx                 ← Hero section with typing effect + live graph
│   │   ├── ProblemScene.tsx              ← Problem statement with fragmentation viz
│   │   ├── TransformScene.tsx            ← Light→dark crossfade transition scene
│   │   ├── CapabilitiesScene.tsx         ← 6-capability card grid
│   │   ├── SimulationScene.tsx           ← Interactive Command Center preview
│   │   ├── ScenarioScene.tsx             ← UPS delay scenario: traditional vs PII
│   │   ├── ExplainScene.tsx              ← Explainability + AI recommendation card
│   │   ├── ArchitectureScene.tsx         ← 6-layer architecture stack
│   │   ├── FutureScene.tsx               ← Roadmap timeline
│   │   ├── FinalCTAScene.tsx             ← Final call-to-action with NodeCanvas
│   │   └── utils.ts                      ← Shared useScrollReveal hook
│   │
│   ├── dashboard/                        ← Dashboard-specific widgets
│   │   ├── KPIStrip.tsx                  ← Top KPI metric strip
│   │   ├── RiskCard.tsx                  ← Individual risk item card
│   │   └── ScenarioPanel.tsx             ← Recovery scenario comparison panel
│   │
│   ├── intelligence/                     ← Knowledge graph visualization
│   │   └── GraphView.tsx                 ← ReactFlow graph with risk overlays
│   │
│   ├── upload/                           ← Upload flow
│   │   └── DropZone.tsx                  ← Drag-and-drop with schema mapping preview
│   │
│   ├── recovery/                         ← Recovery scenario UI
│   │   └── RecoveryCard.tsx              ← Scenario comparison + approve/reject
│   │
│   ├── layout/                           ← App shell components
│   │   ├── Sidebar.tsx                   ← Collapsible navigation sidebar
│   │   └── TopBar.tsx                    ← Project selector + user menu
│   │
│   └── ui/                               ← Shared design-system primitives
│       ├── Toast.tsx                     ← Global toast notification system
│       ├── ProgressBar.tsx               ← Animated confidence/progress bar
│       ├── HealthScoreGauge.tsx          ← Circular health score gauge
│       └── LoadingSpinner.tsx            ← Consistent loading states
│
├── contexts/
│   ├── AuthContext.tsx                   ← JWT auth state + loginDemo() + logout()
│   └── ProjectContext.tsx                ← Active project selection + project list
│
├── hooks/
│   └── usePersistedInput.ts              ← localStorage-backed form input persistence
│
├── lib/
│   ├── api.ts                            ← All backend API calls (typed, error-wrapped)
│   ├── auth.ts                           ← JWT decode, role checks, permission guards
│   └── utils.ts                          ← cn(), timeAgo(), sortBySeverity(), formatters
│
├── types/
│   └── index.ts                          ← All TypeScript interfaces (shared with backend)
│
├── tailwind.config.ts                    ← Design system: dark palette, custom tokens
├── next.config.js                        ← API proxy, image domains
├── tsconfig.json                         ← TypeScript config with @ path alias
└── package.json
```

---

## Quick Start

### Prerequisites
- **Node.js 18+** (LTS recommended)
- **npm** or **yarn**
- **Backend running** at `http://localhost:8000` (see `/backend/README.md`)

### Install & Run

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.local.example .env.local
# → Set NEXT_PUBLIC_API_URL if backend is not at localhost:8000

# 4. Start development server
npm run dev

# → App available at http://localhost:3000
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

That's the only required variable. The frontend handles all auth via JWT tokens stored in `localStorage`.

---

## Production Build

```bash
npm run build
npm start
```

---

## Page-by-Page Guide

### `/` — Homepage (Public)
The public landing page. Unauthenticated users see the full homepage.  
Authenticated users are **automatically redirected** to `/dashboard`.

Key features:
- **Scroll-Zoom Portal** — Framer Motion `useScroll` + `useTransform` drives a massive INTELLIGENCE text that scales to `scale(28)` as you scroll, acting as a portal into a background video
- **Typing Effect** — Cycles through AI capabilities: Spec Compliance → Schedule Risk → Supply Chain → Commissioning → Knowledge Queries
- **Animated Stats** — `useInView` triggered counters for real India DC market data
- **Interactive Command Center Preview** — Hover timeline tasks to trigger Bright AI analysis popups
- **UPS Delay Scenario** — Side-by-side: Traditional process vs PII recovery

> Click **"Explore Live Project"** for instant demo login — no signup required.

---

### `/login` — Authentication
- Email/password login
- **Demo Login button** — calls `POST /api/v1/auth/demo-login`, gets a pre-seeded token with full project data
- Redirects to `/dashboard` on success

---

### `/dashboard` — Command Center
The primary application view. Shows:
- **Project Health Score** — 0–100 composite AI-generated score
- **KPI Strip** — Delay days, task count, risk count, Monte Carlo P80/P90 dates
- **Top 5 Risks** — Sorted by severity with expand/collapse detail
- **Recovery Scenarios** — AI-generated options with approve/reject flow
- **Quick Actions** — Upload more data, run analysis, generate report

---

### `/upload` — Smart Upload
- **Drag-and-drop** CSV/Excel/PDF
- **Schema mapping preview** — backend returns column mapping before committing
- Supports: `schedule.csv`, `procurement.csv`, PDF specifications, notes
- Real-time background processing status with polling

---

### `/intelligence` — Knowledge Graph
- **ReactFlow** graph visualizing the project knowledge network
- Nodes: Tasks, Vendors, Equipment, Documents, Risks
- Edges: Dependencies, supply chain links, spec references
- Filter by risk level, node type, critical path status

---

### `/assistant` — Bright AI Chat
- **RAG-powered Q&A** over all indexed project documents
- Response includes:
  - Answer with confidence score
  - Expandable evidence (source file, page, relevant text snippet)
  - Knowledge graph entities referenced
  - Past decision memory context used
- Suggested questions update dynamically based on AI response
- Input persisted via `usePersistedInput` — draft survives page reload

---

### `/health` — Project Health Detail
- Detailed breakdown of the health score components
- Weather risk overlay (live 14-day forecast matched to outdoor tasks)
- Vendor reliability scores (cross-project performance history)

---

### `/recovery` — Recovery Scenarios
- AI-generated recovery action options ranked by impact
- Before/after schedule comparison
- Manager approve / reject flow with reason required on rejection
- Monte Carlo confidence interval before vs after

---

### `/report` — Intelligence Report
- One-click PDF report generation
- Includes: Executive summary, health score, risk register, recommendations, evidence
- Download or preview in-browser

---

### `/admin` — Admin Panel
- Real-time system health metrics
- AI query performance (response time, confidence distribution)
- Vendor score leaderboard
- Estimated hours saved by AI automation

---

## Design System

The app uses a fully custom design system defined in `globals.css` and `tailwind.config.ts`.

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `surface` | `#0C1322` | Primary dark background |
| `surface-container-lowest` | `#070E1D` | Deepest card backgrounds |
| `primary` (blue) | `#3B82F6` | Primary actions, links |
| `secondary` (teal) | `#14B8A6` | AI accent, Bright AI identity |
| `on-surface` | `#DCE2F7` | Body text |
| Homepage white | `#FFFFFF` | Public pages (light mode) |

### Typography
- **Inter** — Body text, UI labels (weights 400–900)
- **JetBrains Mono** — Code, IDs, metrics, confidence scores
- **Outfit** — Display headings on the homepage

### Component Classes (globals.css)
```css
.btn-primary       /* Teal gradient primary button */
.btn-secondary     /* Outlined secondary button */
.input-dark        /* Dark-mode text input */
.badge-teal        /* Teal status badge */
.badge-blue        /* Blue status badge */
.badge-red         /* Red risk badge */
.badge-orange      /* Orange warning badge */
.card-dark         /* Standard dark card container */
.section-label     /* ALL CAPS section label */
```

---

## State Management

No external state library (no Redux, no Zustand). Two React Contexts handle all shared state:

### `AuthContext`
```typescript
interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login(email, password): Promise<{ success, error }>
  loginDemo(): Promise<{ success, error }>   // ← One-click demo
  logout(): void
}
```

### `ProjectContext`
```typescript
interface ProjectContextType {
  projects: Project[]
  activeProject: Project | null
  setActiveProject(project): void
  refreshProjects(): Promise<void>
  isLoading: boolean
}
```

---

## API Client (`lib/api.ts`)

Every backend call is wrapped in a typed `ApiResult<T>` that **never throws**:

```typescript
interface ApiResult<T> {
  data: T | null
  error: string | null   // Plain-English message (never raw JS error)
  status: number
}
```

Key functions:
```typescript
loginDemo()                          // → TokenResponse
createProject({ name })              // → Project
listProjects()                       // → Project[]
uploadFile(projectId, file)          // → UploadResponse
previewUpload(file)                  // → UploadPreview (schema mapping)
getAnalysis(projectId)               // → AnalysisResult (CPM + risks + MC)
getDashboard(projectId)              // → ProjectHealthDashboard
queryProject({ project_id, question }) // → QueryResponse (RAG answer + evidence)
listScenarios(projectId)             // → ScenarioResult[]
autoRecover(projectId)               // → RecoveryOption[]
approveScenario(scenarioId)          // → void
generateReport(projectId)            // → ReportResponse
```

---

## Role-Based Permissions

The `lib/auth.ts` module enforces role permissions client-side (backed by server-side JWT validation):

| Role | Upload | Analyse | Simulate | Approve | Admin |
|------|--------|---------|----------|---------|-------|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `manager` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `engineer` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `quality` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `procurement` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `executive` | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.2.x | App Router, SSR, image optimization |
| `react` | 18.3.x | Core UI library |
| `framer-motion` | 11.2.x | Scroll animations, page transitions, gestures |
| `reactflow` | 11.11.x | Knowledge Graph visualization |
| `recharts` | 2.12.x | Analytics charts (health score, risk trends) |
| `tailwindcss` | 3.4.x | Utility-first CSS |
| `clsx` + `tailwind-merge` | latest | Conditional classname composition |
| `typescript` | 5.4.x | Full type safety |

---

## Homepage Animation Architecture

The homepage uses **Framer Motion** scroll-driven animations throughout:

### Scroll-Zoom Portal (Hero)
```typescript
// 300vh scroll track → sticky 100vh container
const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] })

// Text: scale(1) → scale(28) as you scroll
const scale = useTransform(scrollYProgress, [0, 0.6], [1, 28])

// Video: hidden → visible as text flies past
const videoOpacity = useTransform(scrollYProgress, [0.3, 0.6], [0, 0.85])

// Spring smoothing for inertial feel
const springScale = useSpring(scale, { stiffness: 80, damping: 20 })
```

### Scroll Reveal (All Sections)
All sections use the `<Reveal>` wrapper component:
```tsx
<Reveal delay={0.2}>
  <h2>Content appears when it enters the viewport</h2>
</Reveal>
```

### Animated Counters
Stats count up from 0 when they scroll into view using `useInView` + `requestAnimationFrame`.

---

## NodeCanvas Engine (`components/home/NodeCanvas.tsx`)

A pure canvas animation engine with three operational modes:

| Mode | Behaviour | Used In |
|------|-----------|---------|
| `problem` | Nodes drift apart randomly (chaos) | Problem scene |
| `connecting` | Nodes cluster toward center (ordering) | Transform scene |
| `connected` | Stable constellation with hub-glow (network) | Final CTA scene |

Features: mouse repulsion interaction, visibility-paused (IntersectionObserver), ResizeObserver responsive, reduced-motion safe.

---

## Routing Architecture

```
/ (public)
├── → Homepage (unauthenticated)
├── → /dashboard redirect (authenticated)

/(auth)
├── /login
└── /signup

/(dashboard)            ← Protected: redirects to /login if no valid JWT
├── /dashboard          ← Default app view
├── /upload
├── /intelligence
├── /health
├── /assistant
├── /recovery
├── /actions
├── /report
└── /admin              ← Admin role only
```

---

## Development Notes

### Adding a New Page
1. Create `app/(dashboard)/your-page/page.tsx`
2. Add `'use client'` directive
3. Add route to `components/layout/Sidebar.tsx` nav links
4. Add permissions check via `canUpload(user.role)` etc. if needed

### Adding a New API Call
1. Define type in `types/index.ts`
2. Add function to `lib/api.ts` following the `ApiResult<T>` pattern
3. Call from your component — always destructure `{ data, error }`

### Tailwind Custom Classes
Add component utility classes to `globals.css` under the `@layer components` block, not as arbitrary Tailwind utilities.

---

## Demo Flow (Judges / Evaluators)

```
1. Open http://localhost:3000
   → Lands on the homepage

2. Click "Explore Live Project" (top right or hero CTA)
   → Demo login — no credentials needed
   → Redirects to /dashboard with pre-seeded project data

3. Command Center loads:
   → Health score, KPIs, top risks, recovery options

4. Navigate to /assistant
   → Ask: "What is causing the current schedule delay?"
   → Bright AI answers with evidence citations from uploaded documents

5. Navigate to /intelligence
   → See the project knowledge graph with risk overlays

6. Navigate to /recovery
   → View auto-generated recovery options
   → Approve one as "manager" role

7. Navigate to /report
   → Generate and download the PDF intelligence report
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot reach the server` | Ensure backend is running at `localhost:8000` |
| Blank page after login | Check `NEXT_PUBLIC_API_URL` in `.env.local` |
| `TypeError: Cannot read useAuth` | Ensure page is inside `(dashboard)` route group |
| TypeScript errors in `HealthScoreGauge.tsx` | Pre-existing, does not affect runtime |
| Hot reload not working | Delete `.next/` folder and restart `npm run dev` |

---

## Scripts

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm start        # Start production server
npm run lint     # ESLint check
```

---

## Architecture Decisions

| Decision | Reason |
|----------|--------|
| Next.js App Router | Route groups, layouts, server/client split |
| No global state library | Two contexts are sufficient; keeps bundle lean |
| Framer Motion (not GSAP) | Already in project, React-native API, tree-shakable |
| `ApiResult<T>` wrapper | Prevents uncaught promise rejections; enforces plain-English errors |
| `usePersistedInput` hook | AI chat draft survives navigation without any backend round-trip |
| Client-side role check + server JWT | Defense in depth; UI hides actions the user can't perform |
| Dark mode via `class` strategy | Allows homepage to be fully light while app shell stays dark |

---

## Related

- **Backend README** → `../backend/README.md`
- **Backend API docs** → `http://localhost:8000/docs` (Swagger UI, when backend is running)
- **Design system tokens** → `tailwind.config.ts` + `app/globals.css`
- **TypeScript types** → `types/index.ts`

---

*Project Impact Intelligence — Built for ET AI Hackathon 2.0*  
*Powered by Bright AI · Data Centre EPC Intelligence*
