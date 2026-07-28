import { ApiWorkerEnv } from "../../config";
import { detectLanguage } from "../query";
import {
  DiscussionComment,
  DiscussionImage,
  PropertyDiscussion,
  SourceSearchResult,
} from "../types";

interface XiaohongshuSearchOptions {
  queries: string[];
  maxResults: number;
  includeComments: boolean;
  commentsPerItem: number;
}

interface XhsCandidate {
  id: string;
  xsecToken: string;
  matchedQueries: string[];
  raw: Record<string, unknown>;
}

export async function searchXiaohongshu(
  env: ApiWorkerEnv,
  options: XiaohongshuSearchOptions
): Promise<SourceSearchResult> {
  if (!env.XHS_MCP_BASE) {
    return {
      items: [],
      status: {
        source: "xiaohongshu",
        status: "unavailable",
        queriesAttempted: 0,
        itemsFound: 0,
        message: "XHS_MCP_BASE is not configured",
      },
    };
  }

  const candidates = new Map<string, XhsCandidate>();
  let failedQueries = 0;

  for (const query of options.queries) {
    try {
      const response = await fetch(`${env.XHS_MCP_BASE}/api/v1/feeds/search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(18_000),
        body: JSON.stringify({
          keyword: query,
          page: 1,
          sort_by: "general",
          note_type: "all",
        }),
      });
      if (!response.ok) {
        failedQueries++;
        continue;
      }

      const payload = await response.json() as Record<string, unknown>;
      const feeds = getArray(getObject(payload.data)?.feeds);
      for (const value of feeds) {
        const feed = getObject(value);
        if (!feed) continue;
        const id = getString(feed.id);
        const xsecToken = getString(feed.xsecToken) || getString(feed.xsec_token);
        if (!id || !xsecToken) continue;

        const existing = candidates.get(id);
        if (existing) {
          if (!existing.matchedQueries.includes(query)) existing.matchedQueries.push(query);
        } else {
          candidates.set(id, { id, xsecToken, matchedQueries: [query], raw: feed });
        }
      }
    } catch {
      failedQueries++;
    }
  }

  const selected = Array.from(candidates.values()).slice(0, options.maxResults);
  const detailLimit = Math.min(selected.length, 10);
  const items = await Promise.all(selected.map(async (candidate, index) => {
    if (index >= detailLimit) return normalizeSearchCandidate(candidate);
    return fetchAndNormalizeDetail(env.XHS_MCP_BASE!, candidate, options);
  }));

  return {
    items,
    status: {
      source: "xiaohongshu",
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

async function fetchAndNormalizeDetail(
  baseUrl: string,
  candidate: XhsCandidate,
  options: XiaohongshuSearchOptions
): Promise<Omit<PropertyDiscussion, "claims" | "propertyMatch">> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/feeds/detail`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(18_000),
      body: JSON.stringify({
        feed_id: candidate.id,
        xsec_token: candidate.xsecToken,
        load_all_comments: options.includeComments,
      }),
    });
    if (!response.ok) return normalizeSearchCandidate(candidate);
    const payload = await response.json() as Record<string, unknown>;
    const envelope = getObject(payload.data);
    const detail = getObject(envelope?.data) || envelope;
    return detail ? normalizeDetail(candidate, detail, options.commentsPerItem) : normalizeSearchCandidate(candidate);
  } catch {
    return normalizeSearchCandidate(candidate);
  }
}

function normalizeSearchCandidate(
  candidate: XhsCandidate
): Omit<PropertyDiscussion, "claims" | "propertyMatch"> {
  const noteCard = getObject(candidate.raw.noteCard);
  const user = getObject(noteCard?.user);
  const interaction = getObject(noteCard?.interactInfo);
  const cover = getObject(noteCard?.cover);
  const title = getString(noteCard?.displayTitle) || getString(noteCard?.title) || "";
  const coverUrl = getString(cover?.urlDefault) || getString(cover?.urlPre);

  return {
    id: `xiaohongshu:${candidate.id}`,
    source: "xiaohongshu",
    sourceId: candidate.id,
    sourceUrl: buildXhsUrl(candidate.id, candidate.xsecToken),
    title,
    content: "",
    hashtags: normalizeHashtags(candidate.raw),
    language: detectLanguage(title),
    author: {
      id: getString(user?.userId),
      name: getString(user?.nickname),
      avatarUrl: getString(user?.avatar),
    },
    images: coverUrl ? [{ url: coverUrl, alt: title, type: "cover" }] : [],
    comments: [],
    metrics: {
      likes: parseCount(interaction?.likedCount),
      comments: parseCount(interaction?.commentCount),
      collects: parseCount(interaction?.collectedCount),
    },
    metadata: {
      matchedQueries: candidate.matchedQueries,
      xsecToken: candidate.xsecToken,
      detailLoaded: false,
    },
  };
}

function normalizeDetail(
  candidate: XhsCandidate,
  detail: Record<string, unknown>,
  commentsLimit: number
): Omit<PropertyDiscussion, "claims" | "propertyMatch"> {
  const fallback = normalizeSearchCandidate(candidate);
  // The MCP detail endpoint wraps the note payload under `data.note` and
  // comments under `data.comments`; retain the wrapper-independent fallback
  // so older connector versions remain ingestible.
  const note = getObject(detail.note) || detail;
  const user = getObject(note.user);
  const interaction = getObject(note.interactInfo);
  const title = getString(note.title) || getString(note.displayTitle) || fallback.title;
  const content = getString(note.desc) || getString(note.content) || "";
  const images = normalizeImages(note.imageList, title);
  const comments = normalizeComments(detail, commentsLimit);
  const hashtags = normalizeHashtags({ ...note, content });

  return {
    ...fallback,
    title,
    content,
    hashtags: hashtags.length ? hashtags : fallback.hashtags,
    language: detectLanguage(`${title} ${content}`),
    author: {
      id: getString(user?.userId) || fallback.author?.id,
      name: getString(user?.nickname) || fallback.author?.name,
      avatarUrl: getString(user?.avatar) || fallback.author?.avatarUrl,
    },
    images: images.length ? images : fallback.images,
    comments,
    publishedAt: normalizeTimestamp(note.time) || fallback.publishedAt,
    metrics: {
      likes: parseCount(interaction?.likedCount) ?? fallback.metrics.likes,
      comments: parseCount(interaction?.commentCount) ?? fallback.metrics.comments,
      collects: parseCount(interaction?.collectedCount) ?? fallback.metrics.collects,
    },
    metadata: {
      ...fallback.metadata,
      detailLoaded: true,
    },
  };
}

function normalizeHashtags(value: Record<string, unknown>): string[] {
  const candidates = [value.hashtags, value.hashTags, value.tagList, value.tags];
  const tags = candidates.flatMap(getArray).flatMap((item) => {
    if (typeof item === "string") return [item.replace(/^#/, "").trim()];
    const object = getObject(item);
    const tag = getString(object?.name) || getString(object?.tag) || getString(object?.text);
    return tag ? [tag.replace(/^#/, "").trim()] : [];
  });
  const text = [getString(value.desc), getString(value.content)].filter(Boolean).join(" ");
  for (const match of text.matchAll(/#([^#\s]+?)(?:\[话题\])?#/g)) tags.push(match[1]);
  return tags.map((tag) => tag.replace(/^#/, "").trim())
    .filter((tag, index, all) => tag.length > 0 && all.indexOf(tag) === index).slice(0, 50);
}

function normalizeImages(value: unknown, title: string): DiscussionImage[] {
  return getArray(value).flatMap((item) => {
    const image = getObject(item);
    const url = getString(image?.url) || getString(image?.urlDefault) || getString(image?.urlPre);
    if (!url) return [];
    return [{
      url,
      alt: title,
      type: "content" as const,
      width: getNumber(image?.width),
      height: getNumber(image?.height),
    }];
  });
}

function normalizeComments(detail: Record<string, unknown>, limit: number): DiscussionComment[] {
  const candidates = [
    detail.comments,
    detail.commentList,
    getObject(detail.comments)?.list,
    getObject(detail.comments)?.comments,
  ];
  const raw = candidates.map(getArray).find((items) => items.length) || [];

  const flattened: unknown[] = [];
  const visit = (value: unknown) => {
    if (flattened.length >= limit) return;
    flattened.push(value);
    const object = getObject(value);
    for (const reply of getArray(object?.subComments)) visit(reply);
  };
  raw.forEach(visit);

  return flattened.slice(0, limit).flatMap((value, index) => {
    const comment = getObject(value);
    if (!comment) return [];
    const content = getString(comment.content) || getString(comment.text);
    if (!content) return [];
    const user = getObject(comment.user) || getObject(comment.userInfo);
    return [{
      id: getString(comment.id) || getString(comment.commentId) || `comment-${index}`,
      author: getString(user?.nickname) || getString(comment.nickname),
      content,
      score: parseCount(comment.likeCount) || parseCount(comment.likedCount),
      publishedAt: normalizeTimestamp(comment.createTime || comment.createdAt),
    }];
  });
}

function buildXhsUrl(id: string, xsecToken: string): string {
  const params = new URLSearchParams({ xsec_token: xsecToken, xsec_source: "pc_search" });
  return `https://www.xiaohongshu.com/explore/${encodeURIComponent(id)}?${params.toString()}`;
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  if (typeof value === "number") {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  return undefined;
}

function parseCount(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim().toLowerCase().replace(/,/g, "");
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount)) return undefined;
  if (normalized.includes("万")) return Math.round(amount * 10_000);
  if (normalized.endsWith("k")) return Math.round(amount * 1_000);
  if (normalized.endsWith("m")) return Math.round(amount * 1_000_000);
  return Math.round(amount);
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
