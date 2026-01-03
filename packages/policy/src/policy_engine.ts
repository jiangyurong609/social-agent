import { Policy, Action } from "@social-agent/schemas";

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

export function checkPolicy(policy: Policy, action: Action): PolicyDecision {
  if (policy.blockedWords.length > 0) {
    return { allowed: false, reason: "Blocked content patterns configured" };
  }
  return { allowed: true, requiresApproval: policy.requiresApproval };
}
