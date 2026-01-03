import { ActionRequest, ActionResult } from "@social-agent/schemas";
import { getAdapter } from "@social-agent/adapters";
import { ExecutorError } from "./errors";

export interface ApiCallSpec {
  endpoint: string;
  method: string;
  body: unknown;
  headers?: Record<string, string>;
}

/**
 * Execute an action via HTTP API call.
 *
 * This executor is used for platforms that expose an HTTP API
 * (either official or via a proxy like xiaohongshu-mcp).
 *
 * The adapter's buildAction() returns an apiCall spec which
 * this executor sends to the target endpoint.
 */
export async function executeViaApi(req: ActionRequest): Promise<ActionResult> {
  const adapter = getAdapter(req.platform);
  const actionSpec = await adapter.buildAction(req);

  if (!actionSpec.apiCall) {
    throw new ExecutorError(
      `No API call spec for ${req.platform}/${req.action}`,
      false
    );
  }

  const { endpoint, method, body, headers } = actionSpec.apiCall as ApiCallSpec;

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const responseData = await response.json() as Record<string, unknown>;

    // xiaohongshu-mcp returns { success: boolean, data: ..., message: ... }
    // Normalize to our ActionResult format
    if (responseData.success === false) {
      return {
        ok: false,
        error: {
          type: "api_error",
          message: String(responseData.message || "API call failed"),
          retriable: response.status >= 500
        }
      };
    }

    // Extract relevant fields from response
    const data = responseData.data as Record<string, unknown> | undefined;

    return {
      ok: true,
      platformPostId: data?.id as string | undefined,
      raw: responseData
    };
  } catch (err) {
    const isNetworkError =
      err instanceof TypeError && err.message.includes("fetch");

    throw new ExecutorError(
      `API call failed: ${err instanceof Error ? err.message : String(err)}`,
      isNetworkError // Network errors are retriable
    );
  }
}

/**
 * Check if xiaohongshu-mcp server is available and logged in
 */
export async function checkXiaohongshuStatus(
  baseUrl = "http://localhost:18060"
): Promise<{ available: boolean; loggedIn: boolean; message: string }> {
  try {
    // Skip health check - go directly to login status (faster)
    // Add timeout to avoid long waits
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const loginResp = await fetch(`${baseUrl}/api/v1/login/status`, {
      signal: controller.signal,
      headers: { "User-Agent": "social-agent/1.0" }
    });
    clearTimeout(timeoutId);

    if (!loginResp.ok) {
      return { available: false, loggedIn: false, message: `Server error: ${loginResp.status}` };
    }

    const loginData = await loginResp.json() as Record<string, unknown>;
    const data = loginData.data as Record<string, unknown> | undefined;

    return {
      available: true,
      // Fix: API returns is_logged_in, not logged_in
      loggedIn: loginData.success === true && data?.is_logged_in === true,
      message: loginData.success ? "OK" : String(loginData.message || "Unknown status")
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { available: false, loggedIn: false, message: "Request timed out (30s)" };
    }
    return {
      available: false,
      loggedIn: false,
      message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
