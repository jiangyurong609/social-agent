import { z } from "zod";
import { Action, ExecutionMode, Platform } from "./platform";

const TraceContextSchema = z.object({
  runId: z.string(),
  nodeId: z.string()
});

const PolicyContextSchema = z.object({
  requiresApproval: z.boolean().default(false),
  maxPostsPerDay: z.number().int().optional(),
  dmSafetyLevel: z.enum(["high", "standard"]).optional()
});

export const ActionRequestSchema = z.object({
  requestId: z.string(),
  userId: z.string(),
  workspaceId: z.string(),
  platform: Platform,
  action: Action,
  mode: ExecutionMode,
  payload: z.unknown(),
  policyContext: PolicyContextSchema.default({ requiresApproval: false }),
  traceContext: TraceContextSchema
});

export const EvidenceSchema = z.object({
  url: z.string().url().optional(),
  screenshotArtifactId: z.string().optional()
});

export const ActionErrorSchema = z.object({
  type: z.string().optional(),
  message: z.string().optional(),
  retriable: z.boolean().optional()
});

export const ActionResultSchema = z.object({
  ok: z.boolean(),
  platformPostId: z.string().optional(),
  platformMessageId: z.string().optional(),
  evidence: EvidenceSchema.optional(),
  error: ActionErrorSchema.optional(),
  raw: z.record(z.string(), z.unknown()).optional()
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;
export type ActionResult = z.infer<typeof ActionResultSchema>;
export type ActionError = z.infer<typeof ActionErrorSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
