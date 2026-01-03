import { Node, NodeContext } from "../runtime/node";

export interface FilterFeedsInput {
  feeds?: Array<{
    id: string;
    xsec_token?: string;
    xsecToken?: string;
    title?: string;
    likes?: number;
    likedCount?: string;
    author?: string;
    userId?: string;
  }>;
  // From raw API response
  raw?: {
    data?: {
      feeds?: Array<{
        id: string;
        xsecToken: string;
        noteCard?: {
          displayTitle?: string;
          user?: { userId?: string; nickname?: string };
          interactInfo?: { likedCount?: string };
        };
      }>;
    };
  };
  maxPosts?: number;
  minLikes?: number;
  maxLikes?: number;
  skipAuthors?: string[];
}

export interface FilteredFeed {
  id: string;
  xsecToken: string;
  title: string;
  author: string;
  authorId: string;
  likes: number;
}

export interface FilterFeedsOutput {
  feeds: FilteredFeed[];
  filtered: number;
  total: number;
}

/**
 * FilterFeedsNode: Filters search results to top N posts
 * Applies optional filters like min/max likes and author blocklist
 */
export class FilterFeedsNode implements Node<FilterFeedsInput, FilterFeedsOutput> {
  type = "filter_feeds";

  async run(ctx: NodeContext, input: FilterFeedsInput): Promise<FilterFeedsOutput> {
    ctx.logger.info("Filtering feeds", { maxPosts: input.maxPosts });

    // Extract feeds from raw API response or direct input
    let rawFeeds: any[] = [];

    if (input.raw?.data?.feeds) {
      rawFeeds = input.raw.data.feeds;
    } else if (input.feeds) {
      rawFeeds = input.feeds;
    }

    // Normalize feed structure
    const normalizedFeeds: FilteredFeed[] = rawFeeds
      .filter((f: any) => f.id && (f.xsecToken || f.xsec_token))
      .map((f: any) => ({
        id: f.id,
        xsecToken: f.xsecToken || f.xsec_token,
        title: f.noteCard?.displayTitle || f.title || "",
        author: f.noteCard?.user?.nickname || f.author || "Unknown",
        authorId: f.noteCard?.user?.userId || f.userId || "",
        likes: parseInt(f.noteCard?.interactInfo?.likedCount || f.likedCount || f.likes || "0", 10)
      }));

    const total = normalizedFeeds.length;

    // Apply filters
    let filtered = normalizedFeeds.filter(feed => {
      // Skip empty titles
      if (!feed.title) return false;

      // Min likes filter
      if (input.minLikes !== undefined && feed.likes < input.minLikes) {
        return false;
      }

      // Max likes filter
      if (input.maxLikes !== undefined && feed.likes > input.maxLikes) {
        return false;
      }

      // Skip authors filter
      if (input.skipAuthors && input.skipAuthors.includes(feed.authorId)) {
        return false;
      }

      return true;
    });

    // Limit to maxPosts
    const maxPosts = input.maxPosts || 5;
    filtered = filtered.slice(0, maxPosts);

    ctx.logger.info("Filtered feeds", { total, filtered: filtered.length });

    return {
      feeds: filtered,
      filtered: filtered.length,
      total
    };
  }
}
