import { QuotaRule } from "@social-agent/schemas";

export interface QuotaState {
  [action: string]: number;
}

export function checkQuota(rule: QuotaRule, state: QuotaState): { allowed: boolean; retryAfterSec?: number } {
  const used = state[rule.action] ?? 0;
  if (used >= rule.limitPerDay) {
    return { allowed: false, retryAfterSec: rule.cooldownSec };
  }
  return { allowed: true };
}
