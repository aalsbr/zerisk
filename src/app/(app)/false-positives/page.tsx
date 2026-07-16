import { getDataset } from "@/lib/store";
import {
  PORTFOLIO,
  PORTFOLIO_SCALE,
  sampleFalsePositives,
  fpBreakdowns,
  computeRuleStats,
} from "@/lib/analytics";
import { FalsePositivesView } from "@/components/pages/false-positives-view";

export default function FalsePositivesPage() {
  const { transactions, rules } = getDataset();

  const fpSample = sampleFalsePositives(transactions);
  const breakdowns = fpBreakdowns(transactions);
  const ruleStats = computeRuleStats(transactions, rules);

  // Financial value of the false declines (sample amounts projected to portfolio scale).
  const fpAmountValue = Math.round(
    fpSample.reduce((sum, t) => sum + t.amount, 0) * PORTFOLIO_SCALE,
  );

  const data = {
    kpi: {
      fpRateAfter: PORTFOLIO.fpRateAfter,
      fpRateBefore: PORTFOLIO.fpRateBefore,
      estimatedFalsePositives: PORTFOLIO.estimatedFalsePositives,
      fpAmountValue,
      revenueRecovered: PORTFOLIO.revenueRecovered,
      recoveredTransactions: PORTFOLIO.recoveredTransactions,
      originalRejected: PORTFOLIO.originalRejected,
    },
    breakdowns,
    // Serializable rule rows sorted by falsePositives desc (already sorted by computeRuleStats).
    ruleStats: ruleStats.map((s) => ({
      id: s.rule.id,
      nameAr: s.rule.name,
      nameEn: s.rule.nameEn,
      severity: s.rule.severity,
      action: s.rule.action,
      triggerCount: s.triggerCount,
      confirmedFraud: s.confirmedFraud,
      falsePositives: s.falsePositives,
      precision: s.precision,
      falsePositiveRate: s.falsePositiveRate,
      financialImpact: s.financialImpact,
      recommendationKey: s.recommendationKey,
    })),
  };

  return <FalsePositivesView data={data} />;
}
