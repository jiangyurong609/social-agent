import { Workflow } from "@social-agent/schemas";
import { NodeContext } from "./node";
import { createNode } from "./registry";
import { nowIso } from "@social-agent/shared";

export interface EngineResult {
  outputs: Record<string, unknown>;
}

/**
 * Minimal deterministic engine: executes nodes sequentially in definition order.
 * Emits trace events before/after each node. Does not persist state; callers
 * decide how to handle exceptions (e.g., approvals, retries).
 */
export async function executeWorkflow(
  graph: Workflow,
  initialInput: unknown,
  baseCtx: Omit<NodeContext, "nodeId">
): Promise<EngineResult> {
  const outputs: Record<string, unknown> = {};
  let lastOutput: unknown = initialInput;

  for (const nodeDef of graph.nodes) {
    const node = createNode(nodeDef.type);
    const ctx = { ...baseCtx, nodeId: nodeDef.id } as NodeContext;
    ctx.trace({ t: "NodeStarted", runId: ctx.runId, nodeId: nodeDef.id, at: nowIso() });
    try {
      const result = await node.run(ctx, lastOutput);
      outputs[nodeDef.id] = result;
      lastOutput = result;
      ctx.trace({ t: "NodeCompleted", runId: ctx.runId, nodeId: nodeDef.id, at: nowIso() });
    } catch (error) {
      // Propagate but record failure for observability.
      ctx.trace({
        t: "NodeCompleted",
        runId: ctx.runId,
        nodeId: nodeDef.id,
        at: nowIso(),
        outputRef: JSON.stringify({ error: (error as Error).message })
      });
      throw error;
    }
  }

  return { outputs };
}
