import {
  DiscussionClaim,
  DiscussionSource,
  PropertyDescriptor,
  PropertyDiscussion,
  PropertyDiscussionSearchRequest,
  PropertyMatch,
} from "./types";

const TRANSACTION_TERMS = [
  "offer", "offers", "pending", "contingent", "sold", "close", "closing",
  "bid", "bidding", "list price", "sale price", "disclosure", "inspection",
  "出价", "加价", "抢房", "成交价", "成交", "待售", "房价", "报价", "验房",
];

const REAL_ESTATE_TERMS = [
  "real estate", "property", "properties", "home", "homes", "house", "houses",
  "housing", "listing", "listed", "realtor", "mortgage", "escrow", "title insurance",
  "condo", "townhouse", "single family", "open house", "mls",
  "买房", "卖房", "房产", "房子", "房价", "房源", "地产", "经纪", "贷款", "学区房",
];

const ENGLISH_SUFFIXES = [
  "offers pending price",
  "multiple offers bidding",
  "listing price sale price",
  "inspection disclosures",
];

const CHINESE_SUFFIXES = [
  "offer 加价 成交价",
  "买房 pending 价格",
  "抢房 出价",
  "验房 disclosure",
];

export function validateSearchRequest(input: PropertyDiscussionSearchRequest): string | null {
  const property = input.property;
  const hasProperty = Boolean(
    property?.address ||
    property?.city ||
    property?.neighborhood ||
    property?.zipCode ||
    property?.county ||
    property?.mlsNumber ||
    property?.listingUrl
  );

  if (!hasProperty && !input.query?.trim()) {
    return "Provide at least one property field or a free-text query";
  }
  if (input.maxResults !== undefined && (input.maxResults < 1 || input.maxResults > 50)) {
    return "maxResults must be between 1 and 50";
  }
  if (
    input.maxQueriesPerSource !== undefined &&
    (input.maxQueriesPerSource < 1 || input.maxQueriesPerSource > 12)
  ) {
    return "maxQueriesPerSource must be between 1 and 12";
  }
  return null;
}

export function normalizeRequest(input: PropertyDiscussionSearchRequest): Required<
  Pick<
    PropertyDiscussionSearchRequest,
    "sources" | "maxResults" | "maxQueriesPerSource" | "includeComments" | "commentsPerItem" | "refresh" | "cacheTtlSeconds"
  >
> & Pick<PropertyDiscussionSearchRequest, "property" | "query"> {
  const sources = input.sources?.filter(
    (source): source is DiscussionSource => source === "xiaohongshu" || source === "reddit"
  );

  return {
    property: cleanProperty(input.property),
    query: input.query?.trim() || undefined,
    sources: sources?.length ? Array.from(new Set(sources)) : ["xiaohongshu", "reddit"],
    maxResults: clamp(input.maxResults ?? 20, 1, 50),
    maxQueriesPerSource: clamp(input.maxQueriesPerSource ?? 6, 1, 12),
    includeComments: input.includeComments ?? true,
    commentsPerItem: clamp(input.commentsPerItem ?? 5, 0, 20),
    refresh: input.refresh ?? false,
    cacheTtlSeconds: clamp(input.cacheTtlSeconds ?? 900, 60, 86400),
  };
}

function cleanProperty(property?: PropertyDescriptor): PropertyDescriptor | undefined {
  if (!property) return undefined;
  const cleaned = Object.fromEntries(
    Object.entries(property)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter(([, value]) => Boolean(value))
  ) as PropertyDescriptor;
  return Object.keys(cleaned).length ? cleaned : undefined;
}

export function generateQueries(
  property: PropertyDescriptor | undefined,
  freeText: string | undefined,
  limit: number
): Record<DiscussionSource, string[]> {
  const exact: string[] = [];
  const locationParts = [
    property?.neighborhood,
    property?.city,
    property?.zipCode,
    property?.county,
  ].filter(Boolean) as string[];
  const location = locationParts.join(" ");

  pushUnique(exact, property?.address ? [property.address, property.city].filter(Boolean).join(" ") : undefined);
  pushUnique(exact, property?.mlsNumber);
  pushUnique(exact, property?.listingUrl);
  const propertyAnchor = property?.address || location || property?.mlsNumber || property?.listingUrl;
  pushUnique(exact, propertyAnchor && freeText ? `${propertyAnchor} real estate ${freeText}` : freeText);

  const reddit = [...exact];
  const xiaohongshu = [...exact];
  const base = property?.address || location || freeText;

  if (base) {
    for (const suffix of ENGLISH_SUFFIXES) pushUnique(reddit, `${base} ${suffix}`);
    for (const suffix of CHINESE_SUFFIXES) pushUnique(xiaohongshu, `${base} ${suffix}`);
  }
  if (location) {
    pushUnique(reddit, `${location} real estate`);
    pushUnique(reddit, `${location} house offer`);
    pushUnique(xiaohongshu, `湾区买房 ${location}`);
    pushUnique(xiaohongshu, `${location} 学区房`);
  }

  return {
    xiaohongshu: xiaohongshu.slice(0, limit),
    reddit: reddit.slice(0, limit),
  };
}

export function scorePropertyMatch(
  item: Pick<PropertyDiscussion, "title" | "content" | "comments" | "sourceUrl">,
  property: PropertyDescriptor | undefined,
  freeText: string | undefined,
  matchedQueries: string[]
): PropertyMatch {
  const text = normalizeText([
    item.title,
    item.content,
    ...item.comments.map((comment) => comment.content),
    item.sourceUrl,
  ].join(" "));
  let score = 0;
  const signals: string[] = [];

  score += matchSignal(text, property?.address, 38, "exact_address", signals);
  score += matchSignal(text, property?.mlsNumber, 40, "mls_number", signals);
  score += matchSignal(text, property?.listingUrl, 35, "listing_url", signals);
  score += matchSignal(text, property?.neighborhood, 18, "neighborhood", signals);
  score += matchSignal(text, property?.zipCode, 15, "zip_code", signals);
  score += matchSignal(text, property?.city, 12, "city", signals);
  score += matchSignal(text, property?.county, 10, "county", signals);

  const queryTokens = tokenize(freeText || "");
  if (queryTokens.length) {
    const overlap = queryTokens.filter((token) => text.includes(token)).length;
    if (overlap) {
      score += Math.min(20, Math.round((overlap / queryTokens.length) * 20));
      signals.push("query_terms");
    }
  }

  if (TRANSACTION_TERMS.some((term) => text.includes(normalizeText(term)))) {
    score += 10;
    signals.push("transaction_discussion");
  }

  if (REAL_ESTATE_TERMS.some((term) => text.includes(normalizeText(term)))) {
    score += 15;
    signals.push("real_estate_context");
  }

  if (matchedQueries.length) {
    score += Math.min(5, matchedQueries.length);
    signals.push("multi_query_match");
  }

  return { score: Math.min(100, score), signals, matchedQueries };
}

export function extractClaims(text: string): DiscussionClaim[] {
  const claims: DiscussionClaim[] = [];
  const snippets = splitIntoSnippets(text);

  for (const snippet of snippets) {
    const lower = snippet.toLowerCase();
    const type = lower.includes("pending") || lower.includes("成交")
      ? "pending_price"
      : lower.includes("offer") || lower.includes("出价") || lower.includes("报价") || lower.includes("加价")
        ? "offer_price"
        : "price_mention";

    const usdPattern = /\$\s?(\d+(?:\.\d+)?)\s?(m|mm|k|million|thousand)?\b/gi;
    for (const match of snippet.matchAll(usdPattern)) {
      claims.push({
        type,
        value: match[0],
        numericValue: parseUsdAmount(match[1], match[2]),
        currency: "USD",
        evidence: snippet,
        verification: "unverified",
      });
    }

    const chinesePricePattern = /(\d+(?:\.\d+)?)\s*万(?:美金|美元|刀)?/g;
    for (const match of snippet.matchAll(chinesePricePattern)) {
      claims.push({
        type,
        value: match[0],
        numericValue: Number(match[1]) * 10_000,
        currency: "USD",
        evidence: snippet,
        verification: "unverified",
      });
    }

    const offerCountPatterns = [
      /(\d+)\s+(?:total\s+)?offers?\b/i,
      /(?:received|got|有|收到)\s*(\d+)\s*(?:个|份)?\s*offers?/i,
      /(\d+)\s*(?:个|份)\s*(?:offer|出价|报价)/i,
    ];
    for (const pattern of offerCountPatterns) {
      const match = snippet.match(pattern);
      if (match) {
        claims.push({
          type: "offer_count",
          value: match[1],
          numericValue: Number(match[1]),
          evidence: snippet,
          verification: "unverified",
        });
        break;
      }
    }
  }

  return dedupeClaims(claims).slice(0, 12);
}

export function detectLanguage(text: string): "en" | "zh" | "mixed" | "unknown" {
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (text.match(/[a-z]/gi) || []).length;
  if (!chinese && !latin) return "unknown";
  if (chinese > 2 && latin > 10) return "mixed";
  return chinese > 2 ? "zh" : "en";
}

function matchSignal(
  haystack: string,
  needle: string | undefined,
  weight: number,
  signal: string,
  signals: string[]
): number {
  if (!needle) return 0;
  const normalized = normalizeText(needle);
  if (normalized.length >= 2 && haystack.includes(normalized)) {
    signals.push(signal);
    return weight;
  }
  return 0;
}

function splitIntoSnippets(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 100);
}

function parseUsdAmount(value: string, suffix?: string): number {
  const amount = Number(value);
  const normalizedSuffix = suffix?.toLowerCase();
  if (normalizedSuffix === "m" || normalizedSuffix === "mm" || normalizedSuffix === "million") {
    return amount * 1_000_000;
  }
  if (normalizedSuffix === "k" || normalizedSuffix === "thousand") {
    return amount * 1_000;
  }
  return amount;
}

function dedupeClaims(claims: DiscussionClaim[]): DiscussionClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.type}:${claim.value}:${claim.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(normalizeText(value).split(/[^a-z0-9\u3400-\u9fff]+/).filter((token) => token.length >= 2))
  );
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\s+/g, " ")
    .trim();
}

function pushUnique(items: string[], value?: string): void {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  if (cleaned && !items.some((item) => item.toLowerCase() === cleaned.toLowerCase())) {
    items.push(cleaned);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}
