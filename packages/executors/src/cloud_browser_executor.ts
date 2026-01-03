import { ActionRequest, ActionResult } from "@social-agent/schemas";
import { ExecutorError } from "./errors";

export async function executeViaCloudBrowser(_req: ActionRequest): Promise<ActionResult> {
  throw new ExecutorError("Cloud browser executor not implemented", true);
}
