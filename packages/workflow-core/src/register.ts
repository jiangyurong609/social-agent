import { registerNode } from "./runtime/registry";
import { DraftPostNode } from "./nodes/draft_post";
import { ApproveContentNode } from "./nodes/approve_content";
import { PolicyGateNode } from "./nodes/policy_gate";
import { PublishBatchNode } from "./nodes/publish_batch";
import { XhsSearchNode } from "./nodes/xhs_search";
import { XhsLikeNode } from "./nodes/xhs_like";
import { XhsCommentNode } from "./nodes/xhs_comment";
import { XhsPublishNode } from "./nodes/xhs_publish";
import { XhsGetDetailNode } from "./nodes/xhs_get_detail";
import { FilterFeedsNode } from "./nodes/filter_feeds";
import { BatchEngageNode } from "./nodes/batch_engage";

/**
 * Registers the built-in nodes so consumers can simply import this file once
 * at process startup.
 */
export function registerBuiltinNodes() {
  registerNode("draft_post", () => new DraftPostNode());
  registerNode("approve_content", () => new ApproveContentNode());
  registerNode("policy_gate", () => new PolicyGateNode());
  registerNode("publish_batch", () => new PublishBatchNode());

  // Xiaohongshu nodes
  registerNode("xhs_search", () => new XhsSearchNode());
  registerNode("xhs_like", () => new XhsLikeNode());
  registerNode("xhs_comment", () => new XhsCommentNode());
  registerNode("xhs_publish", () => new XhsPublishNode());
  registerNode("xhs_get_detail", () => new XhsGetDetailNode());

  // Automation nodes
  registerNode("filter_feeds", () => new FilterFeedsNode());
  registerNode("batch_engage", () => new BatchEngageNode());
}
