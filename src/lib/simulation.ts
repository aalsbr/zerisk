// ============================================================================
// ZeRisk — What-If simulation engine.
// Applies a proposed rule change to the SEEDED historical dataset and measures
// the before/after impact. Results are data-driven, never hardcoded.
// ============================================================================

import { PORTFOLIO_SCALE } from "./analytics";
import type {
  CustomerSegment,
  Decision,
  EnrichedTransaction,
  FraudRule,
} from "./types";

export interface SimulationConfig {
  ruleId: string;
  currentThreshold: number;
  proposedThreshold: number;
  currentWeight: number;
  proposedWeight: number;
  currentAction: Decision;
  proposedAction: Decision;
  segment: CustomerSegment | "ALL";
  periodDays: number;
}

export interface SimulationOutput {
  transactionsAffected: number;
  fpBefore: number;
  fpAfter: number;
  fraudBefore: number;
  fraudAfter: number;
  missedFraud: number;
  approvalRateImprovement: number; // percentage points
  revenueRecovered: number;
  investigationSaved: number;
  frictionReduction: number; // percent
  netBenefit: number;
  fraudExposure: number;
  verdict: "RECOMMENDED" | "RECOMMENDED_WITH_SAFEGUARDS" | "NOT_RECOMMENDED";
  releasedIds: string[];
}

export function defaultConfig(rule: FraudRule): SimulationConfig {
  const base = rule.amountThreshold ?? 10000;
  return {
    ruleId: rule.id,
    currentThreshold: base,
    proposedThreshold: Math.round(base * 1.6),
    currentWeight: rule.weight,
    proposedWeight: Math.max(4, Math.round(rule.weight * 0.7)),
    currentAction: rule.action,
    proposedAction: rule.action === "REJECT" ? "REVIEW" : rule.action,
    segment: "ALL",
    periodDays: 90,
  };
}

// Whether the proposed change "releases" a transaction (rule no longer blocks it).
function isReleased(t: EnrichedTransaction, c: SimulationConfig): boolean {
  const raisedThreshold = c.proposedThreshold > c.currentThreshold && t.amount < c.proposedThreshold;
  const softenedAction =
    (c.currentAction === "REJECT" && c.proposedAction !== "REJECT") ||
    (c.currentAction === "REVIEW" && (c.proposedAction === "APPROVE" || c.proposedAction === "MONITOR"));
  const loweredWeight = c.proposedWeight <= c.currentWeight * 0.6;
  return raisedThreshold || softenedAction || (loweredWeight && t.ai.optimizedRiskScore < 55);
}

const AVG_REVENUE = 140;
const INVESTIGATION_COST = 42;
const AVG_FRAUD_LOSS = 2400;

export function runSimulation(
  config: SimulationConfig,
  txns: EnrichedTransaction[],
): SimulationOutput {
  const affected = txns.filter(
    (t) =>
      t.triggeredRuleIds.includes(config.ruleId) &&
      (config.segment === "ALL" || t.customer.segment === config.segment),
  );

  const released = affected.filter((t) => isReleased(t, config));
  const releasedLegit = released.filter((t) => !t.isActuallyFraud);
  const releasedFraud = released.filter((t) => t.isActuallyFraud);

  const scale = PORTFOLIO_SCALE;
  const fpBefore = affected.filter((t) => t.isFalsePositive).length * scale;
  const fpAfter = affected
    .filter((t) => t.isFalsePositive && !released.includes(t))
    .length * scale;

  const fraudBefore = affected.filter((t) => t.isActuallyFraud).length * scale;
  const fraudAfter = (affected.filter((t) => t.isActuallyFraud).length - releasedFraud.length) * scale;

  const missedFraud = releasedFraud.length * scale;
  const recoveredCount = releasedLegit.length * scale;

  const revenueRecovered = recoveredCount * AVG_REVENUE +
    releasedLegit.reduce((a, t) => a + t.amount, 0) * scale * 0.015;
  const investigationSaved = recoveredCount * INVESTIGATION_COST;
  const fraudExposure = missedFraud * AVG_FRAUD_LOSS;
  const netBenefit = Math.round(revenueRecovered + investigationSaved - fraudExposure);

  const total = txns.length;
  const approvalRateImprovement = +((releasedLegit.length / Math.max(total, 1)) * 100).toFixed(2);
  const frictionReduction = affected.length > 0
    ? +((released.length / affected.length) * 100).toFixed(1)
    : 0;

  let verdict: SimulationOutput["verdict"];
  const exposureRatio = revenueRecovered > 0 ? fraudExposure / revenueRecovered : 1;
  if (missedFraud === 0 && netBenefit > 0) verdict = "RECOMMENDED";
  else if (netBenefit > 0 && exposureRatio < 0.25) verdict = "RECOMMENDED_WITH_SAFEGUARDS";
  else verdict = "NOT_RECOMMENDED";

  return {
    transactionsAffected: affected.length * scale,
    fpBefore,
    fpAfter,
    fraudBefore,
    fraudAfter,
    missedFraud,
    approvalRateImprovement,
    revenueRecovered: Math.round(revenueRecovered),
    investigationSaved: Math.round(investigationSaved),
    frictionReduction,
    netBenefit,
    fraudExposure: Math.round(fraudExposure),
    verdict,
    releasedIds: released.map((t) => t.id),
  };
}
