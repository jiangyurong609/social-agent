import { ActionRequest } from "@social-agent/schemas";
import { PlatformAdapter } from "../adapter";
import { xCapabilities } from "./capabilities";
import publishPostV1 from "./steps/publish_post_text.v1.json" assert { type: "json" };

export const xAdapter: PlatformAdapter = {
  platform: "x",
  capabilities: xCapabilities,
  async buildAction(req: ActionRequest) {
    if (req.action === "publish_post") {
      return { extensionSteps: publishPostV1 };
    }
    return {};
  }
};
