import { Capability } from "@social-agent/schemas";

export function xCapabilities(): Capability {
  return {
    supportsApi: false,
    supportsCloudBrowser: true,
    supportsExtensionBrowser: true,
    actions: {
      publish_post: { modes: ["cloud_browser", "extension_browser"] }
    }
  } as Capability;
}
