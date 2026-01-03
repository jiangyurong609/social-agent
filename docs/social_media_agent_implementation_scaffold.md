# Social Media Agent — Implementation Prompts & File-by-File Scaffold
**Purpose:** This document is *only* the actionable scaffold for a coding agent (Codex / Claude Code).  
It defines the exact repo tree, what goes in each file, and TODO blocks to implement immediately.

> Assumptions:
> - Monorepo using **pnpm** + **TypeScript**
> - Cloudflare Workers/Durable Objects (Wrangler)
> - Cloudflare D1 + R2 + KV + Queues
> - Chrome Extension (MV3)
> - Optional Apify Actors (Node + Playwright)

---

## 0) “Do this first” meta-prompt for the coding agent

**Meta-prompt (copy/paste into Codex/Claude Code):**
1) Create the repo tree exactly as specified below.
2) Initialize package.json, pnpm-workspace.yaml, tsconfig bases.
3) Implement compile + lint + test pipelines.
4) Implement backend API skeleton + RunDO state machine + DB migrations.
5) Implement extension auth + polling + step runner on a test page.
6) Add LinkedIn adapter skeleton with placeholder steps.
7) Ensure `pnpm test` passes with basic unit tests for schemas + step runner.

Constraints:
- Keep all modules small, typed, and testable.
- Prefer zod for request validation.
- Never store raw platform cookies or passwords.
- Always log trace events with correlation IDs.

Deliverables:
- Working dev environment: `pnpm dev` for dashboard + workers, `pnpm build`, `pnpm test`.
- Minimal “hello workflow” run end-to-end with dummy executor.
- Extension can poll backend and execute DSL on `https://example.com`.

---

## 1) Exact repository tree

```
social-media-agent/
  README.md
  THIRD_PARTY_NOTICES.md
  pnpm-workspace.yaml
  package.json
  tsconfig.base.json
  .editorconfig
  .gitignore

  apps/
    api-worker/
      wrangler.toml
      package.json
      tsconfig.json
      src/
        index.ts
        routes/
          workflows.ts
          runs.ts
          connections.ts
          approvals.ts
          schedules.ts
          extension.ts
          executors_apify.ts
        middleware/
          auth.ts
          validate.ts
          rate_limit.ts
          errors.ts
        db/
          d1.ts
          migrations/
            0001_init.sql
          queries/
            workflows.sql.ts
            runs.sql.ts
            connections.sql.ts
            audit.sql.ts
        storage/
          artifacts.ts
          r2.ts
          kv.ts
        observability/
          trace.ts
          audit.ts
        config.ts
        types.ts

    orchestrator-worker/
      wrangler.toml
      package.json
      tsconfig.json
      src/
        index.ts
        queue_consumer.ts
        durable/
          run_do.ts
          session_do.ts
        services/
          runner.ts
          dispatcher.ts
          retries.ts
          timeouts.ts
          approvals.ts
        db/
          d1.ts
        config.ts

    scheduler-worker/
      wrangler.toml
      package.json
      tsconfig.json
      src/
        index.ts
        cron.ts
        db/
          d1.ts
        config.ts

    dashboard/
      package.json
      tsconfig.json
      src/
        main.tsx
        app.tsx
        api/
          client.ts
          hooks.ts
        pages/
          runs.tsx
          workflows.tsx
          connections.tsx
          schedules.tsx
          run_detail.tsx
        components/
          layout.tsx
          trace_viewer.tsx
          approval_modal.tsx
          connection_card.tsx
        styles/
          app.css

    extension/
      package.json
      tsconfig.json
      manifest.json
      src/
        background/
          service_worker.ts
          api.ts
          auth.ts
          poller.ts
          action_queue.ts
        content/
          injector.ts
          step_runner.ts
          dom.ts
          selectors.ts
        ui/
          popup.html
          popup.ts
          popup.css
          confirm.html
          confirm.ts
          confirm.css
        shared/
          types.ts
          storage.ts
          crypto.ts

  packages/
    schemas/
      package.json
      tsconfig.json
      src/
        index.ts
        platform.ts
        workflow.ts
        action.ts
        trace.ts
        policy.ts

    workflow-core/
      package.json
      tsconfig.json
      src/
        index.ts
        compiler/
          graph_to_ts.ts
        runtime/
          engine.ts
          node.ts
          registry.ts
          idempotency.ts
        nodes/
          draft_post.ts
          rewrite_for_platform.ts
          approve_content.ts
          policy_gate.ts
          publish_batch.ts

    executors/
      package.json
      tsconfig.json
      src/
        index.ts
        executor.ts
        router.ts
        api_executor.ts
        cloud_browser_executor.ts
        extension_executor.ts
        errors.ts

    adapters/
      package.json
      tsconfig.json
      src/
        index.ts
        adapter.ts
        registry.ts
        linkedin/
          index.ts
          capabilities.ts
          steps/
            send_dm.v1.json
            publish_post_text.v1.json
          selectors/
            linkedin.v1.json
        x/
          index.ts
          capabilities.ts
          steps/
            publish_post_text.v1.json
          selectors/
            x.v1.json

    policy/
      package.json
      tsconfig.json
      src/
        index.ts
        policy_engine.ts
        quotas.ts
        lint.ts

    observability/
      package.json
      tsconfig.json
      src/
        index.ts
        trace_emitter.ts
        logger.ts

    shared/
      package.json
      tsconfig.json
      src/
        index.ts
        uuid.ts
        time.ts
        crypto.ts
        http.ts

  infra/
    apify/
      actors/
        playwright-action-runner/
          package.json
          actor.json
          src/
            main.ts
            step_runner.ts
            playwright.ts
          README.md
      scripts/
        deploy.sh
        local_run.sh

  docs/
    IMPLEMENTATION_SCAFFOLD.md   # this file
    DESIGN.md                    # architecture blueprint (separate doc)

  scripts/
    dev.sh
    lint.sh
    test.sh
```

---

## 2) Per-file responsibilities + TODO blocks

### Root files
#### `README.md`
- Overview
- Local dev instructions
- High-level architecture diagram (ASCII)
- Security principles

**TODO:**
- [ ] Add quickstart: `pnpm i`, `pnpm dev`
- [ ] Add extension load instructions (Chrome dev mode)
- [ ] Add environment variables summary

#### `THIRD_PARTY_NOTICES.md`
- Track licenses and attributions

**TODO:**
- [ ] Add BubbleLab/BubbleFlow reference
- [ ] Add any copied code notices

#### `pnpm-workspace.yaml`
**TODO:**
- [ ] Include `apps/*` and `packages/*`

#### `tsconfig.base.json`
**TODO:**
- [ ] Strict TS, ES2022 target, moduleResolution bundler/node as needed

---

## 3) Shared types & schemas (packages/schemas)

### `packages/schemas/src/platform.ts`
Defines:
- Platform enum
- Action enum
- ExecutionMode enum
- Capability type

**TODO:**
- [ ] Add `Platform = z.enum([...])`
- [ ] Add `ExecutionMode = z.enum(["api","cloud_browser","extension_browser"])`
- [ ] Add `Action = z.enum([...])`

### `packages/schemas/src/action.ts`
Defines:
- `ActionRequest<T>`
- `ActionResult`
- `Evidence`

**TODO:**
- [ ] zod schemas for request/response
- [ ] error taxonomy

### `packages/schemas/src/workflow.ts`
Defines:
- Graph schema: nodes, edges, versions
- NodeRun/WorkflowRun statuses

**TODO:**
- [ ] zod validation
- [ ] JSONPath-like input binding helper types

### `packages/schemas/src/trace.ts`
Defines:
- trace event union types

**TODO:**
- [ ] add event types: NodeStarted/Completed, ActionDispatched, etc.

### `packages/schemas/src/policy.ts`
Defines:
- policy rules schema
- quotas schema

**TODO:**
- [ ] required confirmation rules
- [ ] per-platform quotas

### `packages/schemas/src/index.ts`
Re-export everything.

---

## 4) Workflow runtime (packages/workflow-core)

### `packages/workflow-core/src/runtime/node.ts`
Defines:
- `NodeContext`, `Node<I,O>` interface

**TODO:**
- [ ] implement context fields used by workers
- [ ] include artifact helpers

### `packages/workflow-core/src/runtime/registry.ts`
Node registry (type → constructor)

**TODO:**
- [ ] `registerNode(type, factory)`
- [ ] `createNode(type)` with validation

### `packages/workflow-core/src/runtime/engine.ts`
Executes graph in-order, supports basic branching and fan-out.

**TODO:**
- [ ] topological execution
- [ ] persist node outputs by calling ctx.artifacts.putJson
- [ ] emit trace events via ctx.logger
- [ ] concurrency control for batch publish

### `packages/workflow-core/src/runtime/idempotency.ts`
Idempotency keys for actions.

**TODO:**
- [ ] derive stable key: runId + nodeId + platform + action + hash(payload)

### `packages/workflow-core/src/compiler/graph_to_ts.ts`
Compiles graph JSON → TypeScript class (exportable).

**TODO:**
- [ ] generate file text
- [ ] write unit tests for stable output (snapshot)

### Node implementations (starter)
- `nodes/draft_post.ts`: placeholder (no LLM yet) returns template text
- `nodes/approve_content.ts`: yields WAITING_APPROVAL state by throwing a typed “NeedsApprovalError”
- `nodes/policy_gate.ts`: checks quotas
- `nodes/publish_batch.ts`: routes to executors

**TODO:**
- [ ] keep nodes deterministic; external calls happen in executors

---

## 5) Executors (packages/executors)

### `packages/executors/src/executor.ts`
Defines:
- `Executor.execute(req): Promise<ActionResult>`

**TODO:**
- [ ] add base error type
- [ ] add timeout wrapper

### `packages/executors/src/router.ts`
Decides mode based on capabilities and policy.

**TODO:**
- [ ] implement routing algorithm
- [ ] allow explicit override per connection

### `packages/executors/src/extension_executor.ts`
Backend-side helper:
- stores pending `ActionRequest` for extension
- waits for result (via RunDO state)

**TODO:**
- [ ] enqueue pending action keyed by (userId, requestId)
- [ ] handle “extension offline” retry strategy

### `packages/executors/src/cloud_browser_executor.ts`
Backend-side helper:
- dispatches to Apify actor
- or Cloudflare Browser Rendering

**TODO:**
- [ ] implement Apify dispatch stub now; real integration later
- [ ] verify webhook signatures later

### `packages/executors/src/api_executor.ts`
Stub for official APIs.

**TODO:**
- [ ] scaffold per-platform API modules

---

## 6) Adapters (packages/adapters)

### `packages/adapters/src/adapter.ts`
Defines interface:
- `capabilities()`
- `buildAction(req)` returns steps/apiCall metadata

**TODO:**
- [ ] step templates loaded from JSON
- [ ] variable interpolation allowlist

### `packages/adapters/src/registry.ts`
Registers adapters.

**TODO:**
- [ ] `getAdapter(platform)` with fallback errors

### `packages/adapters/src/linkedin/*`
- `capabilities.ts`: define supported actions + required confirms
- `selectors/linkedin.v1.json`: placeholder selectors
- `steps/send_dm.v1.json`: placeholder step DSL
- `steps/publish_post_text.v1.json`: placeholder step DSL

**TODO:**
- [ ] Start with dummy steps against a test page in dev
- [ ] Later fill real selectors as you validate in extension

### `packages/adapters/src/x/*`
Same skeleton.

---

## 7) Policy engine (packages/policy)

### `policy_engine.ts`
- reads workspace policy
- decides required confirmation
- quotas/cooldowns

**TODO:**
- [ ] implement `check(action, platform, content)` → allow/deny
- [ ] integrate with audit events

### `quotas.ts`
- per workspace/user quotas

**TODO:**
- [ ] implement simple counters in D1
- [ ] return retryAfterSec

### `lint.ts`
- spam heuristics (very basic MVP)

**TODO:**
- [ ] detect repeated content, too many links, etc.

---

## 8) Observability helpers (packages/observability)

### `trace_emitter.ts`
**TODO:**
- [ ] `emit(runId, event)` writes to D1 node_runs/trace table
- [ ] correlate action requests

### `logger.ts`
**TODO:**
- [ ] structured JSON logger helper

---

## 9) Cloudflare backend apps

## 9.1 API Worker (apps/api-worker)

### `src/index.ts`
- router (itty-router or Hono)
- register middleware and routes

**TODO:**
- [ ] attach auth middleware
- [ ] attach request validator

### `src/middleware/auth.ts`
- verifies JWT
- attaches `ctx.user`

**TODO:**
- [ ] implement dev-mode bypass with warning

### `src/middleware/validate.ts`
- zod validate body/query

**TODO:**
- [ ] consistent error response format

### `src/routes/workflows.ts`
CRUD workflows.

**TODO:**
- [ ] create workflow
- [ ] create version
- [ ] get latest version

### `src/routes/runs.ts`
Start runs, list runs, get run status.

**TODO:**
- [ ] POST /workflow-runs triggers orchestrator RunDO
- [ ] GET /runs/{id} reads D1

### `src/routes/approvals.ts`
Submit approval payload.

**TODO:**
- [ ] POST approval sends event to RunDO

### `src/routes/extension.ts`
Extension poll/result endpoints.

**TODO:**
- [ ] GET poll: fetch pending actions for user
- [ ] POST result: validate and forward to RunDO

### `src/routes/executors_apify.ts`
Receives Apify results.

**TODO:**
- [ ] verify signature header (later)
- [ ] forward to orchestrator

### `src/db/migrations/0001_init.sql`
Create tables listed in design doc.

**TODO:**
- [ ] write full schema
- [ ] add indexes: runs(status), node_runs(run_id), jobs(scheduled_for)

### `src/storage/artifacts.ts`
**TODO:**
- [ ] R2 wrapper: put/get
- [ ] artifact metadata insert into D1

### `src/observability/trace.ts`
**TODO:**
- [ ] helper to emit trace events

### `src/observability/audit.ts`
**TODO:**
- [ ] helper to write audit events

---

## 9.2 Orchestrator Worker (apps/orchestrator-worker)

### `src/index.ts`
- fetch handler that routes to DOs and accepts callbacks

**TODO:**
- [ ] endpoints: `/run/{runId}/event`

### `src/durable/run_do.ts`
Core orchestration.

**TODO (MVP order):**
- [ ] implement `StartRun` event
- [ ] load workflow version graph from D1
- [ ] execute nodes sequentially using `workflow-core`
- [ ] when node throws NeedsApprovalError → set state WAITING_APPROVAL
- [ ] when node requests extension action → set WAITING_EXTENSION + store pending req
- [ ] handle `ApprovalSubmitted` and resume
- [ ] handle `ExtensionResultReceived` and resume
- [ ] persist node_runs

### `src/durable/session_do.ts`
Tracks extension online presence.

**TODO:**
- [ ] heartbeat endpoint from extension
- [ ] lastSeen timestamp

### `src/services/dispatcher.ts`
Sends ActionRequest to chosen executor.

**TODO:**
- [ ] route to extension executor (pending queue)
- [ ] route to cloud executor (enqueue job)

### `src/queue_consumer.ts`
Consumes queue jobs.

**TODO:**
- [ ] handle `ExecuteActionRequest`
- [ ] handle `RetryTick`

---

## 9.3 Scheduler Worker (apps/scheduler-worker)

### `src/cron.ts`
Runs on cron schedule; enqueues due jobs.

**TODO:**
- [ ] query jobs due
- [ ] enqueue to orchestrator queue

---

## 10) Dashboard (apps/dashboard)

### Minimal screens
- Runs list + run detail + trace viewer
- Workflows list
- Connections list
- Schedules list

**TODO:**
- [ ] implement API client
- [ ] add trace viewer with SSE
- [ ] add approval modal

---

## 11) Chrome Extension (apps/extension)

### `manifest.json`
MV3 manifest with:
- background service worker
- content scripts on allowed domains (initially example.com, later social domains)
- permissions: storage, tabs, scripting, activeTab

**TODO:**
- [ ] minimize permissions
- [ ] host permissions strict allowlist

### Background files
#### `background/service_worker.ts`
- init auth
- start poller
- route messages from UI → queue

**TODO:**
- [ ] implement message bus

#### `background/poller.ts`
- periodic poll `/v1/extension/poll`

**TODO:**
- [ ] backoff on errors
- [ ] mark extension online heartbeat

#### `background/action_queue.ts`
- stores pending actions
- ensures at-most-once local execution

**TODO:**
- [ ] local storage persistence

#### `background/auth.ts`
- device code / PKCE auth

**TODO:**
- [ ] stub dev token first
- [ ] implement real flow later

### Content scripts
#### `content/injector.ts`
- injects step runner into current tab

**TODO:**
- [ ] ensure domain allowlist check

#### `content/step_runner.ts`
- executes DSL step list

**TODO:**
- [ ] implement core step types: goto, waitFor, click, type, assertText, userConfirm
- [ ] return structured result

#### `content/dom.ts`
- helpers: query selector with retries, scroll into view, safe click

**TODO:**
- [ ] robust click (dispatch events)

### UI
#### `ui/popup.ts`
- show status
- allow manual “run pending action now”
- show last errors

#### `ui/confirm.ts`
- renders userConfirm modal for sensitive actions

**TODO:**
- [ ] always show preview content + target

---

## 12) Apify actor (infra/apify/actors/playwright-action-runner)

### `src/main.ts`
- loads ActionRequest
- loads steps
- executes in Playwright
- uploads evidence
- posts ActionResult to backend webhook

**TODO:**
- [ ] implement Playwright step runner mirroring extension runner
- [ ] env vars: BACKEND_WEBHOOK_URL, BACKEND_TOKEN, ACTOR_VERSION

---

## 13) First commit plan (granular)

### Commit 1: Monorepo scaffold
- workspace config, base tsconfig, lint rules
- empty apps/packages with build scripts

### Commit 2: schemas package
- Platform/action/workflow schemas
- unit tests

### Commit 3: workflow-core skeleton
- registry + engine + dummy nodes
- unit tests

### Commit 4: api-worker skeleton + D1 migration
- routes stubs + error format
- migrations + local dev instructions

### Commit 5: orchestrator DO MVP
- RunDO executes “hello workflow”
- store node_runs + artifacts placeholders

### Commit 6: extension MVP (test page)
- auth stub + poll + run steps on example.com

### Commit 7: end-to-end hello
- start workflow → triggers extension action → receives result → completes run

---

## 14) “Exact TODO blocks” to paste into code

### Standard TODO header for each file
```ts
/**
 * TODO(MVP):
 * 1) Define exports and types.
 * 2) Implement minimal happy-path.
 * 3) Add unit tests.
 * 4) Add error handling + trace logs.
 * 5) Keep secrets out of logs.
 */
```

### Standard error response format (API)
```ts
export function errorResponse(status: number, code: string, message: string, details?: any) {
  return new Response(JSON.stringify({ ok: false, error: { code, message, details } }), {
    status,
    headers: { "content-type": "application/json" }
  });
}
```

### Standard trace event shape
```ts
export type TraceEvent =
  | { t: "RunStarted"; runId: string; at: string }
  | { t: "NodeStarted"; runId: string; nodeId: string; at: string; inputRef?: string }
  | { t: "NodeCompleted"; runId: string; nodeId: string; at: string; outputRef?: string }
  | { t: "ActionRequested"; runId: string; nodeId: string; requestId: string; platform: string; action: string; mode: string; at: string }
  | { t: "ActionResultReceived"; runId: string; requestId: string; ok: boolean; at: string; error?: any };
```

---

## 15) Final “prompt pack” for coding agents (use iteratively)

### Prompt A: Create scaffold and build
“Create the repo tree as in docs/IMPLEMENTATION_SCAFFOLD.md, initialize pnpm workspace, ensure `pnpm -r build` works.”

### Prompt B: Implement schemas
“Implement packages/schemas with zod validation and unit tests.”

### Prompt C: Implement workflow engine
“Implement workflow-core runtime engine with deterministic node execution and trace events.”

### Prompt D: Implement RunDO orchestration
“Implement apps/orchestrator-worker RunDO state machine, persist node_runs to D1, support NeedsApproval and NeedsExtension states.”

### Prompt E: Implement extension step runner
“Implement Chrome extension MV3 poller + step runner executing DSL on example.com, return ActionResult.”

### Prompt F: Wire E2E
“Wire API worker to create workflow run, orchestrator triggers extension action, extension returns result, run completes. Add dashboard run detail trace viewer.”

---

**End of scaffold doc.**
