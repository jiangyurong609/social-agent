# Social Media Agent

Early scaffold for the multi-platform social media agent described in `docs/social_media_agent_design.md` and `docs/social_media_agent_implementation_scaffold.md`.

## Quickstart
1. Install pnpm and run `pnpm install` at the root once dependencies are added.
2. Use `pnpm dev` during development, `pnpm build` to type-check/build all packages, and `pnpm test` for the test suite.
3. Load the extension from `apps/extension` in Chrome dev mode after building it.
4. To persist runs/actions, bind a D1 database to the API worker (see `apps/api-worker/src/db/migrations/0001_init.sql`). Update `apps/api-worker/wrangler.toml` with your D1 `database_id`/`database_name`.

## Minimal local smoke (no persistence yet)
- Start the API worker locally: `cd apps/api-worker && pnpm wrangler dev src/index.ts`
- In another shell, POST a tiny workflow to the worker:
```bash
curl -X POST http://127.0.0.1:8787/runs \\
  -H 'content-type: application/json' \\
  -d '{
    "graph": {
      "id": "hello",
      "version": "0.0.1",
      "nodes": [
        { "id": "draft", "type": "draft_post" },
        { "id": "approve", "type": "approve_content" }
      ],
      "edges": []
    },
    "input": { "topic": "status" }
  }'
```
- You should receive `status: "waiting_approval"` because `approve_content` requests approval.
- Approve it:
```bash
curl -X POST http://127.0.0.1:8787/approvals \\
  -H 'content-type: application/json' \\
  -d '{ "runId": "<returned-runId>", "approved": true }'
```
- Or swap `approve_content` for `policy_gate` in the graph to get an immediate `ok: true`.

### Extension poll/result smoke
1. Keep the API worker running at `http://127.0.0.1:8787`.
2. In the extension service worker, `API_BASE` is pointed there and `USER_ID=dev-user`.
3. Create a pending action:
```bash
curl -X POST http://127.0.0.1:8787/actions \\
  -H 'content-type: application/json' \\
  -d '{
    "requestId": "req1",
    "userId": "dev-user",
    "workspaceId": "ws1",
    "platform": "linkedin",
    "action": "send_dm",
    "mode": "extension_browser",
    "payload": { "message": "hello from agent" },
    "policyContext": { "requiresApproval": false },
    "traceContext": { "runId": "run-local", "nodeId": "node-1" },
    "extensionSteps": { "steps": [ { "type": "waitFor", "selector": "body" } ] }
  }'
```
4. The extension poller will pick it, run steps, and POST result back to `/extension/result`.
5. Fetch the action result: `curl http://127.0.0.1:8787/actions/req1`

### Orchestrator Durable Object smoke
- Start orchestrator worker: `cd apps/orchestrator-worker && pnpm wrangler dev src/index.ts`
- POST a run (orchestrator default dev port 8788): `curl -X POST http://127.0.0.1:8788/run -H 'content-type: application/json' -d '{"graph":{"id":"hello","version":"0.0.1","nodes":[{"id":"draft","type":"draft_post"},{"id":"approve","type":"approve_content"}],"edges":[]},"input":{"topic":"status"}}'`
- Check state: `curl http://127.0.0.1:8788/run/<runId>` (from the first response)
- Approve (if waiting): `curl -X POST http://127.0.0.1:8788/run/<runId>/approve -H 'content-type: application/json' -d '{"approved":true}'`

### End-to-end action dispatch loop
- Start API worker at 8787 and orchestrator at 8788; load extension dev build (service worker uses API_BASE 8787 and reports to orchestrator 8788).
- Create a workflow whose last node is `publish_batch` with actions array; the orchestrator dispatches them to the API worker queue.
- Extension polls `/extension/poll`, runs steps, posts result to API worker, which forwards to orchestrator (`/run/<id>/action-result`) if `ORCHESTRATOR_BASE` is set.
- Fetch run state from orchestrator (`/run/<id>`) or fetch action result from API worker (`/actions/<requestId>`).

## Repo layout (MVP)
- `apps/`: Cloudflare workers, dashboard, and Chrome extension.
- `packages/`: Shared libraries (schemas, workflow engine, adapters, executors, policy, observability, shared utils).
- `infra/`: External execution providers (e.g., Apify actor).
- `scripts/`: Helper scripts for dev/lint/test.

Security principles: never store raw cookies/passwords, prefer official APIs, and log with correlation IDs while keeping secrets out of logs.
