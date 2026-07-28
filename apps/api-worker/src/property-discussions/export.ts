import { ApiWorkerEnv } from "../config";
import { searchPropertyDiscussions } from "./service";
import {
  PropertyDiscussionExportResponse,
  PropertyDiscussionSearchRequest,
} from "./types";

export async function exportPropertyDiscussions(
  env: ApiWorkerEnv,
  input: PropertyDiscussionSearchRequest
): Promise<PropertyDiscussionExportResponse> {
  // Keep exports within a Worker request while allowing the caller to request
  // the largest supported search batch. The JSONL shape is append-friendly.
  const response = await searchPropertyDiscussions(env, {
    ...input,
    maxResults: Math.min(input.maxResults ?? 50, 50),
    refresh: input.refresh ?? true,
  });
  const exportId = `pde_${crypto.randomUUID()}`;
  const records = response.items.map((record) => ({
    recordType: "discussion" as const,
    schemaVersion: "property-discussion.record.v1" as const,
    record,
  }));
  const header = {
    recordType: "export" as const,
    schemaVersion: "property-discussions.export.v1" as const,
    exportId,
    generatedAt: response.generatedAt,
    recordCount: records.length,
    sourceStatus: response.sourceStatus,
    generatedQueries: response.generatedQueries,
  };
  return {
    ...header,
    format: "jsonl",
    records,
    jsonl: [header, ...records].map((record) => JSON.stringify(record)).join("\n") + "\n",
  };
}
