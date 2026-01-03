# Social Media Agent — Full Blueprint
**Cloudflare backend + workflow composition (BubbleLab-inspired) + dual execution (Cloud/Extension)**
Version: 0.2 • Date: 2025-12-21 • Audience: builders (Codex / Claude Code)

---

## Table of contents
1. Product scope and non-goals  
2. Operating principles: safety, compliance, reliability  
3. End-to-end architecture overview  
4. Workflow composition model (BubbleLab-inspired)  
5. Execution modes and routing strategy  
6. Detailed component designs  
7. Data model (schemas + tables)  
8. API design (backend endpoints + webhooks + events)  
9. Chrome extension design (protocol + step runner)  
10. Cloud browser design (Apify + optional Cloudflare Browser Rendering)  
11. Platform adapter design (per-platform modularization)  
12. Media pipeline (images/video)  
13. Scheduling and calendars  
14. Observability, auditing, and “evidence” artifacts  
15. Testing & QA (drift detection, canaries, replay)  
16. Security model (threats + mitigations)  
17. Deployment plan (Cloudflare + Apify + CI/CD)  
18. Master execution plan (phased delivery)  
19. Implementation checklists (tickets)  
20. Appendix: DSL specs, example workflows, selector packs, error taxonomy

---

## 1) Product scope and non-goals

### 1.1 Must support (initial)
- **Multi-platform posting**: Facebook, Instagram, TikTok, X, Xiaohongshu, LinkedIn
- **LinkedIn DMs**: message a specific profile (user-confirmed by default)
- **Dual execution modes**:
  - **Cloud-run**: Apify Actors and/or Playwright runner
  - **User-run**: Chrome extension in the user’s authenticated session
- **Workflow-first** composition with reusable blocks
- **Human-in-the-loop** approvals
- **Scheduling** posts in advance (system scheduling, not necessarily platform-native scheduling)
- **Audit logs** and traceable execution

### 1.2 Explicit non-goals (initial)
- High-volume spammy automation (“blast to thousands of accounts”)
- Bypassing CAPTCHAs/bot protections
- Credential harvesting or storing passwords
- Full CRM replacement
- Guaranteed cross-platform parity on every feature day-1 (capability matrix will vary)

---

## 2) Operating principles

### 2.1 Compliance-first
- Prefer official APIs when available and permitted.
- UI automation is a fallback path and should be:
  - Explicitly user-consented
  - Rate-limited
  - Logged and explainable

### 2.2 Safety-first
- Default to “**review before action**” for:
  - Direct messages
  - Posts containing links
  - Posts containing sensitive terms (configurable)
- Enforce per-platform quotas and cooldowns.
- “Kill switch” at workspace/admin level.

### 2.3 Reliability-first
- Design idempotent actions.
- Keep deterministic orchestration; isolate non-determinism in leaf nodes.
- Detect UI drift early; ship selector packs quickly.

---

## 3) End-to-end architecture

### 3.1 Big picture (control plane vs data plane)
**Control plane (Cloudflare):**
- API + Auth
- Workflow definitions & versions
- Orchestrator & schedulers
- Policy engine
- Event/audit storage
- Execution routing

**Data plane (executors):**
- Official API calls
- Cloud browser automation (Apify / Playwright)
- Extension browser automation (user session)

### 3.2 Primary flows (top-level)
1) **Compose → Approve → Publish** (multi-platform)
2) **Compose → Approve → Schedule** (for later)
3) **Compose DM → Confirm in extension → Send DM**
4) **Canary checks** (daily login/compose-check to detect UI drift)

---

## 4) Workflow composition model (BubbleLab-inspired)

### 4.1 Concepts
- **Workflow**: a versioned graph of nodes with typed inputs/outputs.
- **Node**: atomic step (LLM, tool, approval, action).
- **Edge**: control/data dependency.
- **Run**: a single execution instance of a workflow version.
- **Trace**: node-run timeline + logs + evidence artifacts.

### 4.2 Why typed workflows?
- Codex/Claude Code can generate predictable code.
- You can compile workflows to TypeScript for portability.
- You can run deterministic orchestration in Durable Objects.

### 4.3 Graph definition (canonical JSON)
```json
{
  "workflowId": "wf_post_multi",
  "version": 3,
  "name": "Multi-platform Post",
  "nodes": [
    { "id": "n1", "type": "DraftPost", "inputs": { "prompt": "$.input.prompt" } },
    { "id": "n2", "type": "RewriteForPlatform", "inputs": { "draft": "$.n1.text", "platforms": "$.input.platforms" } },
    { "id": "n3", "type": "ApproveContent", "inputs": { "candidate": "$.n2" } },
    { "id": "n4", "type": "PolicyGate", "inputs": { "approved": "$.n3", "platforms": "$.input.platforms" } },
    { "id": "n5", "type": "PublishBatch", "inputs": { "approved": "$.n3", "targets": "$.n4.targets" } }
  ],
  "edges": [
    { "from": "n1", "to": "n2" },
    { "from": "n2", "to": "n3" },
    { "from": "n3", "to": "n4" },
    { "from": "n4", "to": "n5" }
  ]
}
```

### 4.4 Node interface (TypeScript)
```ts
export interface NodeContext {
  runId: string;
  nodeId: string;
  userId: string;
  workspaceId: string;
  nowISO: string;
  logger: (event: any) => Promise<void>;
  artifacts: {
    putText(name: string, content: string): Promise<string>;
    putJson(name: string, obj: unknown): Promise<string>;
    putBinary(name: string, bytes: Uint8Array, mime: string): Promise<string>;
  };
  policy: {
    requireApproval: (action: string, platform: string) => boolean;
    quotaCheck: (key: string) => Promise<{ ok: boolean; retryAfterSec?: number }>;
  };
  executors: {
    api: Executor;
    cloud: Executor;
    extension: Executor;
  };
}

export interface Node<I, O> {
  type: string;
  run(ctx: NodeContext, input: I): Promise<O>;
}
```

### 4.5 Orchestration semantics
- Nodes are executed in topological order.
- Branching:
  - `IfNode` chooses edge paths based on predicate output.
- Fan-out:
  - `PublishBatch` spawns per-platform “child actions” (concurrency-limited).

---

## 5) Execution modes and routing

### 5.1 Modes
- `api`: official API tokens (OAuth)
- `cloud_browser`: remote Playwright (Apify / Cloudflare Browser Rendering)
- `extension_browser`: Chrome extension in authenticated user tab

### 5.2 Mode selection algorithm (deterministic)
Inputs:
- Platform capabilities matrix
- Connection mode availability (token present, extension online, etc.)
- Policy (e.g., “DM must be extension mode”)
- User preference (“prefer extension for LinkedIn”)
- Risk scoring (MFA likely? UI drift risk? time constraints?)

Algorithm:
1) If policy forbids action → stop.
2) If action requires user presence → `extension_browser`.
3) Else if API supported and token valid → `api`.
4) Else if cloud automation allowed → `cloud_browser`.
5) Else if extension online → `extension_browser`.
6) Else → “Needs user action” state.

---

## 6) Detailed component designs

### 6.1 Cloudflare API Worker
Responsibilities:
- Auth (JWT)
- CRUD: workflows, connections, schedules
- Trigger runs (manual, webhook, scheduled)
- Return run status + traces
- Accept executor callbacks (Apify + extension)

Key concerns:
- Request validation (zod)
- Rate limiting per user/workspace
- CORS for extension

### 6.2 Orchestrator Worker + Durable Objects

#### 6.2.1 RunDO state machine
States:
- `CREATED` → `RUNNING` → `WAITING_APPROVAL` → `WAITING_EXTENSION` → `SUCCEEDED/FAILED/CANCELED`

Events:
- `StartRun`
- `NodeCompleted`
- `ApprovalSubmitted`
- `ExtensionResultReceived`
- `ExecutorResultReceived`
- `Timeout`
- `Cancel`

Durable Object holds:
- current node pointer
- node outputs refs (artifact IDs)
- retry counters
- pending action request (if waiting)

#### 6.2.2 Queue consumer
- Consumes `jobs-queue` messages:
  - scheduled runs
  - retries
  - cloud automation jobs

### 6.3 Data storage layer
MVP: Cloudflare D1 + R2 + KV

- D1: relational data, queries for dashboard
- R2: media and big artifacts
- KV: adapter configs + feature flags (non-sensitive)

---

## 7) Data model (schemas + tables)

### 7.1 Canonical schemas (zod-style pseudo)
```ts
export const Platform = z.enum(["facebook","instagram","tiktok","x","xiaohongshu","linkedin"]);

export const AccountConnection = z.object({
  id: z.string(),
  workspaceId: z.string(),
  platform: Platform,
  displayName: z.string(),
  modeAvailable: z.object({
    api: z.boolean(),
    cloud_browser: z.boolean(),
    extension_browser: z.boolean(),
  }),
  tokenRef: z.string().nullable(),      // reference to encrypted secret (not raw token)
  status: z.enum(["active","needs_reauth","disabled"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

### 7.2 D1 tables (MVP)
- `users(id, email, created_at)`
- `workspaces(id, name, owner_user_id)`
- `workspace_members(workspace_id, user_id, role)`
- `connections(id, workspace_id, platform, display_name, token_ref, status, mode_api, mode_cloud, mode_ext, created_at, updated_at)`
- `workflows(id, workspace_id, name, created_at)`
- `workflow_versions(id, workflow_id, version, graph_json, created_at)`
- `workflow_runs(id, workflow_version_id, status, input_json, started_at, ended_at)`
- `node_runs(id, run_id, node_id, status, input_ref, output_ref, started_at, ended_at, error_json)`
- `jobs(id, type, payload_json, status, run_id, scheduled_for, created_at)`
- `artifacts(id, run_id, kind, r2_key, mime, created_at)`
- `audit_events(id, workspace_id, actor_user_id, action, target_json, created_at)`

---

## 8) API design

### 8.1 Authentication
- Dashboard uses normal session auth.
- Extension uses device-code / PKCE flow and receives:
  - short-lived JWT access token (15 min)
  - refresh token (encrypted storage in extension)

### 8.2 REST endpoints (MVP)
**Workflows**
- `POST /v1/workflows` create
- `POST /v1/workflows/{id}/versions` add version
- `GET /v1/workflows/{id}` fetch
- `POST /v1/workflow-runs` start run

**Runs**
- `GET /v1/runs/{runId}` status
- `GET /v1/runs/{runId}/trace` trace events (paged)
- `POST /v1/runs/{runId}/cancel`

**Approvals**
- `POST /v1/runs/{runId}/approvals/{nodeId}` submit approval payload

**Connections**
- `POST /v1/connections` create (API token or extension-mode)
- `GET /v1/connections`
- `POST /v1/connections/{id}/disable`
- `POST /v1/connections/{id}/reauth`

**Scheduling**
- `POST /v1/schedules` create scheduled post run
- `GET /v1/schedules`
- `DELETE /v1/schedules/{id}`

**Extension channel**
- `GET /v1/extension/poll` → returns pending `ActionRequest[]`
- `POST /v1/extension/result` → submit `ActionResult`

**Apify callbacks**
- `POST /v1/executors/apify/result` → submit `ActionResult`

### 8.3 Event stream (recommended)
- Server-Sent Events (SSE) for dashboard:
  - `GET /v1/runs/{runId}/events`
- WebSocket for extension (optional, later):
  - push “pending action”

---

## 9) Chrome extension design

### 9.1 Message protocol
**Poll response**
```json
{
  "pending": [
    {
      "requestId": "req_123",
      "platform": "linkedin",
      "action": "send_dm",
      "payload": { "profileUrl": "...", "message": "..." },
      "steps": { "version": "2025-12-01", "steps": [ ... ] },
      "requiresUserConfirm": true
    }
  ]
}
```

**Result submission**
```json
{
  "requestId": "req_123",
  "ok": true,
  "platformMessageId": "urn:li:msg:...",
  "evidence": { "screenshotArtifactId": "art_789" }
}
```

### 9.2 Step Runner architecture
- Parse steps
- Resolve templated variables (must be explicit allowlist)
- Execute step types:
  - navigation: `goto`
  - interaction: `click`, `type`, `select`, `uploadFile`
  - waiting: `waitFor`, `waitForUrl`, `sleep`
  - assertions: `assertText`, `assertVisible`, `assertUrlContains`
  - diagnostics: `snapshotDom` (optional)
- Hard stop if:
  - unexpected navigation to non-whitelisted domain
  - step exceeds timeout
  - selector not found and no fallback

### 9.3 Selector packs (versioned)
Store `selectors.ts` and `steps/*.json` templates per platform:
- `linkedin/selectors@2025-12-01.json`
- `linkedin/steps/send_dm@2025-12-01.json`
This makes hotfixes possible without shipping a new extension version (if you allow remote config with signature verification).

### 9.4 Safety UI requirements
- Always show a preview before:
  - “Send DM”
  - “Post to multiple accounts”
- Show exactly:
  - target profile/page
  - message/post content
  - attachments
  - “Send” / “Cancel”
- Require explicit user click.

---

## 10) Cloud browser design

### 10.1 Apify Actor template
Actor input:
- `ActionRequest`
- `steps` (same DSL), or a platform-specific script selector

Actor responsibilities:
- Setup Playwright context
- Acquire session (token-based login if allowed; otherwise fail with “NEEDS_EXTENSION”)
- Execute steps
- Capture evidence (screenshots) if enabled
- Return `ActionResult` to backend

### 10.2 Cloudflare Browser Rendering (optional)
Use when:
- small volume
- want tight integration with Workers
- short-lived sessions

Best practice:
- keep heavy automation in Apify (more operational maturity)
- use Cloudflare for quick checks and debugging tasks

---

## 11) Platform adapter design (capabilities + templates)

### 11.1 Capabilities matrix (example)
| Platform | API mode | Cloud browser | Extension | Notes |
|---|---:|---:|---:|---|
| LinkedIn | limited | risky | ✅ best | DMs must be extension w/ confirm |
| X | depends | possible | ✅ | API access constraints vary |
| Instagram | limited | risky | ✅ | prefer official where possible |
| Facebook | limited | risky | ✅ | pages vs profiles differ |
| TikTok | limited | risky | ✅ | upload UI complex |
| Xiaohongshu | limited | risky | ✅ | likely extension-first |

*(Treat this as a living matrix; implement with actual checks.)*

### 11.2 Adapter output contract
Adapters do not “do work”. They return:
- `steps` templates for UI automation
- or `apiCall` parameters
- plus “preflight checks” rules:
  - domain allowlist
  - required user confirm
  - expected page URL patterns

### 11.3 LinkedIn DM adapter (detailed)
Inputs:
- `profileUrl` OR `profileId`
- `message`
- optional `attachment` (future)

Preflight:
- require extension confirm
- quota check: `dm_per_day`
- message lint: spam heuristics

Steps:
1) goto profile
2) click “Message”
3) focus message box
4) type message
5) user confirm
6) click send
7) assert message appears in thread

Outputs:
- messageId if detectable
- evidence screenshot (optional)

---

## 12) Media pipeline

### 12.1 Goals
- Support image/video attachments.
- Enforce platform constraints (aspect ratio, file size).
- Avoid uploading the same file multiple times across platforms unnecessarily.

### 12.2 Components
- `MediaIngestNode`: accept file upload or URL fetch
- `MediaNormalizeNode`: transcode/resize (optional)
- `MediaStore`: R2 with content-addressed keys
- `UploadMediaNode`: per platform, via API or UI steps

### 12.3 Content-addressed storage
Key = SHA256(bytes) + extension:
- `r2://media/{sha256}.mp4`
Benefits:
- dedupe
- consistent references across runs

---

## 13) Scheduling

### 13.1 System scheduling model
- Scheduled job triggers workflow run at time T.
- Publish node executes then.

### 13.2 Execution constraints
- If extension mode is required at publish time, scheduler will:
  - notify user (push) and wait for extension to connect
  - or degrade: postpone with configurable window
  - or fail with “needs user presence”

---

## 14) Observability & auditing

### 14.1 Trace events (structured)
- `RunStarted`
- `NodeStarted`
- `NodeLog`
- `NodeCompleted`
- `ActionRequested`
- `ActionDispatched`
- `ActionResultReceived`
- `RunCompleted`

### 14.2 Evidence artifacts
Evidence types (user-configurable):
- screenshots
- DOM snapshot (hashed/redacted)
- final URL after action

Retention:
- default 7–30 days
- configurable per workspace

### 14.3 Audit events (immutable)
Examples:
- `POST_PUBLISHED`
- `DM_SENT`
- `CONNECTION_ADDED`
- `POLICY_CHANGED`

---

## 15) Testing & drift detection

### 15.1 Three-layer testing
1) Unit: workflow engine, schemas
2) Integration: step runner on controlled test pages
3) Smoke/canary: minimal per-platform flows (login check, open composer)

### 15.2 Drift detection
- If selectors fail on canary:
  - mark adapter version “degraded”
  - alert maintainers
  - fallback to extension confirm-only mode

### 15.3 Replay / record
Extension can optionally “record” successful runs:
- logs step timings
- stores “selector fallbacks used”
- helps update selector packs

---

## 16) Security model

### 16.1 Threats
- Token theft
- Malicious workflow altering content
- Extension compromise
- SSRF via URL fetchers
- Data exfiltration via screenshots/DOM captures

### 16.2 Mitigations
- Never store passwords
- Encrypt tokens at rest (Cloudflare secrets + envelope encryption)
- Extension: least privilege, signed remote configs, domain allowlist
- URL fetch: block private IP ranges, enforce allowlist
- Evidence: redaction + opt-in + short retention
- Admin kill switch

---

## 17) Deployment plan

### 17.1 Cloudflare
- `wrangler deploy` Workers
- D1 migrations
- R2 buckets
- KV namespaces
- Queues + consumer bindings
- Durable Objects

### 17.2 Apify
- Maintain `infra/apify/actors/*`
- CI builds & deploys actors
- Backend stores actor version mapping

### 17.3 Chrome extension
- Build + sign
- Publish to Chrome Web Store (or internal distribution)
- Remote config updates are signed and verified

---

## 18) Master execution plan (phased)

### Phase 0: Skeleton
- Monorepo + basic dashboard
- Workflow runtime + RunDO
- Trace viewer

### Phase 1: Extension plumbing
- Extension auth
- Poll + step runner on test page
- Extension executor + result ingestion

### Phase 2: LinkedIn MVP
- LinkedIn posting (text-only) via extension
- LinkedIn DM via extension with confirmation
- Policy + quotas

### Phase 3: Cloud automation provider
- Apify actor template
- Backend integration
- One platform action in cloud mode (low-risk)

### Phase 4: Multi-platform rollouts
- Add platforms incrementally
- Add media support
- Scheduling improvements

### Phase 5: Workflow builder UX (BubbleLab-style)
- Visual graph editor + compile-to-TS export
- Prompt-to-workflow generator (optional)

---

## 19) Implementation checklists (tickets)

### 19.1 Core runtime
- [ ] Graph schema + validator
- [ ] Node registry
- [ ] RunDO state machine
- [ ] Retry policies
- [ ] Artifact store abstraction (R2)

### 19.2 Executors
- [ ] Executor interface + routing
- [ ] Extension executor protocol
- [ ] Apify executor integration + webhook verification
- [ ] API executor skeleton

### 19.3 Platform adapters
- [ ] Adapter registry + capability negotiation
- [ ] LinkedIn selectors + DM steps
- [ ] X post steps
- [ ] Instagram upload steps
- [ ] TikTok upload steps
- [ ] Xiaohongshu post steps

### 19.4 Policy & safety
- [ ] Policy schema + UI
- [ ] Quotas + cooldowns
- [ ] Required confirmations by action type
- [ ] Audit log UI

### 19.5 Observability
- [ ] Trace event model
- [ ] SSE stream
- [ ] Evidence retention and redaction

---

## 20) Appendix

### 20.1 Step DSL spec (complete)
Supported step types:
- `goto`: `{ url }`
- `waitFor`: `{ selector, timeoutMs? }`
- `waitForUrl`: `{ contains, timeoutMs? }`
- `click`: `{ selector }`
- `type`: `{ selector, text, delayMsPerChar? }`
- `uploadFile`: `{ selector, artifactId }`
- `select`: `{ selector, value }`
- `scrollIntoView`: `{ selector }`
- `sleep`: `{ ms }`
- `assertVisible`: `{ selector }`
- `assertText`: `{ selector, contains }`
- `assertUrlContains`: `{ contains }`
- `userConfirm`: `{ title, body }`  // extension shows modal
- `snapshotDom`: `{ redactPatterns?: string[] }` // optional evidence

### 20.2 Error taxonomy
- `POLICY_BLOCKED`
- `QUOTA_EXCEEDED`
- `NEEDS_USER_PRESENCE`
- `SELECTOR_NOT_FOUND`
- `TIMEOUT`
- `NAVIGATION_BLOCKED`
- `CAPTCHA_DETECTED`
- `MFA_REQUIRED`
- `PLATFORM_CHANGED`
- `UNKNOWN`

### 20.3 Example “post to 3 platforms” workflow
- Draft
- Rewrite per platform
- Approve
- Publish (fan-out, concurrency=2)
- Collect results
- Summarize success/failures

---

## Licensing & reuse notes
- You can borrow architecture ideas from BubbleLab (Apache-2.0) but preserve attribution if copying code.
- For any repo you “borrow,” keep LICENSE files and headers intact; track third-party code in `THIRD_PARTY_NOTICES.md`.

