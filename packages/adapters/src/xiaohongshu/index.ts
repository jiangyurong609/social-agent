import { ActionRequest } from "@social-agent/schemas";
import { PlatformAdapter } from "../adapter";
import { xiaohongshuCapabilities } from "./capabilities";

// Xiaohongshu MCP server base URL
// Can be overridden in payload.baseUrl for each request
const DEFAULT_baseUrl = "http://localhost:18060";

/**
 * Xiaohongshu adapter - integrates with xiaohongshu-mcp server
 *
 * The xiaohongshu-mcp server must be running separately as it requires
 * a Chromium browser for automation. This adapter builds HTTP API calls
 * that the API executor will send to the MCP server.
 *
 * @see https://github.com/xingyezhiqiu/xiaohongshu-mcp
 */
export const xiaohongshuAdapter: PlatformAdapter = {
  platform: "xiaohongshu",
  capabilities: xiaohongshuCapabilities,

  async buildAction(req: ActionRequest) {
    const payload = req.payload as Record<string, unknown>;
    const baseUrl = (payload.baseUrl as string) || DEFAULT_baseUrl;

    switch (req.action) {
      case "publish_post":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/publish`,
            method: "POST",
            body: {
              title: payload.title,
              content: payload.content,
              images: payload.images || [],
              tags: payload.tags || []
            }
          }
        };

      case "publish_video":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/publish_video`,
            method: "POST",
            body: {
              title: payload.title,
              content: payload.content,
              video_path: payload.videoPath,
              tags: payload.tags || []
            }
          }
        };

      case "like_post":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/feeds/like`,
            method: "POST",
            body: {
              feed_id: payload.feedId,
              xsec_token: payload.xsecToken,
              like: payload.like !== false // default to true
            }
          }
        };

      case "comment_post":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/feeds/comment`,
            method: "POST",
            body: {
              feed_id: payload.feedId,
              xsec_token: payload.xsecToken,
              content: payload.content
            }
          }
        };

      case "search_feeds":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/feeds/search`,
            method: "POST",
            body: {
              keyword: payload.keyword,
              page: payload.page || 1,
              sort_by: payload.sortBy || "general", // general, time_descending, popularity_descending
              note_type: payload.noteType || "all" // all, video, image
            }
          }
        };

      case "get_feed_detail":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/feeds/detail`,
            method: "POST",
            body: {
              feed_id: payload.feedId,
              xsec_token: payload.xsecToken,
              load_comments: payload.loadComments !== false,
              comments_count: payload.commentsCount || 10
            }
          }
        };

      case "resolve_profile":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/user/profile`,
            method: "POST",
            body: {
              user_id: payload.userId
            }
          }
        };

      default:
        return {};
    }
  }
};
