import { Node, NodeContext } from "../runtime/node";
import { ActionRequest } from "@social-agent/schemas";

export interface XhsPublishInput {
  title: string;
  content: string;
  images?: string[];
  tags?: string[];
  baseUrl?: string;
  workspaceId?: string;
}

export interface XhsPublishOutput {
  type: "action_request";
  action: ActionRequest;
}

/**
 * XhsPublishNode: Publishes a new post on Xiaohongshu.
 */
export class XhsPublishNode implements Node<XhsPublishInput, XhsPublishOutput> {
  type = "xhs_publish";

  async run(ctx: NodeContext, input: XhsPublishInput): Promise<XhsPublishOutput> {
    ctx.logger.info("XHS publish", { title: input.title });

    const action: ActionRequest = {
      requestId: `${ctx.runId}_${ctx.nodeId}_${Date.now()}`,
      userId: "system",
      workspaceId: input.workspaceId || "default",
      platform: "xiaohongshu",
      action: "publish_post",
      mode: "api",
      policyContext: { requiresApproval: true },
      traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
      payload: {
        title: input.title,
        content: input.content,
        images: input.images || [],
        tags: input.tags || [],
        baseUrl: input.baseUrl
      }
    };

    return { type: "action_request", action };
  }
}
