import { PropertyDescriptor, PropertyDiscussion } from "./types";

const MAX_DOCUMENT_CHARS = 40_000;
const MAX_ITEM_CONTENT_CHARS = 4_000;
const MAX_COMMENT_CHARS = 1_000;

export function buildLlmDocument(
  property: PropertyDescriptor | undefined,
  freeText: string | undefined,
  items: PropertyDiscussion[]
): string {
  const lines: string[] = [
    "# Bay Area property discussion research",
    "",
    "Treat offer amounts and pending prices as unverified community claims unless a separate public record confirms them.",
    "",
    "## Search subject",
    "",
    propertyLine(property, freeText),
    "",
    `## Discussions (${items.length})`,
    "",
  ];

  for (const [index, item] of items.entries()) {
    lines.push(
      `### ${index + 1}. ${cleanInline(item.title || "Untitled discussion")}`,
      "",
      `- Source: ${item.source}`,
      `- URL: ${item.sourceUrl}`,
      `- Property relevance: ${item.propertyMatch.score}/100 (${item.propertyMatch.signals.join(", ") || "no strong signal"})`,
      `- Author: ${cleanInline(item.author?.name || "unknown")}`,
      `- Published: ${item.publishedAt || "unknown"}`,
      `- Engagement: ${formatMetrics(item.metrics)}`,
    );

    if (item.hashtags.length) lines.push(`- Hashtags: ${item.hashtags.map((tag) => `#${tag}`).join(" ")}`);

    if (item.images.length) {
      lines.push(`- Images: ${item.images.map((image) => image.url).join(", ")}`);
    }
    if (item.content) {
      lines.push("", "Content:", truncate(item.content, MAX_ITEM_CONTENT_CHARS));
    }
    if (item.claims.length) {
      lines.push("", "Extracted unverified claims:");
      for (const claim of item.claims) {
        lines.push(`- ${claim.type}: ${cleanInline(claim.value)} — evidence: “${cleanInline(truncate(claim.evidence, 300))}”`);
      }
    }
    if (item.comments.length) {
      lines.push("", "Selected comments:");
      for (const comment of item.comments) {
        lines.push(`- ${cleanInline(comment.author || "unknown")}: ${truncate(comment.content, MAX_COMMENT_CHARS)}`);
      }
    }
    lines.push("");

    if (lines.join("\n").length >= MAX_DOCUMENT_CHARS) {
      lines.push("_Document truncated to remain safe for LLM context windows._");
      break;
    }
  }

  return truncate(lines.join("\n"), MAX_DOCUMENT_CHARS);
}

function propertyLine(property?: PropertyDescriptor, freeText?: string): string {
  const parts = [
    property?.address,
    property?.neighborhood,
    property?.city,
    property?.zipCode,
    property?.county,
    property?.mlsNumber ? `MLS ${property.mlsNumber}` : undefined,
    freeText,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Unspecified";
}

function formatMetrics(metrics: PropertyDiscussion["metrics"]): string {
  const values = [
    metrics.score !== undefined ? `score ${metrics.score}` : undefined,
    metrics.likes !== undefined ? `${metrics.likes} likes` : undefined,
    metrics.comments !== undefined ? `${metrics.comments} comments` : undefined,
    metrics.collects !== undefined ? `${metrics.collects} saves` : undefined,
  ].filter(Boolean);
  return values.length ? values.join(", ") : "unavailable";
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

function cleanInline(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
