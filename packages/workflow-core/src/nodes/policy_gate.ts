import { Node, NodeContext } from "../runtime/node";

export class PolicyGateNode implements Node<unknown, unknown> {
  type = "policy_gate";

  async run(ctx: NodeContext, input: unknown): Promise<unknown> {
    ctx.logger.info("Policy gate pass-through", { nodeId: ctx.nodeId });
    return input;
  }
}
