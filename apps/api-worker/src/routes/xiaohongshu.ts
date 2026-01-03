import { executeViaApi, checkXiaohongshuStatus } from "@social-agent/executors";
import { ApiWorkerEnv } from "../config";

// Default context for API-direct calls
const defaultPolicyContext = { requiresApproval: false };
const defaultTraceContext = { runId: "api-direct", nodeId: "xhs-route" };

interface XhsLoginQrcodeResponse {
  success: boolean;
  data?: {
    timeout: string;
    is_logged_in: boolean;
    img: string;
  };
  message: string;
}

interface XhsLoginStatusResponse {
  success: boolean;
  data?: {
    is_logged_in: boolean;
    username: string;
  };
  message: string;
}

/**
 * Xiaohongshu API routes - direct execution via xiaohongshu-mcp
 */
export async function handleXiaohongshu(
  request: Request,
  url: URL,
  env: ApiWorkerEnv
): Promise<Response | null> {
  const path = url.pathname;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders()
    });
  }

  // Get login QR code - returns base64 image for frontend to display
  // Uses AbortController for longer timeout since browser init can be slow
  if (request.method === "GET" && path === "/xhs/login/qrcode") {
    const baseUrl = url.searchParams.get("baseUrl") || env.XHS_MCP_BASE;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const resp = await fetch(`${baseUrl}/api/v1/login/qrcode`, {
        signal: controller.signal,
        headers: { "User-Agent": "social-agent-api/1.0" }
      });
      clearTimeout(timeoutId);

      const text = await resp.text();
      try {
        const data = JSON.parse(text) as XhsLoginQrcodeResponse;
        return jsonWithCors(data);
      } catch {
        return jsonWithCors({
          success: false,
          message: `Invalid response from server: ${text.slice(0, 100)}`
        }, 500);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return jsonWithCors({
          success: false,
          message: "QR code request timed out. The server may be starting up, please try again."
        }, 504);
      }
      return jsonWithCors({
        success: false,
        message: `Failed to get QR code: ${err instanceof Error ? err.message : String(err)}`
      }, 500);
    }
  }

  // Check login status - for polling after QR scan
  if (request.method === "GET" && path === "/xhs/login/status") {
    const baseUrl = url.searchParams.get("baseUrl") || env.XHS_MCP_BASE;
    try {
      const resp = await fetch(`${baseUrl}/api/v1/login/status`, {
        headers: { "User-Agent": "social-agent-api/1.0" }
      });
      const text = await resp.text();
      try {
        const data = JSON.parse(text) as XhsLoginStatusResponse;
        return jsonWithCors(data);
      } catch {
        return jsonWithCors({
          success: false,
          message: `Invalid response from server: ${text.slice(0, 100)}`
        }, 500);
      }
    } catch (err) {
      return jsonWithCors({
        success: false,
        message: `Failed to check login status: ${err instanceof Error ? err.message : String(err)}`
      }, 500);
    }
  }

  // Health check for xiaohongshu-mcp (legacy endpoint)
  if (request.method === "GET" && path === "/xhs/status") {
    const baseUrl = url.searchParams.get("baseUrl") || env.XHS_MCP_BASE;
    const status = await checkXiaohongshuStatus(baseUrl);
    return jsonWithCors(status);
  }

  // Search feeds
  if (request.method === "POST" && path === "/xhs/search") {
    const body = await request.json() as Record<string, unknown>;
    const result = await executeViaApi({
      requestId: `xhs_search_${Date.now()}`,
      userId: "api",
      workspaceId: (body.workspaceId as string) || "default",
      platform: "xiaohongshu",
      action: "search_feeds",
      mode: "api",
      policyContext: defaultPolicyContext,
      traceContext: defaultTraceContext,
      payload: {
        keyword: body.keyword,
        page: body.page,
        sortBy: body.sortBy,
        noteType: body.noteType,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }

  // Get feed detail
  if (request.method === "POST" && path === "/xhs/detail") {
    const body = await request.json() as Record<string, unknown>;
    const result = await executeViaApi({
      requestId: `xhs_detail_${Date.now()}`,
      userId: "api",
      workspaceId: (body.workspaceId as string) || "default",
      platform: "xiaohongshu",
      action: "get_feed_detail",
      mode: "api",
      policyContext: defaultPolicyContext,
      traceContext: defaultTraceContext,
      payload: {
        feedId: body.feedId,
        xsecToken: body.xsecToken,
        loadComments: body.loadComments,
        commentsCount: body.commentsCount,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }

  // Like post
  if (request.method === "POST" && path === "/xhs/like") {
    const body = await request.json() as Record<string, unknown>;
    const result = await executeViaApi({
      requestId: `xhs_like_${Date.now()}`,
      userId: "api",
      workspaceId: (body.workspaceId as string) || "default",
      platform: "xiaohongshu",
      action: "like_post",
      mode: "api",
      policyContext: defaultPolicyContext,
      traceContext: defaultTraceContext,
      payload: {
        feedId: body.feedId,
        xsecToken: body.xsecToken,
        like: body.like,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }

  // Comment on post
  if (request.method === "POST" && path === "/xhs/comment") {
    const body = await request.json() as Record<string, unknown>;
    const result = await executeViaApi({
      requestId: `xhs_comment_${Date.now()}`,
      userId: "api",
      workspaceId: (body.workspaceId as string) || "default",
      platform: "xiaohongshu",
      action: "comment_post",
      mode: "api",
      policyContext: defaultPolicyContext,
      traceContext: defaultTraceContext,
      payload: {
        feedId: body.feedId,
        xsecToken: body.xsecToken,
        content: body.content,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }

  // Publish post
  if (request.method === "POST" && path === "/xhs/publish") {
    const body = await request.json() as Record<string, unknown>;
    const result = await executeViaApi({
      requestId: `xhs_publish_${Date.now()}`,
      userId: "api",
      workspaceId: (body.workspaceId as string) || "default",
      platform: "xiaohongshu",
      action: "publish_post",
      mode: "api",
      policyContext: { requiresApproval: true },
      traceContext: defaultTraceContext,
      payload: {
        title: body.title,
        content: body.content,
        images: body.images,
        tags: body.tags,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }

  // Publish video (accepts videoUrl or videoPath)
  if (request.method === "POST" && path === "/xhs/publish-video") {
    const body = await request.json() as Record<string, unknown>;
    const baseUrl = (body.baseUrl as string) || env.XHS_MCP_BASE;

    // Call xiaohongshu-mcp directly for video publish (supports URL)
    try {
      const resp = await fetch(`${baseUrl}/api/v1/publish_video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "social-agent-api/1.0"
        },
        body: JSON.stringify({
          title: body.title,
          content: body.content,
          video: body.videoUrl || body.videoPath, // Support both URL and path
          tags: body.tags
        })
      });
      const data = await resp.json();
      return jsonWithCors({
        ok: data.success,
        raw: data
      });
    } catch (err) {
      return jsonWithCors({
        ok: false,
        error: `Failed to publish video: ${err instanceof Error ? err.message : String(err)}`
      }, 500);
    }
  }

  // Get user profile
  if (request.method === "POST" && path === "/xhs/profile") {
    const body = await request.json() as Record<string, unknown>;
    const result = await executeViaApi({
      requestId: `xhs_profile_${Date.now()}`,
      userId: "api",
      workspaceId: (body.workspaceId as string) || "default",
      platform: "xiaohongshu",
      action: "resolve_profile",
      mode: "api",
      policyContext: defaultPolicyContext,
      traceContext: defaultTraceContext,
      payload: {
        userId: body.userId,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }

  return null; // Not handled
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function jsonWithCors(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders()
    }
  });
}
