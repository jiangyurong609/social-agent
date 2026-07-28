export type DiscussionSource = "xiaohongshu" | "reddit";

export interface PropertyDescriptor {
  address?: string;
  city?: string;
  neighborhood?: string;
  zipCode?: string;
  county?: string;
  mlsNumber?: string;
  listingUrl?: string;
}

export interface PropertyDiscussionSearchRequest {
  property?: PropertyDescriptor;
  query?: string;
  sources?: DiscussionSource[];
  maxResults?: number;
  maxQueriesPerSource?: number;
  includeComments?: boolean;
  commentsPerItem?: number;
  refresh?: boolean;
  cacheTtlSeconds?: number;
}

export interface DiscussionImage {
  url: string;
  alt?: string;
  type: "cover" | "content" | "thumbnail" | "unknown";
  width?: number;
  height?: number;
}

export type DiscussionTag = string;

export interface DiscussionComment {
  id: string;
  author?: string;
  content: string;
  score?: number;
  publishedAt?: string;
  sourceUrl?: string;
}

export interface DiscussionClaim {
  type: "offer_count" | "offer_price" | "pending_price" | "price_mention";
  value: string;
  numericValue?: number;
  currency?: "USD" | "CNY";
  evidence: string;
  verification: "unverified";
}

export interface PropertyMatch {
  score: number;
  signals: string[];
  matchedQueries: string[];
}

export interface PropertyDiscussion {
  id: string;
  source: DiscussionSource;
  sourceId: string;
  sourceUrl: string;
  title: string;
  content: string;
  hashtags: DiscussionTag[];
  language: "en" | "zh" | "mixed" | "unknown";
  author?: {
    id?: string;
    name?: string;
    avatarUrl?: string;
  };
  publishedAt?: string;
  images: DiscussionImage[];
  comments: DiscussionComment[];
  metrics: {
    likes?: number;
    comments?: number;
    score?: number;
    collects?: number;
  };
  claims: DiscussionClaim[];
  propertyMatch: PropertyMatch;
  metadata?: Record<string, unknown>;
}

export interface SourceStatus {
  source: DiscussionSource;
  status: "ok" | "partial" | "unavailable" | "error";
  queriesAttempted: number;
  itemsFound: number;
  message?: string;
}

export interface PropertyDiscussionSearchResponse {
  schemaVersion: "property-discussions.v1";
  snapshotId: string;
  cached: boolean;
  generatedAt: string;
  expiresAt: string;
  request: {
    property?: PropertyDescriptor;
    query?: string;
    sources: DiscussionSource[];
  };
  generatedQueries: Record<DiscussionSource, string[]>;
  sourceStatus: SourceStatus[];
  items: PropertyDiscussion[];
  llm: {
    contentType: "text/markdown";
    document: string;
    cautions: string[];
  };
}

export interface PropertyDiscussionExportResponse {
  schemaVersion: "property-discussions.export.v1";
  exportId: string;
  generatedAt: string;
  recordCount: number;
  format: "jsonl";
  records: Array<{
    recordType: "discussion";
    schemaVersion: "property-discussion.record.v1";
    record: PropertyDiscussion;
  }>;
  jsonl: string;
  sourceStatus: SourceStatus[];
  generatedQueries: Record<DiscussionSource, string[]>;
}

export interface SourceSearchResult {
  items: Omit<PropertyDiscussion, "claims" | "propertyMatch">[];
  status: SourceStatus;
}
