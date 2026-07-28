import { ApiWorkerEnv } from "../../config";
import { detectLanguage } from "../query";
import {
  DiscussionComment,
  DiscussionImage,
  PropertyDiscussion,
  SourceSearchResult,
} from "../types";

interface RedditSearchOptions {
  queries: string[];
  maxResults: number;
  includeComments: boolean;
  commentsPerItem: number;
}

interface RedditCandidate {
  data: Record<string, unknown>;
  matchedQueries: string[];
}

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function searchReddit(
  env: ApiWorkerEnv,
  options: RedditSearchOptions
): Promise<SourceSearchResult> {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) {
    return {
      items: [],
      status: {
        source: "reddit",
        status: "unavailable",
        queriesAttempted: 0,
        itemsFound: 0,
        message: "REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET are not configured",
      },
    };
  }

  let token: string;
  try {
    token = await getAccessToken(env);
  } catch (error) {
    return {
      items: [],
      status: {
        source: "reddit",
        status: "error",
        queriesAttempted: 0,
        itemsFound: 0,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const candidates = new Map<string, RedditCandidate>();
  let failedQueries = 0;

  for (const query of options.queries) {
    try {
      const params = new URLSearchParams({
        q: query,
        sort: "relevance",
        t: "year",
        type: "link",
        limit: String(Math.min(options.maxResults, 25)),
        raw_json: "1",
      });
      const response = await redditFetch(env, token, `/search?${params.toString()}`);
      if (!response.ok) {
        failedQueries++;
        continue;
      }
      const payload = await response.json() as Record<string, unknown>;
      const children = getArray(getObject(payload.data)?.children);
      for (const childValue of children) {
        const child = getObject(childValue);
        const data = getObject(child?.data);
        const id = getString(data?.id);
        if (!data || !id) continue;
        const existing = candidates.get(id);
        if (existing) {
          if (!existing.matchedQueries.includes(query)) existing.matchedQueries.push(query);
        } else {
          candidates.set(id, { data, matchedQueries: [query] });
        }
      }
    } catch {
      failedQueries++;
    }
  }

  const selected = Array.from(candidates.values()).slice(0, options.maxResults);
  const items = await Promise.all(selected.map(async (candidate) => {
    const comments = options.includeComments
      ? await fetchComments(env, token, candidate.data, options.commentsPerItem)
      : [];
    return normalizePost(candidate, comments);
  }));

  return {
    items,
    status: {
      source: "reddit",
      status: failedQueries === options.queries.length
        ? "error"
        : failedQueries > 0
          ? "partial"
          : "ok",
      queriesAttempted: options.queries.length,
      itemsFound: items.length,
      message: failedQueries ? `${failedQueries} search request(s) failed` : undefined,
    },
  };
}

async function getAccessToken(env: ApiWorkerEnv): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;

  const credentials = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": redditUserAgent(env),
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`Reddit OAuth failed with ${response.status}`);

  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Reddit OAuth response did not include an access token");
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in || 3600) * 1000,
  };
  return payload.access_token;
}

async function fetchComments(
  env: ApiWorkerEnv,
  token: string,
  post: Record<string, unknown>,
  limit: number
): Promise<DiscussionComment[]> {
  const id = getString(post.id);
  if (!id || limit <= 0) return [];
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      depth: "1",
      sort: "top",
      raw_json: "1",
    });
    const response = await redditFetch(env, token, `/comments/${encodeURIComponent(id)}?${params.toString()}`);
    if (!response.ok) return [];
    const payload = await response.json() as unknown;
    if (!Array.isArray(payload) || payload.length < 2) return [];
    const listing = getObject(payload[1]);
    const children = getArray(getObject(listing?.data)?.children);
    return children.slice(0, limit).flatMap((childValue) => {
      const data = getObject(getObject(childValue)?.data);
      const body = getString(data?.body);
      if (!data || !body) return [];
      const permalink = getString(data.permalink);
      return [{
        id: getString(data.id) || crypto.randomUUID(),
        author: getString(data.author),
        content: body,
        score: getNumber(data.score),
        publishedAt: epochToIso(data.created_utc),
        sourceUrl: permalink ? `https://www.reddit.com${permalink}` : undefined,
      }];
    });
  } catch {
    return [];
  }
}

function normalizePost(
  candidate: RedditCandidate,
  comments: DiscussionComment[]
): Omit<PropertyDiscussion, "claims" | "propertyMatch"> {
  const post = candidate.data;
  const id = getString(post.id) || crypto.randomUUID();
  const permalink = getString(post.permalink);
  const title = getString(post.title) || "";
  const content = getString(post.selftext) || "";
  const subreddit = getString(post.subreddit);

  return {
    id: `reddit:${id}`,
    source: "reddit",
    sourceId: id,
    sourceUrl: permalink ? `https://www.reddit.com${permalink}` : `https://www.reddit.com/comments/${id}`,
    title,
    content,
    hashtags: normalizeHashtags(title, content),
    language: detectLanguage(`${title} ${content}`),
    author: {
      id: getString(post.author_fullname),
      name: getString(post.author),
    },
    publishedAt: epochToIso(post.created_utc),
    images: normalizeImages(post, title),
    comments,
    metrics: {
      score: getNumber(post.score),
      comments: getNumber(post.num_comments),
    },
    metadata: {
      matchedQueries: candidate.matchedQueries,
      subreddit,
      flair: getString(post.link_flair_text),
      over18: post.over_18 === true,
    },
  };
}

function normalizeHashtags(title: string, content: string): string[] {
  const tags: string[] = [];
  for (const match of `${title}\n${content}`.matchAll(/(^|\s)#([\p{L}\p{N}_-]+)/gu)) {
    if (!tags.includes(match[2])) tags.push(match[2]);
  }
  return tags.slice(0, 50);
}

function normalizeImages(post: Record<string, unknown>, title: string): DiscussionImage[] {
  const images: DiscussionImage[] = [];
  const previewImages = getArray(getObject(post.preview)?.images);
  for (const value of previewImages) {
    const source = getObject(getObject(value)?.source);
    const url = decodeHtml(getString(source?.url));
    if (url) {
      images.push({
        url,
        alt: title,
        type: "content",
        width: getNumber(source?.width),
        height: getNumber(source?.height),
      });
    }
  }
  const thumbnail = getString(post.thumbnail);
  if (images.length === 0 && thumbnail?.startsWith("http")) {
    images.push({ url: decodeHtml(thumbnail)!, alt: title, type: "thumbnail" });
  }
  return images.slice(0, 10);
}

async function redditFetch(
  env: ApiWorkerEnv,
  token: string,
  path: string
): Promise<Response> {
  return fetch(`https://oauth.reddit.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": redditUserAgent(env),
    },
    signal: AbortSignal.timeout(12_000),
  });
}

function redditUserAgent(env: ApiWorkerEnv): string {
  return env.REDDIT_USER_AGENT || "web:social-agent-property-discussions:v1.0";
}

function epochToIso(value: unknown): string | undefined {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : undefined;
}

function decodeHtml(value?: string): string | undefined {
  return value?.replace(/&amp;/g, "&");
}

function getObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
