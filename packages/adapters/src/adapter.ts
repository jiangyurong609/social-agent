import { ActionRequest, Capability } from "@social-agent/schemas";

export interface PlatformAdapter {
  platform: string;
  capabilities(): Capability;
  buildAction: (req: ActionRequest) => Promise<{
    apiCall?: { endpoint: string; method: string; body: unknown };
    cloudPlaywrightScript?: { actorName: string; input: unknown };
    extensionSteps?: { steps: unknown[] };
  }>;
}
