import { ActionRequest } from "@social-agent/schemas";
import { PlatformAdapter } from "../adapter";
import { linkedinCapabilities } from "./capabilities";
import sendDmV1 from "./steps/send_dm.v1.json" assert { type: "json" };
import publishPostV1 from "./steps/publish_post_text.v1.json" assert { type: "json" };

export const linkedinAdapter: PlatformAdapter = {
  platform: "linkedin",
  capabilities: linkedinCapabilities,
  async buildAction(req: ActionRequest) {
    if (req.action === "send_dm") {
      return { extensionSteps: sendDmV1 };
    }
    if (req.action === "publish_post") {
      return { extensionSteps: publishPostV1 };
    }
    return {};
  }
};
