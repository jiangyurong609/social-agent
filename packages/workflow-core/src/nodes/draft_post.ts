import { Node, NodeContext } from "../runtime/node";

export class DraftPostNode implements Node<{ topic?: string }, { draft: string }> {
  type = "draft_post";

  async run(_ctx: NodeContext, input: { topic?: string }): Promise<{ draft: string }> {
    const topic = input?.topic ?? "update";
    const draft = `Draft: Sharing a quick ${topic} update.`;
    return { draft };
  }
}
