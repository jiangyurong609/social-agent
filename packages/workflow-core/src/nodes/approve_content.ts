import { Node, NodeContext } from "../runtime/node";

export class NeedsApprovalError extends Error {
  constructor(public readonly payload: unknown) {
    super("Content requires approval");
  }
}

export class ApproveContentNode implements Node<{ draft: string }, { approved: boolean; draft: string }> {
  type = "approve_content";

  async run(_ctx: NodeContext, input: { draft: string }): Promise<{ approved: boolean; draft: string }> {
    if (!input?.draft) {
      return { approved: true, draft: "" };
    }
    // For MVP we always request approval to keep flow explicit.
    throw new NeedsApprovalError(input);
  }
}
