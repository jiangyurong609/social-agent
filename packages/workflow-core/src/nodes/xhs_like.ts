import { Node, NodeContext } from "../runtime/node";
import { ActionRequest } from "@social-agent/schemas";

export interface XhsLikeInput {
  feedId: string;
  xsecToken: string;
  like?: boolean;
  baseUrl?: string;
  workspaceId?: string;
}

export interface XhsLikeOutput {
  type: "action_request";
  action: ActionRequest;
}

/**
 * XhsLikeNode: Likes or unlikes a post on Xiaohongshu.
 */
export class XhsLikeNode implements Node<XhsLikeInput, XhsLikeOutput> {
  type = "xhs_like";

  async run(ctx: NodeContext, input: XhsLikeInput): Promise<XhsLikeOutput> {
    ctx.logger.info("XHS like", { feedId: input.feedId, like: input.like !== false });

    const action: ActionRequest = {
      requestId: `${ctx.runId}_${ctx.nodeId}_${Date.now()}`,
      userId: "system",
      workspaceId: input.workspaceId || "default",
      platform: "xiaohongshu",
      action: "like_post",
      mode: "api",
      policyContext: { requiresApproval: false },
      traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
      payload: {
        feedId: input.feedId,
        xsecToken: input.xsecToken,
        like: input.like !== false,
        baseUrl: input.baseUrl
      }
    };

    return { type: "action_request", action };
  }
}
