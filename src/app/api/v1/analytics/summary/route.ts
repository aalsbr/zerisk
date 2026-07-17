import { NextResponse } from "next/server";
import { getDataset, getKpis, getCalibration } from "@/lib/store";
import {
  countByDecision,
  riskLevelDistribution,
  confusionMetrics,
  sampleFalsePositives,
} from "@/lib/analytics";

// GET /api/v1/analytics/summary — computed analytics snapshot (no hardcoded KPIs).
export async function GET() {
  const ds = getDataset();
  const kpis = getKpis();
  const conf = confusionMetrics(ds.transactions);
  return NextResponse.json({
    modelVersion: getCalibration().version,
    kpis,
    sample: {
      transactions: ds.transactions.length,
      falsePositives: sampleFalsePositives(ds.transactions).length,
      originalDecisions: countByDecision(ds.transactions, "originalDecision"),
      aiRecommendations: countByDecision(ds.transactions, "aiDecision"),
      riskLevels: riskLevelDistribution(ds.transactions),
      model: {
        accuracy: conf.accuracy,
        precision: conf.precision,
        recall: conf.recall,
        falsePositiveRate: conf.fpRate,
        falseNegativeRate: conf.fnRate,
      },
    },
    disclaimer:
      "Decision-support analytics computed from the reproducible MVP dataset. Final enforcement depends on approved governance policies.",
  });
}
