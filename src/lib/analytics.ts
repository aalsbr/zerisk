// ============================================================================
// ZeRisk — Analytics: pure aggregation functions over the dataset.
// Every dashboard/chart derives from these (no numbers hardcoded in the UI).
// ============================================================================

import type {
  Decision,
  EnrichedTransaction,
  FraudRule,
  RuleRecommendationKey,
  RuleStat,
} from "./types";

// Sample→portfolio projection factor (the seeded set is a representative live
// window; rule-level counts are projected to a monthly scale for realism).
export const PORTFOLIO_SCALE = 60;

// Headline portfolio KPIs (institution-level, aligned to the demo narrative).
export const PORTFOLIO = {
  totalTransactions: 1250000,
  originalRejected: 31500,
  estimatedFalsePositives: 11340,
  fpRateBefore: 2.52,
  fpRateAfter: 1.18,
  recoveredTransactions: 8460,
  revenueRecovered: 1184400,
  investigationCostSaved: 426000,
  fraudPrevented: 3120000,
  avgDecisionTimeMs: 74,
  aiAgreementRate: 92.4,
  manualReviewReductionPct: 22,
  customerFrictionReductionPct: 46,
};

export function countByDecision(
  txns: EnrichedTransaction[],
  key: "originalDecision" | "aiDecision",
): Record<Decision, number> {
  const acc: Record<Decision, number> = { APPROVE: 0, REVIEW: 0, REJECT: 0, MONITOR: 0 };
  for (const t of txns) {
    const d = key === "originalDecision" ? t.originalDecision : t.ai.recommendation;
    acc[d]++;
  }
  return acc;
}

export function riskLevelDistribution(txns: EnrichedTransaction[]) {
  const buckets = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const t of txns) {
    const s = t.ai.optimizedRiskScore;
    if (s <= 34) buckets.low++;
    else if (s <= 59) buckets.medium++;
    else if (s <= 79) buckets.high++;
    else buckets.critical++;
  }
  return buckets;
}

export function sampleFalsePositives(txns: EnrichedTransaction[]) {
  return txns.filter((t) => t.isFalsePositive);
}

// ---- Rule statistics ---------------------------------------------------------

function ruleRecommendation(
  fpRate: number,
  precision: number,
  action: Decision,
): RuleRecommendationKey {
  if (fpRate >= 70 && precision < 5) return "DISABLE";
  if (fpRate >= 55 && action === "REJECT") return "REJECT_TO_REVIEW";
  if (fpRate >= 45) return "INCREASE_THRESHOLD";
  if (fpRate >= 30) return "ADD_TRUSTED_DEVICE";
  if (fpRate >= 20) return "ADD_HISTORY_EXCEPTION";
  if (fpRate >= 12) return "REDUCE_WEIGHT";
  if (precision >= 40) return "KEEP";
  return "MONITOR";
}

export function computeRuleStats(
  txns: EnrichedTransaction[],
  rules: FraudRule[],
  scale = PORTFOLIO_SCALE,
  avgRevenuePerTxn = 140,
): RuleStat[] {
  return rules
    .map((rule) => {
      const triggeredTxns = txns.filter((t) => t.triggeredRuleIds.includes(rule.id));
      const rawTriggers = triggeredTxns.length;
      const rawFraud = triggeredTxns.filter((t) => t.isActuallyFraud).length;
      const rawFp = triggeredTxns.filter((t) => t.isFalsePositive).length;

      const triggerCount = rawTriggers * scale;
      const confirmedFraud = rawFraud * scale;
      const falsePositives = rawFp * scale;

      const precision = rawTriggers > 0 ? (rawFraud / rawTriggers) * 100 : 0;
      const falsePositiveRate = rawTriggers > 0 ? (rawFp / rawTriggers) * 100 : 0;
      const financialImpact =
        falsePositives * avgRevenuePerTxn +
        triggeredTxns
          .filter((t) => t.isFalsePositive)
          .reduce((a, t) => a + t.amount, 0) *
          scale *
          0.02;

      return {
        rule,
        triggerCount,
        confirmedFraud,
        falsePositives,
        precision: +precision.toFixed(1),
        falsePositiveRate: +falsePositiveRate.toFixed(1),
        financialImpact: Math.round(financialImpact),
        recommendationKey: ruleRecommendation(falsePositiveRate, precision, rule.action),
      };
    })
    .sort((a, b) => b.falsePositives - a.falsePositives);
}

// ---- False-positive breakdowns ----------------------------------------------

function groupCount<T extends string>(
  txns: EnrichedTransaction[],
  key: (t: EnrichedTransaction) => T,
  scale = PORTFOLIO_SCALE,
): { label: T; value: number }[] {
  const map = new Map<T, number>();
  for (const t of txns) {
    const k = key(t);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value: value * scale }))
    .sort((a, b) => b.value - a.value);
}

export function fpBreakdowns(txns: EnrichedTransaction[]) {
  const fp = sampleFalsePositives(txns);
  return {
    byChannel: groupCount(fp, (t) => t.channel),
    bySegment: groupCount(fp, (t) => t.customer.segment),
    byDevice: groupCount(fp, (t) => (t.device.known ? "KNOWN" : "NEW") as "KNOWN" | "NEW"),
    byBeneficiary: groupCount(fp, (t) => t.beneficiary.type),
    byHour: bucketByHour(fp),
    byAmount: bucketByAmount(fp),
  };
}

function bucketByHour(txns: EnrichedTransaction[]) {
  const bands = [
    { label: "00-06", lo: 0, hi: 6 },
    { label: "06-12", lo: 6, hi: 12 },
    { label: "12-18", lo: 12, hi: 18 },
    { label: "18-24", lo: 18, hi: 24 },
  ];
  return bands.map((b) => ({
    label: b.label,
    value: txns.filter((t) => t.hour >= b.lo && t.hour < b.hi).length * PORTFOLIO_SCALE,
  }));
}

function bucketByAmount(txns: EnrichedTransaction[]) {
  const bands = [
    { label: "< 1K", lo: 0, hi: 1000 },
    { label: "1K-5K", lo: 1000, hi: 5000 },
    { label: "5K-15K", lo: 5000, hi: 15000 },
    { label: "15K-50K", lo: 15000, hi: 50000 },
    { label: "50K+", lo: 50000, hi: Infinity },
  ];
  return bands.map((b) => ({
    label: b.label,
    value: txns.filter((t) => t.amount >= b.lo && t.amount < b.hi).length * PORTFOLIO_SCALE,
  }));
}

// ---- Model monitoring metrics (confusion-matrix over the sample) -------------

export function confusionMetrics(txns: EnrichedTransaction[]) {
  // Treat AI recommendation REJECT/REVIEW as "flag as fraud", vs ground truth.
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const t of txns) {
    const flagged = t.ai.recommendation === "REJECT" || t.ai.recommendation === "REVIEW";
    if (flagged && t.isActuallyFraud) tp++;
    else if (flagged && !t.isActuallyFraud) fp++;
    else if (!flagged && !t.isActuallyFraud) tn++;
    else fn++;
  }
  const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
  const accuracy = ((tp + tn) / txns.length) * 100;
  const fpRate = fp + tn > 0 ? (fp / (fp + tn)) * 100 : 0;
  const fnRate = fn + tp > 0 ? (fn / (fn + tp)) * 100 : 0;
  return {
    tp, fp, tn, fn,
    precision: +precision.toFixed(1),
    recall: +recall.toFixed(1),
    accuracy: +accuracy.toFixed(1),
    fpRate: +fpRate.toFixed(1),
    fnRate: +fnRate.toFixed(1),
  };
}

export function scoreDistribution(txns: EnrichedTransaction[]) {
  const bands = ["0-20", "20-40", "40-60", "60-80", "80-100"];
  return bands.map((label, i) => ({
    label,
    original: txns.filter((t) => Math.min(4, Math.floor(t.originalRiskScore / 20)) === i).length,
    optimized: txns.filter((t) => Math.min(4, Math.floor(t.ai.optimizedRiskScore / 20)) === i).length,
  }));
}

export function confidenceDistribution(txns: EnrichedTransaction[]) {
  const bands = ["55-65", "65-75", "75-85", "85-95", "95-100"];
  const edges = [55, 65, 75, 85, 95, 101];
  return bands.map((label, i) => ({
    label,
    value: txns.filter((t) => t.ai.confidence >= edges[i] && t.ai.confidence < edges[i + 1]).length,
  }));
}
