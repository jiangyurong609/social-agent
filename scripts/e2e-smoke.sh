#!/usr/bin/env bash
set -euo pipefail

echo "This script outlines the manual steps for E2E smoke. Run workers in two shells:"
echo "1) cd apps/api-worker && pnpm wrangler dev src/index.ts --port 8787"
echo "2) cd apps/orchestrator-worker && pnpm wrangler dev src/index.ts --port 8788"
echo "Then load the extension (service worker uses 8787/8788)."
echo ""
echo "Start a run with publish_batch to dispatch one action:"
cat <<'EOF'
curl -X POST http://127.0.0.1:8788/run \
  -H 'content-type: application/json' \
  -d '{
    "runId": "run-local",
    "graph": {
      "id": "hello-dispatch",
      "version": "0.0.1",
      "nodes": [
        { "id": "draft", "type": "draft_post" },
        { "id": "publish", "type": "publish_batch" }
      ],
      "edges": []
    },
    "input": [
      {
        "requestId": "req-e2e-1",
        "userId": "dev-user",
        "workspaceId": "ws1",
        "platform": "linkedin",
        "action": "send_dm",
        "mode": "extension_browser",
        "payload": { "message": "hello world" },
        "policyContext": { "requiresApproval": false },
        "traceContext": { "runId": "run-local", "nodeId": "publish" },
        "extensionSteps": { "steps": [ { "type": "waitFor", "selector": "body" } ] }
      }
    ]
  }'
EOF

echo ""
echo "Check run state: curl http://127.0.0.1:8788/run/run-local"
echo "After extension posts result, fetch it: curl http://127.0.0.1:8787/actions/req-e2e-1"
echo "And orchestrator will mark run completed when action-result is forwarded."
