import { z } from "zod";

export const WorkflowRunStatus = z.enum([
  "pending",
  "running",
  "waiting_approval",
  "waiting_extension",
  "completed",
  "failed"
]);

export const NodeRunStatus = z.enum([
  "pending",
  "running",
  "waiting",
  "completed",
  "failed"
]);

export const NodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  inputs: z.record(z.string(), z.unknown()).optional(),
  retryPolicy: z
    .object({ attempts: z.number().int().default(1), delayMs: z.number().int().default(0) })
    .optional(),
  timeoutMs: z.number().int().optional()
});

export const EdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  condition: z.string().optional()
});

export const WorkflowSchema = z.object({
  id: z.string(),
  version: z.string(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type Workflow = z.infer<typeof WorkflowSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatus>;
export type NodeRunStatus = z.infer<typeof NodeRunStatus>;
