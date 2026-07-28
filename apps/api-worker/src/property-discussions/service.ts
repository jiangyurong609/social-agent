import { ApiWorkerEnv } from "../config";
import { buildLlmDocument } from "./llm";
import {
  extractClaims,
  generateQueries,
  normalizeRequest,
  scorePropertyMatch,
} from "./query";
import { searchReddit } from "./sources/reddit";
import { searchXiaohongshu } from "./sources/xiaohongshu";
import { createCacheKey, getFreshSnapshot, saveSnapshot } from "./storage";
import {
  DiscussionSource,
  PropertyDiscussion,
  PropertyDiscussionSearchRequest,
  PropertyDiscussionSearchResponse,
  SourceSearchResult,
} from "./types";

export async function searchPropertyDiscussions(
  env: ApiWorkerEnv,
  input: PropertyDiscussionSearchRequest
): Promise<PropertyDiscussionSearchResponse> {
  const request = normalizeRequest(input);
  const generatedQueries = generateQueries(
    request.property,
    request.query,
    request.maxQueriesPerSource
  );
  const cacheIdentity = {
    property: request.property,
    query: request.query,
    sources: request.sources,
    maxResults: request.maxResults,
    maxQueriesPerSource: request.maxQueriesPerSource,
    includeComments: request.includeComments,
    commentsPerItem: request.commentsPerItem,
  };
  const cacheKey = await createCacheKey(cacheIdentity);

  if (!request.refresh) {
    const cached = await getFreshSnapshot(env, cacheKey);
    if (cached) return cached;
  }

  const perSourceLimit = Math.max(5, Math.ceil(request.maxResults / request.sources.length));
  const sourceResults = await Promise.all(
    request.sources.map((source) => collectSource(env, source, {
      queries: generatedQueries[source],
      maxResults: perSourceLimit,
      includeComments: request.includeComments,
      commentsPerItem: request.commentsPerItem,
    }))
  );

  const items = sourceResults
    .flatMap((result) => result.items)
    .map((item): PropertyDiscussion => {
      const matchedQueries = readMatchedQueries(item.metadata);
      const claimsText = [
        item.title,
        item.content,
        ...item.comments.map((comment) => comment.content),
      ].join("\n");
      return {
        ...item,
        claims: extractClaims(claimsText),
        propertyMatch: scorePropertyMatch(
          item,
          request.property,
          request.query,
          matchedQueries
        ),
      };
    })
    .filter((item) => isRelevantPropertyDiscussion(item, Boolean(request.property)))
    .sort(compareDiscussions)
    .slice(0, request.maxResults);

  const generatedAt = new Date();
  const response: PropertyDiscussionSearchResponse = {
    schemaVersion: "property-discussions.v1",
    snapshotId: `pds_${crypto.randomUUID()}`,
    cached: false,
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + request.cacheTtlSeconds * 1000).toISOString(),
    request: {
      property: request.property,
      query: request.query,
      sources: request.sources,
    },
    generatedQueries,
    sourceStatus: sourceResults.map((result) => result.status),
    items,
    llm: {
      contentType: "text/markdown",
      document: buildLlmDocument(request.property, request.query, items),
      cautions: [
        "Offer amounts and pending prices are unverified community claims unless independently confirmed.",
        "Do not infer buyer, seller, or resident identities from source content.",
        "Retain source URLs when quoting or summarizing a discussion.",
      ],
    },
  };

  await saveSnapshot(env, cacheKey, cacheIdentity, response);
  return response;
}

function collectSource(
  env: ApiWorkerEnv,
  source: DiscussionSource,
  options: {
    queries: string[];
    maxResults: number;
    includeComments: boolean;
    commentsPerItem: number;
  }
): Promise<SourceSearchResult> {
  return source === "xiaohongshu"
    ? searchXiaohongshu(env, options)
    : searchReddit(env, options);
}

function readMatchedQueries(metadata?: Record<string, unknown>): string[] {
  const value = metadata?.matchedQueries;
  return Array.isArray(value) ? value.filter((query): query is string => typeof query === "string") : [];
}

function compareDiscussions(a: PropertyDiscussion, b: PropertyDiscussion): number {
  if (a.propertyMatch.score !== b.propertyMatch.score) {
    return b.propertyMatch.score - a.propertyMatch.score;
  }
  const engagementA = (a.metrics.score || 0) + (a.metrics.likes || 0) + (a.metrics.comments || 0) * 2;
  const engagementB = (b.metrics.score || 0) + (b.metrics.likes || 0) + (b.metrics.comments || 0) * 2;
  return engagementB - engagementA;
}

function hasPropertySignal(item: PropertyDiscussion): boolean {
  const exactSignals = new Set([
    "exact_address",
    "mls_number",
    "listing_url",
  ]);
  if (item.propertyMatch.signals.some((signal) => exactSignals.has(signal))) return true;

  const locationSignals = new Set([
    "neighborhood",
    "zip_code",
    "city",
    "county",
  ]);
  const hasLocation = item.propertyMatch.signals.some((signal) => locationSignals.has(signal));
  return hasLocation && item.propertyMatch.signals.includes("real_estate_context");
}

export function isRelevantPropertyDiscussion(
  item: PropertyDiscussion,
  hasProperty: boolean
): boolean {
  if (hasProperty) return hasPropertySignal(item);
  return (
    item.propertyMatch.signals.includes("real_estate_context") &&
    item.propertyMatch.score >= 40
  );
}
