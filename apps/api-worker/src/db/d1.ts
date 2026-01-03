import { ApiWorkerEnv } from "../config";
import { RunRecord, PendingActionRecord, ActionResultRecord } from "../types";

// D1 row types
interface RunRow {
  id: string;
  status: string;
  graph: string;
  input: string;
  outputs: string | null;
  trace: string | null;
  pending_approval: string | null;
  error: string | null;
}

interface PendingActionRow {
  request_id: string;
  user_id: string;
  action_json: string;
}

interface ActionResultRow {
  request_id: string;
  result_json: string;
}

export function getDb(env: ApiWorkerEnv) {
  return env.D1;
}

export async function saveRun(env: ApiWorkerEnv, run: RunRecord) {
  if (!env.D1) return;
  const traceJson = JSON.stringify(run.trace ?? []);
  const outputsJson = run.outputs ? JSON.stringify(run.outputs) : null;
  const pendingJson = run.pendingApproval ? JSON.stringify(run.pendingApproval) : null;
  await env.D1.prepare(
    `INSERT OR REPLACE INTO runs (id, status, graph, input, outputs, trace, pending_approval, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM runs WHERE id = ?), datetime('now')))`
  ).bind(
    run.id,
    run.status,
    JSON.stringify(run.graph ?? {}),
    JSON.stringify(run.input ?? {}),
    outputsJson,
    traceJson,
    pendingJson,
    run.error ?? null,
    run.id
  ).run();
}

export async function getRun(env: ApiWorkerEnv, runId: string): Promise<RunRecord | undefined> {
  if (!env.D1) return undefined;
  const row = await env.D1.prepare("SELECT * FROM runs WHERE id = ?").bind(runId).first() as RunRow | null;
  if (!row) return undefined;
  return {
    id: row.id,
    status: row.status as RunRecord["status"],
    graph: JSON.parse(row.graph),
    input: JSON.parse(row.input),
    outputs: row.outputs ? JSON.parse(row.outputs) : undefined,
    trace: row.trace ? JSON.parse(row.trace) : [],
    pendingApproval: row.pending_approval ? JSON.parse(row.pending_approval) : undefined,
    error: row.error ?? undefined
  };
}

export async function savePendingAction(env: ApiWorkerEnv, action: PendingActionRecord) {
  if (!env.D1) return;
  await env.D1.prepare(
    `INSERT OR REPLACE INTO pending_actions (request_id, user_id, action_json, created_at)
     VALUES (?, ?, ?, COALESCE((SELECT created_at FROM pending_actions WHERE request_id = ?), datetime('now')))`
  ).bind(action.requestId, action.userId, JSON.stringify(action), action.requestId).run();
}

export async function popPendingAction(env: ApiWorkerEnv, userId: string): Promise<PendingActionRecord | undefined> {
  if (!env.D1) return undefined;
  const row = await env.D1.prepare("SELECT * FROM pending_actions WHERE user_id = ? LIMIT 1").bind(userId).first() as PendingActionRow | null;
  if (!row) return undefined;
  await env.D1.prepare("DELETE FROM pending_actions WHERE request_id = ?").bind(row.request_id).run();
  return JSON.parse(row.action_json);
}

export async function getPendingAction(env: ApiWorkerEnv, requestId: string): Promise<PendingActionRecord | undefined> {
  if (!env.D1) return undefined;
  const row = await env.D1.prepare("SELECT * FROM pending_actions WHERE request_id = ?").bind(requestId).first() as PendingActionRow | null;
  if (!row) return undefined;
  return JSON.parse(row.action_json);
}

export async function saveActionResult(env: ApiWorkerEnv, record: ActionResultRecord) {
  if (!env.D1) return;
  await env.D1.prepare(
    `INSERT OR REPLACE INTO action_results (request_id, result_json, created_at)
     VALUES (?, ?, COALESCE((SELECT created_at FROM action_results WHERE request_id = ?), datetime('now')))`
  ).bind(record.requestId, JSON.stringify(record.result), record.requestId).run();
}

export async function getActionResult(env: ApiWorkerEnv, requestId: string): Promise<ActionResultRecord | undefined> {
  if (!env.D1) return undefined;
  const row = await env.D1.prepare("SELECT * FROM action_results WHERE request_id = ?").bind(requestId).first() as ActionResultRow | null;
  if (!row) return undefined;
  return { requestId: row.request_id, result: JSON.parse(row.result_json) };
}
