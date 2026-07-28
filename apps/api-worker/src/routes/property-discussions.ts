import { ApiWorkerEnv } from "../config";
import { validateSearchRequest } from "../property-discussions/query";
import { searchPropertyDiscussions } from "../property-discussions/service";
import { exportPropertyDiscussions } from "../property-discussions/export";
import { getSnapshotById } from "../property-discussions/storage";
import {
  DiscussionSource,
  PropertyDiscussionSearchRequest,
} from "../property-discussions/types";

export async function handlePropertyDiscussions(
  request: Request,
  url: URL,
  env: ApiWorkerEnv
): Promise<Response | null> {
  if (!isAuthorized(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  if (request.method === "POST" && url.pathname === "/property-discussions/search") {
    let body: PropertyDiscussionSearchRequest;
    try {
      body = await request.json() as PropertyDiscussionSearchRequest;
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    return runSearch(env, body);
  }

  if (request.method === "POST" && url.pathname === "/property-discussions/export") {
    let body: PropertyDiscussionSearchRequest;
    try {
      body = await request.json() as PropertyDiscussionSearchRequest;
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    return runExport(env, body);
  }

  if (request.method === "GET" && url.pathname === "/property-discussions/search") {
    return runSearch(env, requestFromQuery(url.searchParams));
  }

  if (request.method === "GET" && url.pathname.startsWith("/property-discussions/snapshots/")) {
    const snapshotId = decodeURIComponent(url.pathname.split("/")[3] || "");
    if (!snapshotId) return json({ ok: false, error: "missing_snapshot_id" }, 400);
    const snapshot = await getSnapshotById(env, snapshotId);
    return snapshot
      ? json({ ok: true, data: snapshot })
      : json({ ok: false, error: "not_found" }, 404);
  }

  if (request.method === "GET" && url.pathname === "/property-discussions/schema") {
    return json({
      ok: true,
      schemaVersion: "property-discussions.v1",
      endpoints: {
        search: "GET or POST /property-discussions/search",
        export: "POST /property-discussions/export (JSON + JSONL)",
        snapshot: "GET /property-discussions/snapshots/:snapshotId",
      },
      sources: ["xiaohongshu", "reddit"],
      output: "Structured JSON items plus llm.document Markdown",
    });
  }

  return null;
}

async function runExport(
  env: ApiWorkerEnv,
  body: PropertyDiscussionSearchRequest,
): Promise<Response> {
  const validationError = validateSearchRequest(body);
  if (validationError) return json({ ok: false, error: "invalid_request", message: validationError }, 400);
  try {
    const response = await exportPropertyDiscussions(env, body);
    return json({ ok: true, data: response });
  } catch (error) {
    return json({
      ok: false,
      error: "property_discussion_export_failed",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

async function runSearch(
  env: ApiWorkerEnv,
  body: PropertyDiscussionSearchRequest
): Promise<Response> {
  const validationError = validateSearchRequest(body);
  if (validationError) {
    return json({ ok: false, error: "invalid_request", message: validationError }, 400);
  }

  try {
    const response = await searchPropertyDiscussions(env, body);
    return json({ ok: true, data: response });
  } catch (error) {
    return json({
      ok: false,
      error: "property_discussion_search_failed",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

function requestFromQuery(params: URLSearchParams): PropertyDiscussionSearchRequest {
  const sources = params.get("sources")
    ?.split(",")
    .map((value) => value.trim())
    .filter((value): value is DiscussionSource => value === "xiaohongshu" || value === "reddit");
  return {
    property: {
      address: params.get("address") || undefined,
      city: params.get("city") || undefined,
      neighborhood: params.get("neighborhood") || undefined,
      zipCode: params.get("zipCode") || undefined,
      county: params.get("county") || undefined,
      mlsNumber: params.get("mlsNumber") || undefined,
      listingUrl: params.get("listingUrl") || undefined,
    },
    query: params.get("q") || undefined,
    sources,
    maxResults: parseOptionalInt(params.get("maxResults")),
    includeComments: parseOptionalBoolean(params.get("includeComments")),
    refresh: parseOptionalBoolean(params.get("refresh")),
  };
}

function isAuthorized(request: Request, env: ApiWorkerEnv): boolean {
  if (!env.DISCOVERY_API_KEY) return true;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const apiKey = request.headers.get("x-api-key");
  return bearer === env.DISCOVERY_API_KEY || apiKey === env.DISCOVERY_API_KEY;
}

function parseOptionalInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  return value === "true" || value === "1";
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
