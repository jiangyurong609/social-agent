import { UI_HTML } from "./ui";

interface Env {
  XHS_ORIGIN_URL: string;
  XHS_ORIGIN_TOKEN: string;
}

const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.XHS_ORIGIN_URL || !env.XHS_ORIGIN_TOKEN) {
      return json({ success: false, error: "proxy_not_configured" }, 503);
    }

    const incomingUrl = new URL(request.url);
    if ((request.method === "GET" || request.method === "HEAD") && incomingUrl.pathname === "/") {
      return new Response(request.method === "HEAD" ? null : UI_HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }

    const originUrl = new URL(env.XHS_ORIGIN_URL);
    originUrl.pathname = incomingUrl.pathname;
    originUrl.search = incomingUrl.search;

    const headers = new Headers(request.headers);
    headers.delete("host");
    for (const header of HOP_BY_HOP_HEADERS) headers.delete(header);
    headers.set("x-origin-token", env.XHS_ORIGIN_TOKEN);
    headers.set("x-forwarded-host", incomingUrl.host);
    headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

    try {
      const response = await fetch(originUrl.toString(), {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "manual",
      });

      const responseHeaders = new Headers(response.headers);
      for (const header of HOP_BY_HOP_HEADERS) responseHeaders.delete(header);
      responseHeaders.set("x-xhs-origin", "azure-eastasia");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return json({
        success: false,
        error: "origin_unavailable",
        message: error instanceof Error ? error.message : String(error),
      }, 502);
    }
  },
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
