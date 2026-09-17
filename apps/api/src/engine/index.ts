import { Agent, ActionRequestInput, EvaluateResult } from '@verdict/shared';
import {
  evaluateAction as engineEvaluateAction,
  categorizeForDocket,
} from '@verdict/verdict-engine';

export { categorizeForDocket };

export interface RiskContext {
  isKnownRecipient: boolean;
  isAnomalousAmount?: boolean;
}
/**
 * Isolated decision engine call site.
 * Fully wired to P1's pure evaluateAction() from @verdict/verdict-engine.
 *
 * @param agent Full agent record from SQLite (including capabilities)
 * @param request Parsed ActionRequestInput from the route
 * @param riskContext Dynamic recipient and anomaly analysis
 * @param hasRecentFlag Dynamic agent flag status from SQLite history
 */
export function evaluateAction(
  agent: Agent,
  request: ActionRequestInput,
  riskContext: RiskContext,
  hasRecentFlag: boolean
): EvaluateResult {
  return engineEvaluateAction(agent, request, riskContext, hasRecentFlag);
}
