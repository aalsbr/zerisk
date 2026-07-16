import { getDataset } from "@/lib/store";
import {
  PORTFOLIO,
  countByDecision,
  riskLevelDistribution,
  computeRuleStats,
} from "@/lib/analytics";
import { DashboardView } from "@/components/pages/dashboard-view";

export default function DashboardPage() {
  const { transactions, metrics, rules } = getDataset();

  const original = countByDecision(transactions, "originalDecision");
  const ai = countByDecision(transactions, "aiDecision");
  const risk = riskLevelDistribution(transactions);
  const ruleStats = computeRuleStats(transactions, rules).slice(0, 6);

  const data = {
    kpi: {
      total: PORTFOLIO.totalTransactions,
      approved: PORTFOLIO.totalTransactions - 23040 - 18600,
      rejected: 23040,
      rejectedBefore: PORTFOLIO.originalRejected,
      review: 18600,
      fpDetected: PORTFOLIO.estimatedFalsePositives,
      fpRateAfter: PORTFOLIO.fpRateAfter,
      fpRateBefore: PORTFOLIO.fpRateBefore,
      fraudPrevented: PORTFOLIO.fraudPrevented,
      revenueRecovered: PORTFOLIO.revenueRecovered,
      costSaved: PORTFOLIO.investigationCostSaved,
      frictionReduction: PORTFOLIO.customerFrictionReductionPct,
      accuracy: PORTFOLIO.aiAgreementRate,
      decisionTime: PORTFOLIO.avgDecisionTimeMs,
      recovered: PORTFOLIO.recoveredTransactions,
    },
    fpTrend: metrics.map((m) => ({ label: m.label, before: m.fpRateBefore, after: m.fpRateAfter })),
    decisionCompare: (["APPROVE", "REVIEW", "REJECT", "MONITOR"] as const).map((d) => ({
      label: d,
      original: original[d],
      ai: ai[d],
    })),
    riskLevels: [
      { name: "low", value: risk.low },
      { name: "medium", value: risk.medium },
      { name: "high", value: risk.high },
      { name: "critical", value: risk.critical },
    ],
    fraudByMonth: metrics.map((m) => ({ label: m.label, value: m.fraudPrevented })),
    revenueByMonth: metrics.map((m) => ({ label: m.label, value: m.revenueRecovered })),
    reviewReduction: metrics.map((m) => ({ label: m.label, value: m.manualReviews })),
    frictionTrend: metrics.map((m) => ({ label: m.label, value: m.customerFriction })),
    topRules: ruleStats.map((r) => ({ label: r.rule.id, value: r.falsePositives })),
  };

  return <DashboardView data={data} />;
}
