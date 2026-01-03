import { Node, NodeContext } from "../runtime/node";
import { ActionRequest } from "@social-agent/schemas";

export interface BatchEngageInput {
  feeds?: Array<{
    id: string;
    xsecToken: string;
    title: string;
    author: string;
    authorId: string;
    likes: number;
  }>;
  like?: boolean;
  comment?: boolean;
  commentMode?: "template" | "ai" | "both";
  commentTemplates?: string[];
  aiPrompt?: string;
  baseUrl?: string;
  userId?: string;
  workspaceId?: string;
}

export interface BatchEngageOutput {
  type: "action_batch";
  actions: ActionRequest[];
  summary: {
    totalFeeds: number;
    likeActions: number;
    commentActions: number;
  };
}

/**
 * BatchEngageNode: Creates like and comment actions for filtered feeds
 * Handles both template-based and AI-generated comments
 */
export class BatchEngageNode implements Node<BatchEngageInput, BatchEngageOutput> {
  type = "batch_engage";

  async run(ctx: NodeContext, input: BatchEngageInput): Promise<BatchEngageOutput> {
    const feeds = input.feeds || [];
    const actions: ActionRequest[] = [];
    let likeActions = 0;
    let commentActions = 0;

    ctx.logger.info("Batch engage", {
      feedCount: feeds.length,
      like: input.like,
      comment: input.comment
    });

    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i];
      const timestamp = Date.now() + i; // Ensure unique IDs

      // Create like action
      if (input.like !== false) {
        actions.push({
          requestId: `${ctx.runId}_like_${feed.id}_${timestamp}`,
          userId: input.userId || "system",
          workspaceId: input.workspaceId || "default",
          platform: "xiaohongshu",
          action: "like_post",
          mode: "api",
          policyContext: { requiresApproval: false },
          traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
          payload: {
            feedId: feed.id,
            xsecToken: feed.xsecToken,
            like: true,
            baseUrl: input.baseUrl
          }
        });
        likeActions++;
      }

      // Create comment action
      if (input.comment !== false) {
        const comment = await this.generateComment(input, feed, ctx);

        if (comment) {
          actions.push({
            requestId: `${ctx.runId}_comment_${feed.id}_${timestamp}`,
            userId: input.userId || "system",
            workspaceId: input.workspaceId || "default",
            platform: "xiaohongshu",
            action: "comment_post",
            mode: "api",
            policyContext: { requiresApproval: false },
            traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
            payload: {
              feedId: feed.id,
              xsecToken: feed.xsecToken,
              content: comment,
              baseUrl: input.baseUrl
            }
          });
          commentActions++;
        }
      }
    }

    ctx.logger.info("Batch engage complete", {
      totalActions: actions.length,
      likeActions,
      commentActions
    });

    return {
      type: "action_batch",
      actions,
      summary: {
        totalFeeds: feeds.length,
        likeActions,
        commentActions
      }
    };
  }

  /**
   * Generate a comment based on the configured mode
   */
  private async generateComment(
    input: BatchEngageInput,
    feed: { title: string; author: string },
    ctx: NodeContext
  ): Promise<string | null> {
    const mode = input.commentMode || "template";
    const templates = input.commentTemplates || [];

    // Default templates if none provided
    const defaultTemplates = [
      "很棒的分享！",
      "学到了，谢谢分享",
      "说得太好了",
      "收藏了，感谢",
      "很有帮助的内容",
      "这个内容很实用",
      "感谢博主分享",
      "很有启发"
    ];

    const allTemplates = templates.length > 0 ? templates : defaultTemplates;

    if (mode === "template") {
      // Random template selection
      return allTemplates[Math.floor(Math.random() * allTemplates.length)];
    }

    if (mode === "ai") {
      // AI-generated comment
      // For now, return a template-based fallback
      // TODO: Integrate with Claude API for AI-generated comments
      ctx.logger.info("AI comment generation not yet implemented, using template");
      return allTemplates[Math.floor(Math.random() * allTemplates.length)];
    }

    if (mode === "both") {
      // 50/50 chance of template vs AI
      if (Math.random() < 0.5) {
        return allTemplates[Math.floor(Math.random() * allTemplates.length)];
      } else {
        // AI fallback to template for now
        return allTemplates[Math.floor(Math.random() * allTemplates.length)];
      }
    }

    return null;
  }
}
