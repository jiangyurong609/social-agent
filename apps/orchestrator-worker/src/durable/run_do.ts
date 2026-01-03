import { executeWorkflow, registerBuiltinNodes, NeedsApprovalError } from "@social-agent/workflow-core";
import { createLogger } from "@social-agent/observability";
import { nowIso } from "@social-agent/shared";
import { dispatchAction } from "../services/dispatcher";
import { OrchestratorEnv } from "../config";
import { ActionRequest } from "@social-agent/schemas";

registerBuiltinNodes();
const logger = createLogger("run-do");

type RunStatus = "running" | "waiting_approval" | "completed" | "failed";

interface StoredRun {
  id: string;
  graph: any;
  input: unknown;
  status: RunStatus;
  outputs?: Record<string, unknown>;
  trace: any[];
  pendingApproval?: unknown;
  error?: string;
}

// Minimal Durable Object State typing to avoid needing workers-types during scaffold.
type DurableObjectState = {
  id: { toString(): string };
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
  };
};

export class RunDo {
  constructor(private state: DurableObjectState, private env: OrchestratorEnv) {}

  async fetch(request: Request) {
    const url = new URL(request.url);
    const runId = this.state.id.toString();

    if (request.method === "POST" && url.pathname === "/start") {
      const body = await request.json() as any;
      const graph = body?.graph;
      if (!graph) return json({ ok: false, error: "missing_graph" }, 400);

      const traceEvents: any[] = [];
      const record: StoredRun = { id: runId, graph, input: body.input ?? {}, status: "running", trace: traceEvents };
      await this.state.storage.put("run", record);

      try {
        const result = await executeWorkflow(graph, body.input ?? {}, {
          runId,
          logger,
          artifacts: undefined,
          trace: (event) => { traceEvents.push({ ...event, at: (event as { at?: string }).at ?? nowIso() }); }
        });
        // If a node returns action_request payload, dispatch actions then mark waiting.
        const lastOutput = Object.values(result.outputs ?? {}).pop();
        if (lastOutput && (lastOutput as any).type === "action_request") {
          const actions = (lastOutput as any).actions as ActionRequest[];
          for (const action of actions) {
            await dispatchAction(this.env, action);
          }
          record.status = "waiting_approval"; // reuse approval wait status for async action completion
          record.pendingApproval = { awaitingActions: actions.map((a) => a.requestId) };
        } else {
          record.status = "completed";
          record.outputs = result.outputs;
        }
      } catch (err) {
        if (err instanceof NeedsApprovalError) {
          record.status = "waiting_approval";
          record.pendingApproval = err.payload;
        } else {
          record.status = "failed";
          record.error = String(err);
        }
      }

      await this.state.storage.put("run", record);
      return json({ ok: true, run: record });
    }

    if (request.method === "POST" && url.pathname === "/enqueue-action") {
      const body = await request.json() as any;
      const action = body as ActionRequest;
      await dispatchAction(this.env, action);
      return json({ ok: true, dispatched: true });
    }

    if (request.method === "POST" && url.pathname === "/approve") {
      const body = await request.json() as any;
      const approved = Boolean(body?.approved);
      const record = (await this.state.storage.get<StoredRun>("run"))!;
      if (!record) return json({ ok: false, error: "not_found" }, 404);
      if (record.status !== "waiting_approval") return json({ ok: false, error: "not_waiting" }, 400);
      if (!approved) {
        record.status = "failed";
        record.error = "rejected";
        await this.state.storage.put("run", record);
        return json({ ok: true, run: record });
      }
      record.status = "completed";
      record.outputs = record.outputs ?? { approvedPayload: record.pendingApproval };
      record.trace.push({ t: "NodeCompleted", runId, nodeId: "approve_content", at: nowIso(), outputRef: "approved" });
      await this.state.storage.put("run", record);
      return json({ ok: true, run: record });
    }

    if (request.method === "GET" && url.pathname === "/state") {
      const record = (await this.state.storage.get<StoredRun>("run"))!;
      if (!record) return json({ ok: false, error: "not_found" }, 404);
      return json({ ok: true, run: record });
    }

    if (request.method === "POST" && url.pathname === "/action-result") {
      const body = await request.json() as any;
      const requestId = body?.requestId;
      const ok = body?.ok;
      const record = (await this.state.storage.get<StoredRun>("run"))!;
      if (!record) return json({ ok: false, error: "not_found" }, 404);
      // For MVP, when all awaited actions return, mark completed.
      const awaiting = (record.pendingApproval as any)?.awaitingActions as string[] | undefined;
      if (awaiting && requestId) {
        const remaining = awaiting.filter((id) => id !== requestId);
        if (remaining.length === 0) {
          record.status = ok ? "completed" : "failed";
          record.outputs = { actionResults: true };
        }
        record.pendingApproval = { awaitingActions: remaining };
        await this.state.storage.put("run", record);
        return json({ ok: true, run: record });
      }
      return json({ ok: false, error: "no_pending_actions" }, 400);
    }

    return json({ ok: true, note: "RunDo alive" });
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}
