import { ActionRequest, ActionResult } from "@social-agent/schemas";
import { ExecutorError } from "./errors";

export async function executeViaExtension(_req: ActionRequest): Promise<ActionResult> {
  throw new ExecutorError("Extension executor not implemented", true);
}
