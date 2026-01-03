import { ActionRequest } from "@social-agent/schemas";
import { OrchestratorEnv } from "../config";

/**
 * Dispatches an ActionRequest to the API worker so it can be queued for
 * extension/cloud execution. For MVP we simply POST to /actions.
 */
export async function dispatchAction(env: OrchestratorEnv, action: ActionRequest): Promise<void> {
  if (!env.API_BASE) throw new Error("API_BASE not configured for dispatcher");
  const res = await fetch(`${env.API_BASE}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(action)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to dispatch action: ${res.status} ${text}`);
  }
}
