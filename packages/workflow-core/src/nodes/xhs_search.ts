import { Node, NodeContext } from "../runtime/node";
import { ActionRequest } from "@social-agent/schemas";

export interface XhsSearchInput {
  keyword: string;
  page?: number;
  sortBy?: "general" | "time_descending" | "popularity_descending";
  noteType?: "all" | "video" | "image";
  baseUrl?: string;
  workspaceId?: string;
}

export interface XhsSearchOutput {
  type: "action_request";
  action: ActionRequest;
}

/**
 * XhsSearchNode: Searches for feeds on Xiaohongshu.
 * Emits an action request that will be executed by the API executor.
 */
export class XhsSearchNode implements Node<XhsSearchInput, XhsSearchOutput> {
  type = "xhs_search";

  async run(ctx: NodeContext, input: XhsSearchInput): Promise<XhsSearchOutput> {
    ctx.logger.info("XHS search", { keyword: input.keyword });

    const action: ActionRequest = {
      requestId: `${ctx.runId}_${ctx.nodeId}_${Date.now()}`,
      userId: "system",
      workspaceId: input.workspaceId || "default",
      platform: "xiaohongshu",
      action: "search_feeds",
      mode: "api",
      policyContext: { requiresApproval: false },
      traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
      payload: {
        keyword: input.keyword,
        page: input.page || 1,
        sortBy: input.sortBy || "general",
        noteType: input.noteType || "all",
        baseUrl: input.baseUrl
      }
    };

    return { type: "action_request", action };
  }
}
