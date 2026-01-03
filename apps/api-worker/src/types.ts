export interface JsonResponse {
  ok: boolean;
  error?: { code: string; message: string; details?: unknown };
}

import type { ActionRequest } from "@social-agent/schemas";

export type RunStatus = "running" | "waiting_approval" | "completed" | "failed";

export interface RunRecord {
  id: string;
  status: RunStatus;
  graph: any;
  input: unknown;
  outputs?: Record<string, unknown>;
  trace: any[];
  pendingApproval?: unknown;
  error?: string;
}

export interface PendingActionRecord extends ActionRequest {
  requestId: string;
}

export interface ActionResultRecord {
  requestId: string;
  result: any;
}
