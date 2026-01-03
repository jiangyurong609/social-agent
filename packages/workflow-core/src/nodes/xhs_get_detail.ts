import { Node, NodeContext } from "../runtime/node";
import { ActionRequest } from "@social-agent/schemas";

export interface XhsGetDetailInput {
  feedId: string;
  xsecToken: string;
  loadComments?: boolean;
  commentsCount?: number;
  baseUrl?: string;
  workspaceId?: string;
}

export interface XhsGetDetailOutput {
  type: "action_request";
  action: ActionRequest;
}

/**
 * XhsGetDetailNode: Gets detailed information about a Xiaohongshu post.
 */
export class XhsGetDetailNode implements Node<XhsGetDetailInput, XhsGetDetailOutput> {
  type = "xhs_get_detail";

  async run(ctx: NodeContext, input: XhsGetDetailInput): Promise<XhsGetDetailOutput> {
    ctx.logger.info("XHS get detail", { feedId: input.feedId });

    const action: ActionRequest = {
      requestId: `${ctx.runId}_${ctx.nodeId}_${Date.now()}`,
      userId: "system",
      workspaceId: input.workspaceId || "default",
      platform: "xiaohongshu",
      action: "get_feed_detail",
      mode: "api",
      policyContext: { requiresApproval: false },
      traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
      payload: {
        feedId: input.feedId,
        xsecToken: input.xsecToken,
        loadComments: input.loadComments !== false,
        commentsCount: input.commentsCount || 10,
        baseUrl: input.baseUrl
      }
    };

    return { type: "action_request", action };
  }
}
