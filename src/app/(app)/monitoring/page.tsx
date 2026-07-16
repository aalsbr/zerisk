import { getDataset } from "@/lib/store";
import {
  confusionMetrics,
  scoreDistribution,
  confidenceDistribution,
  countByDecision,
  computeRuleStats,
} from "@/lib/analytics";
import { MonitoringView } from "@/components/pages/monitoring-view";
import type { EnrichedTransaction } from "@/lib/types";

// "Correct" = AI flagged (REJECT/REVIEW) iff the transaction is actually fraud.
function isCorrect(t: EnrichedTransaction): boolean {
  const flagged = t.ai.recommendation === "REJECT" || t.ai.recommendation === "REVIEW";
  return flagged === t.isActuallyFraud;
}

function accuracyBy<K extends string>(
  txns: EnrichedTransaction[],
  key: (t: EnrichedTransaction) => K,
): { label: K; value: number }[] {
  const total = new Map<K, number>();
  const correct = new Map<K, number>();
  for (const t of txns) {
    const k = key(t);
    total.set(k, (total.get(k) ?? 0) + 1);
    if (isCorrect(t)) correct.set(k, (correct.get(k) ?? 0) + 1);
  }
  return [...total.entries()]
    .map(([label, n]) => ({
      label,
      value: +(((correct.get(label) ?? 0) / n) * 100).toFixed(1),
    }))
    .sort((a, b) => b.value - a.value);
}

export default function MonitoringPage() {
  const { transactions, rules, metrics } = getDataset();

  const confusion = confusionMetrics(transactions);
  const scoreDist = scoreDistribution(transactions);
  const confidenceDist = confidenceDistribution(transactions);
  const decisionCounts = countByDecision(transactions, "aiDecision");
  const ruleStats = computeRuleStats(transactions, rules);

  const bySegment = accuracyBy(transactions, (t) => t.customer.segment);
  const byChannel = accuracyBy(transactions, (t) => t.channel);

  // ---- Derived alerts (understandable, bilingual) ----
  const latest = metrics[metrics.length - 1];
  const drift = latest?.drift ?? 0;
  const lowConfidenceShare =
    (transactions.filter((t) => t.ai.confidence < 65).length / transactions.length) * 100;
  const worstRule = [...ruleStats].sort(
    (a, b) => b.falsePositiveRate - a.falsePositiveRate,
  )[0];

  const data = {
    kpi: {
      accuracy: confusion.accuracy,
      precision: confusion.precision,
      recall: confusion.recall,
      fpRate: confusion.fpRate,
      fnRate: confusion.fnRate,
      tp: confusion.tp,
      fp: confusion.fp,
      tn: confusion.tn,
      fn: confusion.fn,
    },
    performanceTrend: metrics.map((m) => ({
      label: m.label,
      accuracy: m.accuracy,
      precision: m.precision,
      recall: m.recall,
    })),
    driftTrend: metrics.map((m) => ({ label: m.label, value: +(m.drift * 100).toFixed(1) })),
    fnRateTrend: metrics.map((m) => ({
      label: m.label,
      value: m.falseNegativeRate,
      fpRate: m.fpRateAfter,
    })),
    scoreDist,
    confidenceDist,
    decisionDist: (["APPROVE", "REVIEW", "REJECT", "MONITOR"] as const).map((d) => ({
      key: d,
      value: decisionCounts[d],
    })),
    bySegment,
    byChannel,
    alerts: {
      drift,
      driftPct: +(drift * 100).toFixed(1),
      lowConfidenceShare: +lowConfidenceShare.toFixed(1),
      lowConfidenceCount: transactions.filter((t) => t.ai.confidence < 65).length,
      worstRuleId: worstRule?.rule.id ?? "",
      worstRuleFpRate: worstRule?.falsePositiveRate ?? 0,
      worstRuleNameAr: worstRule?.rule.name ?? "",
      worstRuleNameEn: worstRule?.rule.nameEn ?? "",
      fpRateAfter: latest?.fpRateAfter ?? 0,
      fpRateBefore: metrics[metrics.length - 2]?.fpRateAfter ?? latest?.fpRateAfter ?? 0,
    },
  };

  return <MonitoringView data={data} />;
}
