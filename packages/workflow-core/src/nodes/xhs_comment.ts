import { Node, NodeContext } from "../runtime/node";
import { ActionRequest } from "@social-agent/schemas";

export interface XhsCommentInput {
  feedId: string;
  xsecToken: string;
  content: string;
  baseUrl?: string;
  workspaceId?: string;
}

export interface XhsCommentOutput {
  type: "action_request";
  action: ActionRequest;
}

/**
 * XhsCommentNode: Comments on a post on Xiaohongshu.
 */
export class XhsCommentNode implements Node<XhsCommentInput, XhsCommentOutput> {
  type = "xhs_comment";

  async run(ctx: NodeContext, input: XhsCommentInput): Promise<XhsCommentOutput> {
    ctx.logger.info("XHS comment", { feedId: input.feedId });

    const action: ActionRequest = {
      requestId: `${ctx.runId}_${ctx.nodeId}_${Date.now()}`,
      userId: "system",
      workspaceId: input.workspaceId || "default",
      platform: "xiaohongshu",
      action: "comment_post",
      mode: "api",
      policyContext: { requiresApproval: false },
      traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
      payload: {
        feedId: input.feedId,
        xsecToken: input.xsecToken,
        content: input.content,
        baseUrl: input.baseUrl
      }
    };

    return { type: "action_request", action };
  }
}
