import { ActionRequest, ExecutionMode } from "@social-agent/schemas";
import { getAdapter } from "@social-agent/adapters";

export function chooseMode(req: ActionRequest): ExecutionMode {
  const adapter = getAdapter(req.platform);
  const capabilities = adapter.capabilities();
  const actionCaps = capabilities.actions[req.action];
  if (actionCaps && actionCaps.modes.includes(req.mode)) {
    return req.mode;
  }
  if (actionCaps && actionCaps.modes.length > 0) {
    return actionCaps.modes[0];
  }
  return "extension_browser";
}
