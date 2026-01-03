import { TraceEvent } from "@social-agent/schemas";
import type { Logger } from "@social-agent/observability";

export interface ArtifactStore {
  putJson?: (key: string, value: unknown) => Promise<string> | string;
}

export interface NodeContext {
  runId: string;
  nodeId: string;
  logger: Logger;
  trace: (event: TraceEvent) => Promise<void> | void;
  artifacts?: ArtifactStore;
}

export interface Node<I = unknown, O = unknown> {
  type: string;
  run: (ctx: NodeContext, input: I) => Promise<O> | O;
}
