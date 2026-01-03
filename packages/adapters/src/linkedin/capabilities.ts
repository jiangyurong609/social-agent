import { Capability } from "@social-agent/schemas";

export function linkedinCapabilities(): Capability {
  return {
    supportsApi: false,
    supportsCloudBrowser: true,
    supportsExtensionBrowser: true,
    actions: {
      publish_post: { modes: ["extension_browser", "cloud_browser"] },
      send_dm: { modes: ["extension_browser"] }
    }
  } as Capability;
}
