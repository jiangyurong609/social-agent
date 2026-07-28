import { ApiWorkerEnv } from "../config";
import { PropertyDiscussionSearchResponse } from "./types";

interface SnapshotRow {
  id: string;
  response_json: string;
  expires_at: string;
}

export async function createCacheKey(value: unknown): Promise<string> {
  const input = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getFreshSnapshot(
  env: ApiWorkerEnv,
  cacheKey: string
): Promise<PropertyDiscussionSearchResponse | null> {
  if (!env.D1) return null;
  try {
    const row = await env.D1.prepare(`
      SELECT id, response_json, expires_at
      FROM property_discussion_snapshots
      WHERE cache_key = ? AND expires_at > ?
      LIMIT 1
    `).bind(cacheKey, new Date().toISOString()).first<SnapshotRow>();
    return row ? parseSnapshot(row) : null;
  } catch {
    return null;
  }
}

export async function getSnapshotById(
  env: ApiWorkerEnv,
  snapshotId: string
): Promise<PropertyDiscussionSearchResponse | null> {
  if (!env.D1) return null;
  try {
    const row = await env.D1.prepare(`
      SELECT id, response_json, expires_at
      FROM property_discussion_snapshots
      WHERE id = ?
      LIMIT 1
    `).bind(snapshotId).first<SnapshotRow>();
    return row ? parseSnapshot(row) : null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(
  env: ApiWorkerEnv,
  cacheKey: string,
  request: unknown,
  response: PropertyDiscussionSearchResponse
): Promise<void> {
  if (!env.D1) return;
  try {
    await env.D1.prepare(`
      INSERT INTO property_discussion_snapshots (
        id, cache_key, request_json, response_json, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        id = excluded.id,
        request_json = excluded.request_json,
        response_json = excluded.response_json,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `).bind(
      response.snapshotId,
      cacheKey,
      JSON.stringify(request),
      JSON.stringify(response),
      response.generatedAt,
      response.expiresAt
    ).run();
  } catch (error) {
    console.warn("Unable to cache property discussion snapshot:", error);
  }
}

function parseSnapshot(row: SnapshotRow): PropertyDiscussionSearchResponse | null {
  try {
    const parsed = JSON.parse(row.response_json) as PropertyDiscussionSearchResponse;
    return { ...parsed, snapshotId: row.id, cached: true, expiresAt: row.expires_at };
  } catch {
    return null;
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
