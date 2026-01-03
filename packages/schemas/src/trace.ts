import { z } from "zod";

export const TraceEventSchema = z.union([
  z.object({ t: z.literal("RunStarted"), runId: z.string(), at: z.string() }),
  z.object({ t: z.literal("NodeStarted"), runId: z.string(), nodeId: z.string(), at: z.string(), inputRef: z.string().optional() }),
  z.object({ t: z.literal("NodeCompleted"), runId: z.string(), nodeId: z.string(), at: z.string(), outputRef: z.string().optional() }),
  z.object({ t: z.literal("ActionRequested"), runId: z.string(), nodeId: z.string(), requestId: z.string(), platform: z.string(), action: z.string(), mode: z.string(), at: z.string() }),
  z.object({ t: z.literal("ActionResultReceived"), runId: z.string(), requestId: z.string(), ok: z.boolean(), at: z.string(), error: z.unknown().optional() })
]);

export type TraceEvent = z.infer<typeof TraceEventSchema>;
