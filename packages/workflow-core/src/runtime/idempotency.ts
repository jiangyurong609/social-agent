import { sha256 } from "@social-agent/shared";
import { ActionRequest } from "@social-agent/schemas";

export async function deriveActionKey(req: ActionRequest): Promise<string> {
  const payloadHash = await sha256(JSON.stringify(req.payload ?? {}));
  const runId = (req as any).runId ?? req.traceContext.runId;
  return [runId, req.traceContext.nodeId, req.platform, req.action, payloadHash].join(":");
}
