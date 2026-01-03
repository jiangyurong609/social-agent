import { Capability } from "@social-agent/schemas";

export function xiaohongshuCapabilities(): Capability {
  return {
    // Xiaohongshu uses HTTP API via xiaohongshu-mcp server
    supportsApi: true,
    supportsCloudBrowser: false,
    supportsExtensionBrowser: false,
    actions: {
      publish_post: { modes: ["api"] },
      publish_video: { modes: ["api"] },
      like_post: { modes: ["api"] },
      comment_post: { modes: ["api"] },
      search_feeds: { modes: ["api"] },
      get_feed_detail: { modes: ["api"] },
      resolve_profile: { modes: ["api"] }
    }
  } as Capability;
}
