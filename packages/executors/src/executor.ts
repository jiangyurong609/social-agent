import { ActionRequest, ActionResult } from "@social-agent/schemas";

export interface Executor {
  execute: (req: ActionRequest) => Promise<ActionResult>;
}
