// Plain MV3 background script, no imports.
const API_BASE = "https://social-agent-api.jiangyurong609.workers.dev";
const ORCHESTRATOR_BASE = "https://social-agent-orchestrator.jiangyurong609.workers.dev";
const USER_ID = "dev-user";

let intervalId;

startPoller(API_BASE, USER_ID, async (action) => {
  const result = { ok: true }; // stubbed runner
  await safeFetch(`${API_BASE}/extension/result`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: action.requestId, result, runId: action.traceContext?.runId })
  });
  if (action.traceContext?.runId) {
    await safeFetch(`${ORCHESTRATOR_BASE}/run/${encodeURIComponent(action.traceContext.runId)}/action-result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: action.requestId, ok: result.ok })
    });
  }
});

function startPoller(apiBase, userId, handleAction) {
  stopPoller();
  intervalId = setInterval(async () => {
    const res = await safeFetch(`${apiBase}/extension/poll?userId=${encodeURIComponent(userId)}`);
    if (!res || res.ok === false) return;
    if (!res.pending || !res.action) return;
    await handleAction(res.action);
  }, 1500);
}

function stopPoller() {
  if (intervalId) clearInterval(intervalId);
}

async function safeFetch(url, init) {
  try {
    const res = await fetch(url, init);
    const ct = res.headers.get("content-type") || "";
    const isJson = ct.includes("json");
    return isJson ? await res.json() : await res.text();
  } catch (error) {
    return { ok: false, error };
  }
}
