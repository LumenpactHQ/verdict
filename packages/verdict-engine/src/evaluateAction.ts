import { Agent, ActionRequestInput, Decision, EvaluateResult } from '@verdict/shared';

export function evaluateAction(
  agent: Agent,
  request: ActionRequestInput,
  riskContext: { isKnownRecipient: boolean; isAnomalousAmount?: boolean },
  hasRecentFlag: boolean
): EvaluateResult {
  // 1. If agent.verificationStatus !== 'verified' → REJECT
  if (agent.verificationStatus !== 'verified') {
    return {
      decision: 'REJECT',
      reasons: ['identity_unverified: agent not verified'],
    } as unknown as EvaluateResult;
  }

  // 2. Capability check (case-insensitive with payment/transfer semantic alias mapping)
  const normalizedCapabilities = new Set(agent.capabilities.map((c) => c.toLowerCase()));
  const requestedAction = request.actionType.toLowerCase();

  const hasCapability =
    normalizedCapabilities.has(requestedAction) ||
    (requestedAction === 'payment' && normalizedCapabilities.has('transfer')) ||
    (requestedAction === 'transfer' && normalizedCapabilities.has('payment'));

  if (!hasCapability) {
    return {
      decision: 'REJECT',
      reasons: [`capability_missing: agent not authorized for '${request.actionType}'`],
    } as unknown as EvaluateResult;
  }

  // 3. If hasRecentFlag is true → REJECT
  if (hasRecentFlag) {
    return {
      decision: 'REJECT',
      reasons: ['reputation_flagged: agent has recent flagged history'],
    } as unknown as EvaluateResult;
  }

  // 4. Amount thresholds (Rule 4)
  // Supports both standard hierarchy (reviewThreshold <= transactionLimit, e.g. $200 soft trigger / $1000 hard limit)
  // and inverted hierarchy (transactionLimit < reviewThreshold, e.g. $1000 auto-approve / $5000 review cap)
  const isStandardHierarchy = agent.reviewThreshold <= agent.transactionLimit;
  const hardCap = isStandardHierarchy ? agent.transactionLimit : agent.reviewThreshold;
  const softTrigger = isStandardHierarchy ? agent.reviewThreshold : agent.transactionLimit;

  if (hardCap > 0 && request.amount > hardCap) {
    return {
      decision: 'REJECT',
      reasons: [`policy_fail: amount ${request.amount} exceeds limit ${agent.transactionLimit}`],
    } as unknown as EvaluateResult;
  }

  if (softTrigger > 0 && request.amount > softTrigger) {
    return {
      decision: 'REVIEW',
      reasons: ['policy_review: exceeds limit, within review threshold'],
    } as unknown as EvaluateResult;
  }

  // 5. If riskContext.isKnownRecipient is false OR riskContext.isAnomalousAmount is true → REVIEW
  if (!riskContext.isKnownRecipient || Boolean(riskContext.isAnomalousAmount)) {
    return {
      decision: 'REVIEW',
      reasons: ['risk_flag: new recipient or anomalous amount'],
    } as unknown as EvaluateResult;
  }

  // 6. Otherwise → ALLOW
  return {
    decision: 'ALLOW',
    reasons: ['all_checks_passed'],
  } as unknown as EvaluateResult;
}

export function categorizeForDocket(reasons: string[]): string {
  if (reasons.some((r) => r === 'risk_flag: new recipient or anomalous amount' || r.includes('risk_flag'))) {
    return 'new_recipient';
  }
  if (reasons.some((r) => r === 'policy_review: exceeds limit, within review threshold' || r.includes('policy_review'))) {
    return 'near_limit';
  }
  return 'uncategorized';
}
