import { z } from "zod";

export const Platform = z.enum([
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "xiaohongshu",
  "linkedin"
]);

export const ExecutionMode = z.enum(["api", "cloud_browser", "extension_browser"]);

export const Action = z.enum([
  "publish_post",
  "publish_video",
  "schedule_post",
  "send_dm",
  "upload_media",
  "resolve_profile",
  "like_post",
  "comment_post",
  "search_feeds",
  "get_feed_detail"
]);

export const Capability = z.object({
  supportsApi: z.boolean().default(false),
  supportsCloudBrowser: z.boolean().default(false),
  supportsExtensionBrowser: z.boolean().default(false),
  actions: z
    .record(
      z.string(),
      z.object({ modes: z.array(ExecutionMode) })
    )
    .default({})
});

export type Platform = z.infer<typeof Platform>;
export type ExecutionMode = z.infer<typeof ExecutionMode>;
export type Action = z.infer<typeof Action>;
export type Capability = z.infer<typeof Capability>;
