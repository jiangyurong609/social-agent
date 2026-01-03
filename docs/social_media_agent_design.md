# Social Media Agent — Comprehensive System Design
*(Cloudflare backend • dual execution: Apify/Playwright cloud + Chrome Extension “in-user-browser”)*

**Primary use case:** You authenticate to your social accounts in a normal browser, then the agent can:
- Draft / review / schedule content.
- Publish to multiple platforms: **Facebook, Instagram, TikTok, X, Xiaohongshu, LinkedIn**.
- Send LinkedIn messages to specific profiles (with strict safety/consent controls).

**Key product constraint:** Support **two execution paths** for actions:
1) **Cloud-run** (Apify Actors and/or Playwright runners, optionally Cloudflare Browser Rendering)
2) **User-run** (Chrome extension that operates inside the user’s authenticated session)

This doc is written so a coding agent (Codex / Claude Code) can implement it with minimal additional clarification.

---

## 0) Reality check: platform policies & risk boundaries (must-have)
Many platforms restrict “UI automation” and messaging, and may require:
- Official APIs + approved app review for posting/messaging
- Strict rate limits / anti-spam protections
- MFA, CAPTCHA, and bot detection

**Design stance:**
- Prefer **official APIs** when available and permitted.
- Treat **UI automation** as a user-consented fallback (especially via Chrome extension where the user is *present* and logged in).
- Provide a “Policy Gate” that can disable unsafe actions per platform/account.

---

## 1) Reference inspirations & what we borrow

### BubbleLab workflow model (recommended to borrow)
BubbleLab is an open-source TypeScript-native workflow automation platform; key ideas:
- “Prompt → workflow code” (TypeScript), with composable nodes (“bubbles”)
- Observability and exportable runnable code
- Branching and transformations in a typed graph
License: Apache-2.0. citeturn2view0

**We reuse the concept**: A typed workflow graph compiled to TS, executed by a workflow runtime.

### Cloudflare Browser Rendering + Playwright MCP
Cloudflare provides Browser Rendering and a Playwright fork + docs for running Playwright in Workers, plus a Playwright MCP server for agent-driven automation. citeturn1view3turn0search1turn0search10turn0search7

**We reuse**: Cloudflare Workers as orchestration + optional browser automation capability.

### Apify Actors + Crawlee/Playwright
Apify Actors are packaged automation services with templates and Playwright/Crawlee support; good for scaling, retries, proxies, and operationalizing automation. citeturn0search8turn0search5turn0search2turn0search11turn0search14

**We reuse**: Apify as an execution provider for cloud-run automation (and potentially for scraping/link expansion).

### Open source repos you mentioned (how they fit)
- camel-ai/oasis: a *social media simulator* (agents simulate Twitter/Reddit-like environments), not a posting automation stack. License: Apache-2.0. citeturn3search0turn3search6  
- langchain-ai/social-media-agent: focuses on generating posts (Twitter/X + LinkedIn) and HITL flow; useful for “content planning & approval UX,” not for robust multi-platform automation. License: MIT. citeturn3search1  

---

## 2) High-level architecture

### 2.1 Core idea: “Workflow-first” with pluggable executors
Everything is a workflow graph. Nodes can be:
- **LLM nodes** (draft, rewrite, classify, extract)
- **Tool nodes** (fetch URL, summarize, upload media, post content)
- **Human-in-the-loop nodes** (approve, edit, select account, resolve CAPTCHA/MFA)
- **Execution nodes** (perform platform action via API, cloud browser, or extension)

A workflow run yields:
- Execution trace
- Outputs per node
- Audit log (who/what/when)
- Artifacts (generated text/images, media, screenshots *only if user allows*)

### 2.2 Dual-path action execution
For each “platform action” (e.g., `post`, `schedule`, `dm`):
- **Preferred adapter:** Official API adapter (if available + token)
- **Alternative adapter A:** Cloud-run browser automation (Apify / Cloudflare Browser Rendering)
- **Alternative adapter B:** Chrome extension automation (user’s logged-in session)

This lets you pick the safest/most reliable path per platform/account and degrade gracefully.

---

## 3) Component map (all major components)

### A) Product surfaces
1) **Web App (Dashboard)**
   - Account connections, workflow builder, approvals, scheduling, logs
   - Built on Cloudflare Pages or Workers + frontend framework
2) **Chrome Extension**
   - “Attach to this tab” and “Run action” in authenticated session
   - Secure channel to backend
   - UI for HITL steps (confirm post content, choose page/profile, finalize)
3) **Optional CLI**
   - For developers: run workflows locally, push to Cloudflare, run integration tests.

### B) Cloudflare backend (control plane + workflow runtime)
1) **API Gateway (Workers)**
   - Auth, routing, request validation, rate limiting
2) **Workflow Orchestrator (Workers + Durable Objects)**
   - Manages workflow runs, state machine, retries
3) **Workflow Runtime (BubbleFlow-inspired)**
   - Executes typed nodes, emits traces, stores results
4) **Queues (Cloudflare Queues)**
   - For async jobs: media processing, scheduling, background runs
5) **State storage**
   - KV for configs, R2 for media, D1/Postgres for relational (or D1 for MVP)
   - Durable Objects for “per-run” state, per-user “session registry”
6) **Observability**
   - Execution tracing, structured logs, metrics

### C) Execution providers (data plane)
1) **Apify Provider**
   - Runs Actors for platform automation jobs
   - Stores artifacts in Apify dataset + pushes results back to backend
2) **Cloudflare Browser Rendering Provider**
   - For smaller/edge-latency automation tasks
   - Useful for verifying UI flows, taking screenshots, debugging
3) **Chrome Extension Provider**
   - Executes UI actions with user’s existing cookies/session
   - Best for MFA/CAPTCHA heavy flows and “user-present” constraints

### D) Platform connector layer (core modularization)
A consistent interface per platform:

- `AuthAdapter` (API tokens and/or UI session)
- `PostAdapter` (create post, upload media, schedule)
- `MessageAdapter` (LinkedIn DM, optional others)
- `ProfileAdapter` (resolve page/profile identifiers)
- `Capabilities` (what’s supported via which execution path)

### E) Safety & Compliance
- Policy Gate (per platform, per account)
- Rate limiting + spam heuristics
- Content filters (user-configurable)
- Audit logs + immutable event history
- Human confirmation for sensitive actions (DMs, mass posts)

---

## 4) Data model (minimal but complete)

### 4.1 Entities
- **User**: id, auth providers, plan, org/team
- **Workspace**: members, roles, settings
- **AccountConnection**: platform, accountId, mode (API / Extension / Cloud), token refs, scopes, status
- **Workflow**: id, version, graph definition, params schema
- **WorkflowRun**: id, workflowVersion, status, start/end, trace pointer
- **NodeRun**: id, workflowRunId, nodeId, status, inputs/outputs refs, timings
- **Job**: queued execution (scheduled post, automation run)
- **Artifact**: text/media/screenshot/log bundle, owner, retention policy
- **Policy**: per-workspace rules, allow/deny actions
- **AuditEvent**: immutable event log (action + actor + target)

### 4.2 Storage mapping
- **D1 (MVP)**: Users, Workspaces, Workflows, Runs, Jobs, AuditEvents
- **R2**: Media files, large artifacts, (optional) trace blobs
- **KV**: non-sensitive cached configs, feature flags
- **Durable Objects**:
  - `RunDO`: one per workflow run (state machine)
  - `SessionDO`: per user/platform session registry (only metadata, not raw cookies)

---

## 5) Workflow engine design (BubbleFlow-inspired)

### 5.1 Graph format (JSON + compiled TS)
**Authoring format (stored):**
- Nodes with `type`, `inputs`, `outputs`, `retryPolicy`, `timeout`
- Edges (dataflow + controlflow branches)
- Typed schemas per node

**Compiled runtime:**
- Generates TypeScript class (like BubbleFlow) with `handle(payload)` calling node `.action()` in sequence/branches.
- Keeps code exportable: user can run workflows outside your hosted product if desired.

### 5.2 Node categories
1) **Content nodes**
   - `SummarizeUrlNode`
   - `DraftPostNode`
   - `RewriteForPlatformNode` (length/hashtags/calls-to-action rules)
2) **Approval nodes (HITL)**
   - `ApproveContentNode`
   - `SelectAccountsNode`
   - `ConfirmPostNode` (final preflight)
3) **Media nodes**
   - `FetchMediaNode`
   - `TranscodeVideoNode` (optional)
   - `UploadMediaNode`
4) **Platform action nodes**
   - `PublishPostNode`
   - `SchedulePostNode`
   - `SendLinkedInDmNode`
5) **Ops nodes**
   - `RateLimitNode`
   - `PolicyGateNode`
   - `ErrorClassifierNode`
   - `RetryWithBackoffNode`

### 5.3 Execution semantics
- **Deterministic core**: orchestrator coordinates; nodes should be idempotent when possible.
- **Retries**: limited, exponential backoff, with error-class aware behavior.
- **Compensation**: if a later step fails, optionally undo drafts (if possible) or mark “partial success”.

---

## 6) Dual execution design in detail

### 6.1 Unified “ActionRequest” contract
All platform actions become a single contract:

```ts
export type ExecutionMode = "api" | "cloud_browser" | "extension_browser";

export interface ActionRequest<TPayload> {
  requestId: string;
  userId: string;
  workspaceId: string;
  platform: "facebook" | "instagram" | "tiktok" | "x" | "xiaohongshu" | "linkedin";
  action: "publish_post" | "schedule_post" | "send_dm" | "upload_media" | "resolve_profile";
  mode: ExecutionMode;
  payload: TPayload;
  policyContext: {
    requiresApproval: boolean;
    maxPostsPerDay?: number;
    dmSafetyLevel?: "high" | "standard";
  };
  traceContext: { runId: string; nodeId: string; };
}
```

Every executor returns:

```ts
export interface ActionResult {
  ok: boolean;
  platformPostId?: string;
  platformMessageId?: string;
  evidence?: { url?: string; screenshotArtifactId?: string; };
  error?: { type: string; message: string; retriable: boolean; };
  raw?: Record<string, unknown>; // only if user allows
}
```

### 6.2 Executor A — Official APIs
- Best reliability and compliance when available.
- Uses OAuth tokens stored via Cloudflare secrets + encrypted storage.
- Implements: `ApiExecutor.execute(ActionRequest)`

### 6.3 Executor B — Cloud browser automation (Apify +/or Cloudflare Browser Rendering)
**When to use:**
- No suitable official API
- Scheduling/automation can be done in a headless session
- User does not want to keep a browser open

**Apify path:**
- Backend enqueues `Job` → calls Apify Actor with `ActionRequest`
- Actor runs Playwright/Crawlee script, returns `ActionResult`
- Backend stores artifacts, updates run.

**Cloudflare Browser Rendering path:**
- Good for quick/edge tasks; integrates with Workers using @cloudflare/playwright. citeturn1view3turn0search10
- For agent-driven control, Playwright MCP server can be deployed. citeturn0search1turn0search7

### 6.4 Executor C — Chrome extension automation (user session)
**When to use:**
- MFA/CAPTCHA expected
- “User present” required
- Platform blocks headless/remote automation
- LinkedIn DMs where user must confirm before sending

**Flow:**
1) Backend creates `ActionRequest` with `mode="extension_browser"`
2) Extension polls or receives push (WebSocket/SSE) for pending actions
3) User approves → extension executes Playwright-like steps via:
   - DOM automation scripts + robust selectors
   - Optional “record/replay” library
4) Extension reports `ActionResult` + evidence back to backend

**Security:** Extension never sends raw cookies to backend. It only performs actions and returns results + minimal evidence.

---

## 7) Chrome Extension architecture (comprehensive)

### 7.1 Components
- **Background service worker**
  - Auth with backend (OAuth / device code)
  - Manages queue of pending actions
  - Opens/attaches to tabs
- **Content scripts**
  - Runs per-domain automation
  - Selector engine + step executor
- **UI surfaces**
  - Popup: status, approve/deny, “run now”
  - Side panel (optional): richer HITL (edit post text, choose audience)
  - Notification: “Action needs attention”

### 7.2 Automation “Step DSL”
Extension executes steps defined by platform adapter:

```json
{
  "platform": "linkedin",
  "steps": [
    { "type": "goto", "url": "https://www.linkedin.com/messaging/thread/..." },
    { "type": "waitFor", "selector": "[data-test-id='compose-box']" },
    { "type": "click", "selector": "[data-test-id='compose-box']" },
    { "type": "type", "selector": "div[role='textbox']", "text": "{{message}}" },
    { "type": "click", "selector": "button[type='submit']" },
    { "type": "assertText", "selector": "...", "contains": "{{messageSnippet}}" }
  ]
}
```

**Why a DSL?**
- Same adapters can run in cloud (Playwright) or extension (DOM executor)
- Allows versioned “flows” per platform
- Enables safer review (“what will it click/type?”)

### 7.3 DOM executor strategy
- Prefer accessibility roles/labels when available
- Fallback to robust CSS selectors
- Add “selector packs” per platform version
- Include “UI drift detection” to fail fast and request human intervention

---

## 8) Platform adapters (modularization plan)

### 8.1 Adapter interface
```ts
export interface PlatformAdapter {
  platform: string;
  capabilities(): {
    supportsApi: boolean;
    supportsCloudBrowser: boolean;
    supportsExtensionBrowser: boolean;
    actions: Record<string, { modes: ExecutionMode[] }>;
  };

  buildAction(req: ActionRequest<any>): Promise<{
    apiCall?: { endpoint: string; method: string; body: any };
    cloudPlaywrightScript?: { actorName: string; input: any };
    extensionSteps?: { steps: any[] };
  }>;
}
```

### 8.2 Per-platform folders
- `platforms/linkedin/*`
- `platforms/x/*`
- `platforms/facebook/*`
- `platforms/instagram/*`
- `platforms/tiktok/*`
- `platforms/xiaohongshu/*`

Each contains:
- `capabilities.ts`
- `selectors.ts` (versioned)
- `steps/*.json` (DSL templates)
- `api/*.ts` (if any)
- `tests/*.spec.ts` (integration mocks + smoke tests)

### 8.3 LinkedIn DM specifics
- Require **explicit user approval** by default.
- Enforce:
  - Single-recipient by default
  - Daily DM quota
  - Content safety (no spam patterns)
  - “Preview before send” in extension UI

---

## 9) Backend design on Cloudflare (reference implementation)

### 9.1 Services (Workers)
- `api-worker` (REST/JSON)
- `orchestrator-worker` (Run coordinator + webhooks)
- `scheduler-worker` (cron triggers scheduled jobs)

### 9.2 Durable Objects
- `RunDO(runId)`:
  - owns run state, step progression, retry/timeout
- `SessionDO(userId)`:
  - tracks which platforms have “extension available”, last-seen
  - no sensitive browser data stored

### 9.3 Queues
- `jobs-queue`:
  - messages: `ActionRequest` or `WorkflowRunTick`
  - consumers: orchestrator

### 9.4 Storage
- D1:
  - workflows, runs, node runs, audit events
- R2:
  - media uploads
  - optional screenshots/videos from automation (if user allows)
- KV:
  - adapter configs, feature flags

### 9.5 Auth
- Dashboard + API: OAuth (Auth0/Clerk/etc) or Cloudflare Access
- Extension: device code or OAuth PKCE → short-lived JWT for API calls

---

## 10) Observability & “Explainability”
You need to debug UI drift and platform changes quickly.

**Store for each node/action:**
- start/end, status, retries
- structured logs (step-by-step)
- evidence: optional screenshot or DOM snapshot (user-consented)
- correlation IDs across backend ↔ Apify ↔ extension

Inspired by BubbleLab’s emphasis on tracing and exportability. citeturn2view0

---

## 11) Recommended repo structure (monorepo)

```
repo/
  apps/
    dashboard/                 # Web UI
    api-worker/                # Cloudflare Worker (API)
    orchestrator-worker/       # Orchestration + queues consumers
    scheduler-worker/          # Cron + scheduling
    extension/                 # Chrome extension
  packages/
    workflow-core/             # BubbleFlow-like runtime + DSL compiler
    adapters/                  # platform adapters
    executors/                 # api/cloud_browser/extension_browser executors
    policy/                    # policy gate + rate limit heuristics
    schemas/                   # zod/jsonschema types
    observability/             # tracing helpers
    shared/                    # utilities
  infra/
    wrangler/                  # wrangler configs
    apify/                     # actor templates + deployment scripts
  docs/
    DESIGN.md                  # this doc (generated)
    RUNBOOK.md                 # operational runbook
```

---

## 12) Master execution plan (Codex/Claude Code ready)

### Phase 0 — Foundations (weekend MVP scaffolding)
1) **Monorepo scaffolding** (pnpm + TypeScript)
   - Create Workers apps + Dashboard + Extension skeleton
   - Add shared `schemas` and `workflow-core`
2) **Basic workflow runtime**
   - Define graph schema
   - Implement `RunDO` and `NodeRun` persistence
3) **Observability baseline**
   - Structured logs + trace IDs
   - Run listing UI

**Exit criteria:**
- “Hello workflow” runs end-to-end: Draft → Approval → No-op publish

---

### Phase 1 — Dual execution plumbing (core differentiator)
4) **ActionRequest / ActionResult contract**
5) **Executor implementations**
   - `ExtensionExecutor` (stub): send steps to extension, receive result
   - `CloudBrowserExecutor` (stub): simulate Apify call
6) **Extension MVP**
   - Auth to backend
   - Poll for action
   - Execute a simple “step DSL” on a test page (not a social platform yet)
   - Return result

**Exit criteria:**
- One workflow can trigger an extension-run action and record result.

---

### Phase 2 — LinkedIn (first real platform, best for business)
7) **LinkedIn adapter**
   - `resolve_profile` (search/select by URL)
   - `publish_post` (basic text post) via extension mode first
   - `send_dm` via extension mode with mandatory confirmation
8) **HITL UX**
   - Approve/edit content in dashboard
   - Approve DM send in extension UI
9) **Safety**
   - Policy gate + daily quotas + rate limiter

**Exit criteria:**
- User can post and send a DM on LinkedIn via extension mode safely.

---

### Phase 3 — Apify provider (cloud automation)
10) **Apify Actor template**
    - Accept `ActionRequest`, run Playwright, return `ActionResult`
11) **Backend Apify integration**
    - Trigger actor runs, poll status, ingest results
12) **One cloud-run platform action**
    - Start with a low-risk target (e.g., “fetch profile metadata” or “validate login state”)
    - Then attempt posting where allowed

**Exit criteria:**
- Same workflow can choose extension or Apify execution mode.

---

### Phase 4 — Multi-platform expansion
13) Add adapters incrementally:
- X: text posts + media (API if possible, else UI)
- Instagram/Facebook: prefer official APIs for posting where feasible; extension fallback
- TikTok/Xiaohongshu: likely extension-first due to policy/automation constraints

**Exit criteria:**
- A single workflow can post to 3+ platforms, with per-platform mode selection.

---

### Phase 5 — Workflow composition UX (BubbleLab-inspired)
14) Add a visual builder / import/export:
- Store graphs, compile to TS
- Export runnable workflow code
15) Add “Prompt → workflow” assistant (optional)

**Exit criteria:**
- Users can build/modify flows quickly and export code.

---

## 13) Concrete implementation tasks (tickets)

### 13.1 workflow-core
- [ ] Graph schema + validation (zod)
- [ ] Node interface: `.run(ctx, input) => output`
- [ ] Orchestrator: topological execution + branches
- [ ] RunDO: state machine + retries + timeouts
- [ ] Trace emitter: log events into D1 + optional blob in R2

### 13.2 executors
- [ ] API executor skeleton
- [ ] Cloud browser executor skeleton (Apify + optional Cloudflare Browser Rendering)
- [ ] Extension executor skeleton (push/poll protocol + result ingestion)

### 13.3 extension
- [ ] Auth + secure token storage
- [ ] Poll loop for pending actions
- [ ] Content script step runner
- [ ] UI approvals (popup + modal)
- [ ] “Abort & report” flows

### 13.4 adapters
- [ ] Adapter registry + capability negotiation
- [ ] LinkedIn: selectors + steps + DM flow
- [ ] X: post composer flow
- [ ] Instagram: post flow (likely extension-first)
- [ ] TikTok: upload/post flow (extension-first)
- [ ] Xiaohongshu: extension-first

### 13.5 safety/policy
- [ ] Policy object model
- [ ] Rate limiter
- [ ] DM safety gate
- [ ] Audit event log UI

---

## 14) Testing strategy (must-have for UI automation)
- Unit tests: schema validation, workflow engine determinism
- Integration tests: “step DSL runner” on controlled test pages
- Smoke tests per platform: minimal flows with drift detection
- Canary mode: run a “login-check” daily to detect UI changes early
- Replay: store last successful selector pack version per user

---

## 15) Decision guide: Apify vs “own Playwright” vs extension

### Apify (recommended when)
- You want scale, retries, proxies, and packaged actors
- You accept cloud automation constraints (MFA may be hard)
- You need reliable ops quickly citeturn0search8turn0search5

### Own Playwright on Cloudflare Browser Rendering (recommended when)
- You want automation close to your orchestration layer
- You want MCP-based agent navigation (structured snapshots) citeturn0search1turn1view3

### Chrome extension (recommended when)
- Login/MFA/CAPTCHA are common
- You want “user-consented automation” in their session
- You want best odds against bot detection

**Your best system supports all three** and chooses per-platform/per-account.

---

## 16) About Google “Antigravity” (how it relates)
Google Antigravity is an “agent-first development platform / IDE” (not a social automation runtime). It’s useful as inspiration for *developer experience* and “mission control,” not as a core execution engine for posting. citeturn1view2

---

## 17) Next steps (what I’d implement first)
1) Extension-based LinkedIn posting + DM (safe, user-present)
2) Workflow runtime + HITL approvals in dashboard
3) Add Apify as a cloud execution provider
4) Expand adapters platform by platform

---

# Appendix A — Minimal MVP workflow example (pseudo-TS)
```ts
export class MultiPlatformPostFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: { url?: string; prompt?: string; platforms: string[] }) {
    const draft = await new DraftPostNode({ url: payload.url, prompt: payload.prompt }).action();
    const approved = await new ApproveContentNode({ draft }).action();

    const gated = await new PolicyGateNode({ content: approved.text, platforms: payload.platforms }).action();

    // For each platform: choose execution mode based on capabilities + user settings
    const results = [];
    for (const p of gated.platforms) {
      const mode = await new ChooseModeNode({ platform: p }).action();
      const res = await new PublishPostNode({ platform: p, mode, content: approved }).action();
      results.push(res);
    }
    return { ok: true, results };
  }
}
```

---

# Appendix B — Licensing note (what you can borrow)
- BubbleLab: Apache-2.0 (per repo). citeturn2view0  
- camel-ai/oasis: Apache-2.0 (per repo metadata). citeturn3search6  
- langchain-ai/social-media-agent: MIT (per repo). citeturn3search1  

Always preserve license notices and comply with attribution requirements.

