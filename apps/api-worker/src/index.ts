import { executeWorkflow, registerBuiltinNodes, NeedsApprovalError } from "@social-agent/workflow-core";
import { createLogger } from "@social-agent/observability";
import { nowIso } from "@social-agent/shared";
import { ActionRequest, ActionResult } from "@social-agent/schemas";
import { ApiWorkerEnv } from "./config";
import { saveRun, getRun, savePendingAction, popPendingAction, saveActionResult, getActionResult, getPendingAction } from "./db/d1";
import { RunRecord } from "./types";
import { handleXiaohongshu } from "./routes/xiaohongshu";
import { handleAutomations } from "./routes/automations";
import { handlePendingPosts } from "./routes/pending-posts";

registerBuiltinNodes();
const logger = createLogger("api-worker");

// In-memory fallback stores (used if D1 is not bound)
const runsMemory = new Map<string, RunRecord>();
const pendingActionsMemory = new Map<string, ActionRequest>(); // key: requestId
const actionResultsMemory = new Map<string, ActionResult>(); // key: requestId

export default {
  async fetch(request: Request, env: ApiWorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    // Handle xiaohongshu routes
    if (url.pathname.startsWith("/xhs/")) {
      try {
        const xhsResponse = await handleXiaohongshu(request, url, env);
        if (xhsResponse) return xhsResponse;
      } catch (err) {
        logger.error("XHS route error", { err: String(err) });
        return json({ ok: false, error: "xhs_error", message: String(err) }, 500);
      }
    }

    // Handle automation routes
    if (url.pathname.startsWith("/automations")) {
      try {
        const automationsResponse = await handleAutomations(request, url, env);
        if (automationsResponse) return automationsResponse;
      } catch (err) {
        logger.error("Automations route error", { err: String(err) });
        return json({ ok: false, error: "automations_error", message: String(err) }, 500);
      }
    }

    // Handle pending posts routes
    if (url.pathname.startsWith("/pending-posts")) {
      try {
        const pendingPostsResponse = await handlePendingPosts(request, url, env);
        if (pendingPostsResponse) return pendingPostsResponse;
      } catch (err) {
        logger.error("Pending posts route error", { err: String(err) });
        return json({ ok: false, error: "pending_posts_error", message: String(err) }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/runs") {
      try {
        const body = await request.json() as any;
        if (!body?.graph) {
          return json({ ok: false, error: "missing_graph" }, 400);
        }
        const runId = body.runId ?? `run_${Date.now()}`;
        const traceEvents: any[] = [];
        const record: RunRecord = {
          id: runId,
          status: "running",
          graph: body.graph,
          input: body.input ?? {},
          trace: traceEvents
        };
        runsMemory.set(runId, record);
        await saveRun(env, record);

        try {
          const result = await executeWorkflow(body.graph, body.input ?? {}, {
            runId,
            logger,
            artifacts: undefined,
            trace: (event) => { traceEvents.push({ ...event, at: (event as { at?: string }).at ?? nowIso() }); }
          });
          record.status = "completed";
          record.outputs = result.outputs;
          await saveRun(env, record);
          return json({ ok: true, runId, status: record.status, outputs: result.outputs, trace: traceEvents });
        } catch (err) {
          if (err instanceof NeedsApprovalError) {
            record.status = "waiting_approval";
            record.pendingApproval = err.payload;
            await saveRun(env, record);
            return json({ ok: true, runId, status: record.status, pendingApproval: err.payload, trace: traceEvents });
          }
          record.status = "failed";
          record.error = String(err);
          logger.error("run failed", { err: String(err) });
          await saveRun(env, record);
          return json({ ok: false, runId, error: "execution_failed", message: String(err), trace: traceEvents }, 500);
        }
      } catch (err) {
        logger.error("run failed", { err: String(err) });
        return json({ ok: false, error: "execution_failed", message: String(err) }, 500);
      }
    }

    if (request.method === "GET" && url.pathname.startsWith("/runs/")) {
      const runId = url.pathname.split("/")[2];
      const record = (await getRun(env, runId)) ?? runsMemory.get(runId);
      if (!record) return json({ ok: false, error: "not_found" }, 404);
      return json({ ok: true, run: record });
    }

    if (request.method === "POST" && url.pathname === "/approvals") {
      try {
        const body = await request.json() as any;
        const runId = body?.runId;
        const approved = Boolean(body?.approved);
        if (!runId) return json({ ok: false, error: "missing_runId" }, 400);
        const record = (await getRun(env, runId)) ?? runsMemory.get(runId);
        if (!record) return json({ ok: false, error: "not_found" }, 404);
        if (record.status !== "waiting_approval") {
          return json({ ok: false, error: "not_waiting" }, 400);
        }
        if (!approved) {
          record.status = "failed";
          record.error = "rejected";
          await saveRun(env, record);
          return json({ ok: true, runId, status: record.status });
        }
        // For MVP, approval simply marks completed and echoes payload.
        record.status = "completed";
        record.outputs = { approvedPayload: record.pendingApproval };
        record.trace.push({ t: "NodeCompleted", runId, nodeId: "approve_content", at: nowIso(), outputRef: "approved" });
        await saveRun(env, record);
        return json({ ok: true, runId, status: record.status, outputs: record.outputs });
      } catch (err) {
        return json({ ok: false, error: "approval_failed", message: String(err) }, 500);
      }
    }

    // Simulated pending action creation (would be produced by orchestrator/engine)
    if (request.method === "POST" && url.pathname === "/actions") {
      try {
        const body = await request.json() as any;
        const action: ActionRequest = body;
        if (!action?.requestId || !action?.userId) {
          return json({ ok: false, error: "missing_fields" }, 400);
        }
        pendingActionsMemory.set(action.requestId, action);
        await savePendingAction(env, { ...action });
        return json({ ok: true, requestId: action.requestId });
      } catch (err) {
        return json({ ok: false, error: "action_create_failed", message: String(err) }, 500);
      }
    }

    // Extension polls for pending actions for userId
    if (request.method === "GET" && url.pathname === "/extension/poll") {
      const userId = url.searchParams.get("userId");
      if (!userId) return json({ ok: false, error: "missing_user" }, 400);
      const dbAction = await popPendingAction(env, userId);
      const memoryAction = Array.from(pendingActionsMemory.values()).find((a) => a.userId === userId);
      const chosen = dbAction ?? memoryAction;
      if (!chosen) return json({ ok: true, pending: false });
      if (memoryAction && memoryAction.requestId === chosen.requestId) pendingActionsMemory.delete(chosen.requestId);
      return json({ ok: true, pending: true, action: chosen });
    }

    // Extension posts back ActionResult
    if (request.method === "POST" && url.pathname === "/extension/result") {
      try {
        const body = await request.json() as any;
        const requestId = body?.requestId;
        const result: ActionResult = body?.result;
        if (!requestId || !result) return json({ ok: false, error: "missing_fields" }, 400);
        const pendingAction = (await getPendingAction(env, requestId)) ?? pendingActionsMemory.get(requestId);
        pendingActionsMemory.delete(requestId);
        actionResultsMemory.set(requestId, result);
        await saveActionResult(env, { requestId, result });

        // Forward to orchestrator if we know the runId/nodeId
        const runId = pendingAction?.traceContext?.runId ?? body?.runId;
        if (env.ORCHESTRATOR_BASE && runId) {
          await fetch(`${env.ORCHESTRATOR_BASE}/run/${encodeURIComponent(runId)}/action-result`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId, ok: result.ok })
          });
        }
        return json({ ok: true, requestId });
      } catch (err) {
        return json({ ok: false, error: "result_failed", message: String(err) }, 500);
      }
    }

    if (request.method === "GET" && url.pathname.startsWith("/actions/")) {
      const requestId = url.pathname.split("/")[2];
      const stored = (await getActionResult(env, requestId)) ?? (actionResultsMemory.has(requestId) ? { requestId, result: actionResultsMemory.get(requestId) } : undefined);
      if (!stored) return json({ ok: false, error: "not_found" }, 404);
      return json({ ok: true, result: stored.result });
    }

    return json({ ok: true, service: "api-worker" }, 200);
  }
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}
