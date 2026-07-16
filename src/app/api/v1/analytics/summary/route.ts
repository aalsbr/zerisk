import { NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import {
  PORTFOLIO,
  countByDecision,
  riskLevelDistribution,
  confusionMetrics,
  sampleFalsePositives,
} from "@/lib/analytics";

// GET /api/v1/analytics/summary — portfolio + sample analytics snapshot.
export async function GET() {
  const ds = getDataset();
  const conf = confusionMetrics(ds.transactions);
  return NextResponse.json({
    portfolio: PORTFOLIO,
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
      "Decision-support analytics. Final enforcement depends on approved governance policies.",
  });
}
