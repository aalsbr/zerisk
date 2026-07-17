import { getDataset, getKpis } from "@/lib/store";
import {
  sampleFalsePositives,
  fpBreakdowns,
  computeRuleStats,
  countByDecision,
} from "@/lib/analytics";
import { FalsePositivesView } from "@/components/pages/false-positives-view";

export default function FalsePositivesPage() {
  const { transactions, rules } = getDataset();
  const k = getKpis();

  const fpSample = sampleFalsePositives(transactions);
  const breakdowns = fpBreakdowns(transactions);
  const ruleStats = computeRuleStats(transactions, rules);
  const original = countByDecision(transactions, "originalDecision");

  const fpAmountValue = Math.round(fpSample.reduce((sum, t) => sum + t.amount, 0));

  const data = {
    kpi: {
      fpRateAfter: k.fpRateAfter,
      fpRateBefore: k.fpRateBefore,
      estimatedFalsePositives: k.falsePositivesDetected,
      fpAmountValue,
      revenueRecovered: k.revenueRecovered,
      recoveredTransactions: k.recoveredTransactions,
      originalRejected: original.REJECT,
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
