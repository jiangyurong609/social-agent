import { Node, NodeContext } from "../runtime/node";

export interface ActionDispatch {
  type: "action_request";
  actions: unknown[];
}

/**
 * PublishBatchNode: in MVP it emits an array of action requests to be
 * dispatched by the orchestrator. This keeps the engine deterministic: it
 * returns a payload describing required side effects rather than performing
 * them directly.
 */
export class PublishBatchNode implements Node<unknown[], ActionDispatch> {
  type = "publish_batch";

  async run(ctx: NodeContext, input: unknown[] = []): Promise<ActionDispatch> {
    const actions = Array.isArray(input) ? input : [input];
    ctx.logger.info("Publish batch -> dispatch", { count: actions.length });
    return { type: "action_request", actions };
  }
}
