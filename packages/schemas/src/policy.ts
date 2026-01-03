import { z } from "zod";
import { Action } from "./platform";

export const QuotaRuleSchema = z.object({
  action: Action,
  limitPerDay: z.number().int().positive(),
  cooldownSec: z.number().int().nonnegative().default(0)
});

export const PolicySchema = z.object({
  requiresApproval: z.boolean().default(false),
  quotas: z.array(QuotaRuleSchema).default([]),
  blockedWords: z.array(z.string()).default([])
});

export type Policy = z.infer<typeof PolicySchema>;
export type QuotaRule = z.infer<typeof QuotaRuleSchema>;
